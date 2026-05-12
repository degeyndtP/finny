import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// =============================================================================
// Column-level encryption for high-value secrets persisted in Postgres.
//
// Algorithm: AES-256-GCM (authenticated, 96-bit IV, 128-bit tag).
// Wire format: "enc:v1:<base64(iv | tag | ciphertext)>"
//   - "enc:v1:" prefix lets us detect legacy plaintext rows during migration
//     and gives us a path to rotate to v2 without breaking existing rows.
//   - 12-byte IV is the GCM recommendation; we generate a fresh one per write.
//   - The auth tag is concatenated so we never need to track it separately.
//
// Key material: COLUMN_ENCRYPTION_KEY (32 bytes, base64-encoded) in the env.
// Generate with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// =============================================================================

const PREFIX = "enc:v1:";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.COLUMN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "COLUMN_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `COLUMN_ENCRYPTION_KEY must be 32 bytes when base64-decoded (got ${buf.length}). Re-generate it.`,
    );
  }
  cachedKey = buf;
  return cachedKey;
}

/**
 * Encrypt a UTF-8 string for storage. Output is safe to put in a TEXT column.
 *
 * Pass-through of `null` / empty input keeps call sites trivial.
 */
export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypt a value produced by `encryptSecret`. Strings without the v1 prefix
 * are returned unchanged so we can keep reading legacy plaintext rows while
 * the one-shot backfill rolls through them.
 */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext

  const blob = Buffer.from(stored.slice(PREFIX.length), "base64");
  if (blob.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("decryptSecret: payload too short");
  }
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = blob.subarray(IV_LEN + TAG_LEN);

  const decipher = createDecipheriv("aes-256-gcm", loadKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

/** True if the value is already in the v1 envelope. */
export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}
