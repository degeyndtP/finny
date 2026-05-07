import "server-only";
import { cookies } from "next/headers";

const STATE_COOKIE = "finny_eb_state";

export interface BankAuthState {
  state: string;
  aspspName: string;
  country: string;
}

/**
 * Stash the OAuth-style state + chosen ASPSP in an httpOnly cookie before
 * redirecting the user to the bank. Used both for CSRF protection (we
 * verify the state on callback) and to remember which bank the user picked
 * without doing a second API call.
 */
export async function setBankAuthState(payload: BankAuthState) {
  const jar = await cookies();
  jar.set(STATE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60, // 30 minutes — bank consent flows usually take 1-3 min
  });
}

export async function readBankAuthState(): Promise<BankAuthState | null> {
  const jar = await cookies();
  const raw = jar.get(STATE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BankAuthState;
    if (
      typeof parsed?.state === "string" &&
      typeof parsed?.aspspName === "string" &&
      typeof parsed?.country === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearBankAuthState() {
  const jar = await cookies();
  jar.delete(STATE_COOKIE);
}
