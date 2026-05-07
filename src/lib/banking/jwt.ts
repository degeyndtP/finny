import { createPrivateKey, createSign, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// =============================================================================
// Enable Banking JWT signer
// =============================================================================
// Enable Banking authenticates every API request with a self-signed JWT:
//   header  { typ: "JWT", alg: "RS256", kid: <ENABLE_BANKING_APP_ID> }
//   payload { iss: "enablebanking.com", aud: "api.enablebanking.com",
//             iat, exp }
//   sig     RS256 over `header.payload` using our RSA private key.
//
// The token lasts up to 1h; we cache and reuse for ~58 minutes.
// =============================================================================

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let cachedKey: KeyObject | null = null;

function loadPrivateKey(): KeyObject {
  if (cachedKey) return cachedKey;

  const inline = process.env.ENABLE_BANKING_PRIVATE_KEY;
  let pem: string;
  if (inline) {
    // Allow either real newlines or literal \n escapes (env files, Vercel, etc.)
    pem = inline.replace(/\\n/g, "\n");
  } else {
    const keyPath = process.env.ENABLE_BANKING_PRIVATE_KEY_PATH;
    if (!keyPath) {
      throw new Error(
        "Set ENABLE_BANKING_PRIVATE_KEY (inline PEM) or ENABLE_BANKING_PRIVATE_KEY_PATH (file path).",
      );
    }
    const resolved = path.isAbsolute(keyPath)
      ? keyPath
      : // Turbopack warns on dynamic path.join with cwd; for our use case
        // the path is supplied by the user via env and resolved at runtime
        // outside the bundle.
        path.join(/* turbopackIgnore: true */ process.cwd(), keyPath);
    pem = readFileSync(resolved, "utf8");
  }
  cachedKey = createPrivateKey(pem);
  return cachedKey;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export function signEnableBankingApiToken(): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.value;
  }

  const appId = process.env.ENABLE_BANKING_APP_ID;
  if (!appId) throw new Error("ENABLE_BANKING_APP_ID is not set");

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header = { typ: "JWT", alg: "RS256", kid: appId };
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat,
    exp,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(loadPrivateKey());

  const value = `${signingInput}.${base64url(signature)}`;
  cachedToken = { value, expiresAt: iat * 1000 + 58 * 60 * 1000 };
  return value;
}
