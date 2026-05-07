import type {
  GcAccountDetails,
  GcAgreement,
  GcBalancesResponse,
  GcInstitution,
  GcRequisition,
  GcTokenResponse,
  GcTransactionsResponse,
} from "./types";

const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

interface CachedToken {
  access: string;
  expiresAt: number; // ms epoch
  refresh: string;
  refreshExpiresAt: number;
}

let tokenCache: CachedToken | null = null;

async function gcFetch<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...rest } = init;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GoCardless ${res.status} ${res.statusText} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.access;
  }

  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error("GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY must be set");
  }

  const data = await gcFetch<GcTokenResponse>("/token/new/", {
    method: "POST",
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  tokenCache = {
    access: data.access,
    expiresAt: now + data.access_expires * 1000,
    refresh: data.refresh,
    refreshExpiresAt: now + data.refresh_expires * 1000,
  };
  return tokenCache.access;
}

async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  return gcFetch<T>(path, { ...init, accessToken: token });
}

// -----------------------------------------------------------------------------
// Public client surface
// -----------------------------------------------------------------------------
export const gocardless = {
  /** List banks for a country (ISO 3166-1 alpha-2, e.g. "BE"). */
  listInstitutions(country: string): Promise<GcInstitution[]> {
    return authed<GcInstitution[]>(`/institutions/?country=${encodeURIComponent(country)}`);
  },

  /**
   * Create an end-user agreement controlling history depth + consent length.
   * Defaults to 90d historical (PSD2 max) and 90d access.
   */
  createAgreement(input: {
    institution_id: string;
    max_historical_days?: number;
    access_valid_for_days?: number;
    access_scope?: ("balances" | "details" | "transactions")[];
  }): Promise<GcAgreement> {
    return authed<GcAgreement>("/agreements/enduser/", {
      method: "POST",
      body: JSON.stringify({
        max_historical_days: 90,
        access_valid_for_days: 90,
        access_scope: ["balances", "details", "transactions"],
        ...input,
      }),
    });
  },

  /**
   * Create a requisition (consent flow). The returned `link` is the URL the
   * user must visit to authorise access at their bank.
   */
  createRequisition(input: {
    redirect: string;            // your callback URL
    institution_id: string;
    agreement?: string;
    reference?: string;          // your own correlation id
    user_language?: string;      // e.g. "NL"
  }): Promise<GcRequisition> {
    return authed<GcRequisition>("/requisitions/", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getRequisition(id: string): Promise<GcRequisition> {
    return authed<GcRequisition>(`/requisitions/${id}/`);
  },

  deleteRequisition(id: string): Promise<unknown> {
    return authed(`/requisitions/${id}/`, { method: "DELETE" });
  },

  getAccountDetails(accountId: string): Promise<GcAccountDetails> {
    return authed<GcAccountDetails>(`/accounts/${accountId}/details/`);
  },

  getAccountBalances(accountId: string): Promise<GcBalancesResponse> {
    return authed<GcBalancesResponse>(`/accounts/${accountId}/balances/`);
  },

  /**
   * Fetch booked + pending transactions for an account.
   * date_from / date_to default to the bank's allowed history window.
   */
  getAccountTransactions(
    accountId: string,
    opts: { date_from?: string; date_to?: string } = {},
  ): Promise<GcTransactionsResponse> {
    const qs = new URLSearchParams();
    if (opts.date_from) qs.set("date_from", opts.date_from);
    if (opts.date_to) qs.set("date_to", opts.date_to);
    const suffix = qs.toString() ? `?${qs}` : "";
    return authed<GcTransactionsResponse>(`/accounts/${accountId}/transactions/${suffix}`);
  },
};
