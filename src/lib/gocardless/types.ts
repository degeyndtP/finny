// =============================================================================
// GoCardless Bank Account Data API — typed surface
// =============================================================================
// API docs: https://developer.gocardless.com/bank-account-data/overview
// Base URL : https://bankaccountdata.gocardless.com/api/v2/
// =============================================================================

export interface GcTokenResponse {
  access: string;
  access_expires: number;   // seconds
  refresh: string;
  refresh_expires: number;  // seconds
}

export interface GcInstitution {
  id: string;                 // e.g. "KBC_KREDBEBB"
  name: string;
  bic: string;
  transaction_total_days: string;
  countries: string[];
  logo: string;
}

export interface GcAgreement {
  id: string;
  created: string;
  max_historical_days: number;
  access_valid_for_days: number;
  access_scope: ("balances" | "details" | "transactions")[];
  accepted: string | null;
  institution_id: string;
}

export interface GcRequisition {
  id: string;
  created: string;
  redirect: string;
  status:
    | "CR" // CREATED
    | "GC" // GIVING_CONSENT
    | "UA" // UNDERGOING_AUTHENTICATION
    | "RJ" // REJECTED
    | "SA" // SELECTING_ACCOUNTS
    | "GA" // GRANTING_ACCESS
    | "LN" // LINKED
    | "EX"; // EXPIRED
  institution_id: string;
  agreement: string;
  reference: string;
  accounts: string[];           // account ids
  user_language: string;
  link: string;                 // bank consent URL — redirect user here
}

export interface GcAccountDetails {
  account: {
    resourceId?: string;
    iban?: string;
    currency: string;
    ownerName?: string;
    name?: string;
    product?: string;
    cashAccountType?: string;
  };
}

export interface GcBalance {
  balanceAmount: { amount: string; currency: string };
  balanceType:
    | "closingBooked"
    | "expected"
    | "openingBooked"
    | "interimAvailable"
    | "interimBooked"
    | "forwardAvailable"
    | "nonInvoiced";
  referenceDate?: string;
}

export interface GcBalancesResponse {
  balances: GcBalance[];
}

export interface GcTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;          // YYYY-MM-DD
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  creditorName?: string;
  creditorAccount?: { iban?: string; bban?: string };
  debtorName?: string;
  debtorAccount?: { iban?: string; bban?: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  bankTransactionCode?: string;
  proprietaryBankTransactionCode?: string;
  additionalInformation?: string;
}

export interface GcTransactionsResponse {
  transactions: {
    booked: GcTransaction[];
    pending: GcTransaction[];
  };
}
