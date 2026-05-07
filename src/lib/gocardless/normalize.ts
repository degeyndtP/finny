import { createHash } from "node:crypto";
import type { GcTransaction } from "./types";
import type { Database } from "@/lib/supabase/database.types";

type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

/**
 * Map a GoCardless transaction to our DB shape.
 * Caller supplies household_id + account_id (we don't have those at the GC level).
 */
export function normalizeTransaction(
  tx: GcTransaction,
  ctx: { household_id: string; account_id: string },
): TransactionInsert {
  const amount = Number(tx.transactionAmount.amount);
  const isOutflow = amount < 0;

  const counterpartyName = isOutflow ? tx.creditorName : tx.debtorName;
  const counterpartyIban = isOutflow
    ? tx.creditorAccount?.iban
    : tx.debtorAccount?.iban;
  const counterpartyAccount = isOutflow
    ? tx.creditorAccount?.bban
    : tx.debtorAccount?.bban;

  const remittance =
    tx.remittanceInformationUnstructured ??
    tx.remittanceInformationUnstructuredArray?.join("\n") ??
    null;

  return {
    household_id: ctx.household_id,
    account_id: ctx.account_id,
    external_id: stableExternalId(tx, ctx.account_id),
    booking_date: tx.bookingDate ?? tx.valueDate ?? new Date().toISOString().slice(0, 10),
    value_date: tx.valueDate ?? null,
    amount,
    currency: tx.transactionAmount.currency,
    counterparty_name: counterpartyName ?? null,
    counterparty_iban: counterpartyIban ?? null,
    counterparty_account: counterpartyAccount ?? null,
    description: tx.additionalInformation ?? null,
    remittance_info: remittance,
    raw: tx as unknown as Database["public"]["Tables"]["transactions"]["Insert"]["raw"],
  };
}

/**
 * GoCardless does not always return transactionId. Prefer the bank-provided
 * `transactionId`, then `internalTransactionId`. Fall back to a SHA-256 of the
 * stable fields so re-imports are idempotent.
 */
function stableExternalId(tx: GcTransaction, accountId: string): string {
  if (tx.transactionId) return tx.transactionId;
  if (tx.internalTransactionId) return tx.internalTransactionId;

  const h = createHash("sha256");
  h.update(accountId);
  h.update("|");
  h.update(tx.bookingDate ?? "");
  h.update("|");
  h.update(tx.valueDate ?? "");
  h.update("|");
  h.update(tx.transactionAmount.amount);
  h.update("|");
  h.update(tx.transactionAmount.currency);
  h.update("|");
  h.update(tx.creditorName ?? tx.debtorName ?? "");
  h.update("|");
  h.update(tx.remittanceInformationUnstructured ?? "");
  return `synthetic_${h.digest("hex").slice(0, 32)}`;
}
