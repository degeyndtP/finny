import { createHash } from "node:crypto";
import type { Database } from "@/lib/supabase/database.types";
import type { EbAccount, EbAccountIdentifier, EbTransaction } from "./enablebanking";

type AccountInsert = Database["public"]["Tables"]["accounts"]["Insert"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

/**
 * Map an Enable Banking account to our DB shape.
 */
export function normalizeAccount(
  acc: EbAccount,
  ctx: { household_id: string; bank_connection_id: string },
): AccountInsert {
  return {
    household_id: ctx.household_id,
    bank_connection_id: ctx.bank_connection_id,
    external_account_id: acc.uid,
    iban: extractIban(acc.account_id) ?? null,
    display_name: acc.name ?? acc.product ?? null,
    owner_name: null, // populated later if /details is fetched
    currency: acc.currency,
  };
}

/**
 * Map an Enable Banking transaction to our DB shape.
 * Caller supplies household_id + account_id (DB ids, not the bank's uids).
 */
export function normalizeTransaction(
  tx: EbTransaction,
  ctx: { household_id: string; account_id: string },
): TransactionInsert {
  const amount = Number(tx.transaction_amount.amount);
  const isOutflow = amount < 0;

  const counterpartyName = isOutflow
    ? tx.creditor?.name ?? null
    : tx.debtor?.name ?? null;
  const counterpartyIban = isOutflow
    ? extractIban(tx.creditor_account)
    : extractIban(tx.debtor_account);
  const counterpartyAccount = isOutflow
    ? extractBban(tx.creditor_account)
    : extractBban(tx.debtor_account);

  const remittance =
    tx.remittance_information_unstructured ??
    tx.remittance_information?.join("\n") ??
    null;

  return {
    household_id: ctx.household_id,
    account_id: ctx.account_id,
    external_id: stableExternalId(tx, ctx.account_id),
    booking_date:
      tx.booking_date ??
      tx.value_date ??
      tx.transaction_date ??
      new Date().toISOString().slice(0, 10),
    value_date: tx.value_date ?? null,
    amount,
    currency: tx.transaction_amount.currency,
    counterparty_name: counterpartyName,
    counterparty_iban: counterpartyIban,
    counterparty_account: counterpartyAccount,
    description: tx.additional_information ?? null,
    remittance_info: remittance,
    raw: tx as unknown as TransactionInsert["raw"],
  };
}

function extractIban(id: EbAccountIdentifier | string | undefined): string | null {
  if (!id) return null;
  if (typeof id === "string") {
    return /^[A-Z]{2}\d{2}/.test(id) ? id : null;
  }
  return id.iban ?? null;
}

function extractBban(id: EbAccountIdentifier | string | undefined): string | null {
  if (!id) return null;
  if (typeof id === "string") return null;
  return id.bban ?? id.other?.identification ?? null;
}

/**
 * Enable Banking transactions sometimes lack a stable id. We prefer
 * `entry_reference`, then `transaction_id`, then a SHA-256 of stable fields
 * so re-imports stay idempotent against our `(account_id, external_id)` unique key.
 */
function stableExternalId(tx: EbTransaction, accountId: string): string {
  if (tx.entry_reference) return tx.entry_reference;
  if (tx.transaction_id) return tx.transaction_id;

  const h = createHash("sha256");
  h.update(accountId);
  h.update("|");
  h.update(tx.booking_date ?? "");
  h.update("|");
  h.update(tx.value_date ?? "");
  h.update("|");
  h.update(tx.transaction_amount.amount);
  h.update("|");
  h.update(tx.transaction_amount.currency);
  h.update("|");
  h.update(tx.creditor?.name ?? tx.debtor?.name ?? "");
  h.update("|");
  h.update(tx.remittance_information_unstructured ?? "");
  return `synthetic_${h.digest("hex").slice(0, 32)}`;
}
