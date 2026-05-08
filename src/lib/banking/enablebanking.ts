import "server-only";
import { signEnableBankingApiToken } from "./jwt";

// =============================================================================
// Enable Banking — API client
// =============================================================================
// Docs: https://enablebanking.com/docs/api/reference/
// Auth: every request carries a Bearer JWT signed with our RSA key (see jwt.ts)
// =============================================================================

const BASE_URL = "https://api.enablebanking.com";

class EnableBankingError extends Error {
  constructor(
    message: string,
    public status: number,
    public path: string,
    public body: unknown,
  ) {
    super(message);
    this.name = "EnableBankingError";
  }
}

async function ebFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = signEnableBankingApiToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new EnableBankingError(
      `Enable Banking ${res.status} on ${path}`,
      res.status,
      path,
      body,
    );
  }
  return res.json() as Promise<T>;
}

// -----------------------------------------------------------------------------
// Types — narrow to what we actually consume. The API returns more fields.
// -----------------------------------------------------------------------------
export interface EbAspsp {
  name: string;
  country: string;
  logo?: string;
  bic?: string;
  psu_types?: string[];
  auth_methods?: string[];
  beta?: boolean;
  /** Whether this ASPSP supports "personal" PSU access */
  required_psu_headers?: string[];
}

export interface EbAccountIdentifier {
  iban?: string;
  bban?: string;
  other?: { identification: string; scheme_name?: string };
}

export interface EbAccount {
  uid: string;
  account_id?: EbAccountIdentifier | string;
  identification_hash?: string;
  identification_hashes?: string[];
  currency: string;
  name?: string;
  product?: string;
  details?: string;
  cash_account_type?: string;
  usage?: string;
}

export interface EbSession {
  session_id: string;
  status?: string;
  accounts: EbAccount[];
  aspsp: { name: string; country: string };
  psu_type: string;
  access: { valid_until: string };
  // raw retains full provider payload for the bank_connections row
  [k: string]: unknown;
}

export interface EbAuthStart {
  url: string;
  authorization_id?: string;
}

export interface EbBalancesResponse {
  balances: Array<{
    name?: string;
    balance_amount: { amount: string; currency: string };
    balance_type:
      | "CLBD" | "CLAV" | "PRCD" | "ITAV" | "ITBD" | "INFO" | "FWAV" | "OPBD" | "XPCD";
    reference_date?: string;
  }>;
}

export interface EbTransaction {
  entry_reference?: string;
  transaction_id?: string;
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  transaction_amount: { amount: string; currency: string };
  /** Some banks report a positive `transaction_amount` and rely on this flag for the sign. */
  credit_debit_indicator?: "CRDT" | "DBIT";
  creditor?: { name?: string };
  creditor_account?: EbAccountIdentifier;
  debtor?: { name?: string };
  debtor_account?: EbAccountIdentifier;
  remittance_information?: string[];
  remittance_information_unstructured?: string;
  bank_transaction_code?: string;
  proprietary_bank_transaction_code?: string;
  additional_information?: string;
  status?: "BOOK" | "PDNG" | "INFO" | "OTHR";
}

export interface EbTransactionsResponse {
  transactions: EbTransaction[];
  continuation_key?: string;
}

// -----------------------------------------------------------------------------
// Public surface
// -----------------------------------------------------------------------------
export const enableBanking = {
  /** List banks for a country (ISO 3166-1 alpha-2). */
  async listAspsps(country: string): Promise<EbAspsp[]> {
    const res = await ebFetch<{ aspsps: EbAspsp[] }>(
      `/aspsps?country=${encodeURIComponent(country)}`,
    );
    return res.aspsps;
  },

  /**
   * Begin an authorization. Returns a `url` to redirect the user to;
   * after authenticating at the bank they come back to `redirect_url` with
   * `?code=...&state=...`.
   */
  async startAuth(input: {
    aspsp: { name: string; country: string };
    redirect_url: string;
    state: string;
    psu_type?: "personal" | "business";
    /** ISO timestamp; defaults to now + 89 days (Enable Banking allows up to 90). */
    valid_until?: string;
  }): Promise<EbAuthStart> {
    const validUntil =
      input.valid_until ??
      new Date(Date.now() + 89 * 24 * 60 * 60 * 1000).toISOString();
    return ebFetch<EbAuthStart>("/auth", {
      method: "POST",
      body: JSON.stringify({
        access: { valid_until: validUntil },
        aspsp: input.aspsp,
        state: input.state,
        redirect_url: input.redirect_url,
        psu_type: input.psu_type ?? "personal",
      }),
    });
  },

  /** Exchange the authorization `code` from the callback for a session. */
  async createSession(code: string): Promise<EbSession> {
    return ebFetch<EbSession>("/sessions", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  async getSession(sessionId: string): Promise<EbSession> {
    return ebFetch<EbSession>(`/sessions/${encodeURIComponent(sessionId)}`);
  },

  async deleteSession(sessionId: string): Promise<void> {
    await ebFetch<void>(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  },

  async getAccountBalances(uid: string): Promise<EbBalancesResponse> {
    return ebFetch<EbBalancesResponse>(`/accounts/${encodeURIComponent(uid)}/balances`);
  },

  async getAccountTransactions(
    uid: string,
    opts: {
      date_from?: string;
      date_to?: string;
      continuation_key?: string;
      /** Berlin Group / Enable Banking transaction status codes. */
      transaction_status?: "BOOK" | "PDNG" | "HOLD" | "CNCL" | "RJCT" | "SCHD" | "OTHR";
    } = {},
  ): Promise<EbTransactionsResponse> {
    const qs = new URLSearchParams();
    if (opts.date_from) qs.set("date_from", opts.date_from);
    if (opts.date_to) qs.set("date_to", opts.date_to);
    if (opts.continuation_key) qs.set("continuation_key", opts.continuation_key);
    if (opts.transaction_status) qs.set("transaction_status", opts.transaction_status);
    const suffix = qs.toString() ? `?${qs}` : "";
    return ebFetch<EbTransactionsResponse>(
      `/accounts/${encodeURIComponent(uid)}/transactions${suffix}`,
    );
  },
};

export { EnableBankingError };
