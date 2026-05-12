import { NextResponse, type NextRequest } from "next/server";

import { enableBanking, EnableBankingError, normalizeAccount } from "@/lib/banking";
import { clearBankAuthState, readBankAuthState } from "@/lib/banking/state-cookie";
import { encryptSecret } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";

/**
 * Enable Banking redirects the user here after they consent at their bank:
 *   GET /auth/banking/callback?code=...&state=...
 *
 * We exchange the code for a session, persist a bank_connection + its
 * accounts, then redirect back to /accounts.
 *
 * The user must be authenticated to Finny (proxy.ts enforces this).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/accounts/connect?error=${encodeURIComponent(errorParam)}`, url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/accounts/connect?error=missing_code", url));
  }

  // ---------- CSRF: state must match the cookie set by startBankAuth ------
  const stashed = await readBankAuthState();
  if (!stashed || stashed.state !== state) {
    return NextResponse.redirect(
      new URL("/accounts/connect?error=invalid_state", url),
    );
  }

  // ---------- Auth: ensure we have a user + their household ----------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url));
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.redirect(
      new URL(
        `/accounts/connect?error=${encodeURIComponent("no household for user")}`,
        url,
      ),
    );
  }
  const householdId = membership.household_id;

  // ---------- Exchange code -> session ------------------------------------
  let session: Awaited<ReturnType<typeof enableBanking.createSession>>;
  try {
    session = await enableBanking.createSession(code);
  } catch (e) {
    const msg =
      e instanceof EnableBankingError
        ? `${e.status}: ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`
        : (e as Error).message;
    await clearBankAuthState();
    return NextResponse.redirect(
      new URL(`/accounts/connect?error=${encodeURIComponent(msg)}`, url),
    );
  }

  // ---------- Persist bank_connection + accounts --------------------------
  const { data: connection, error: connError } = await supabase
    .from("bank_connections")
    .insert({
      household_id: householdId,
      provider: "enablebanking",
      institution_id: stashed.aspspName,
      institution_name: session.aspsp?.name ?? stashed.aspspName,
      requisition_id: encryptSecret(session.session_id),
      status: "linked",
      expires_at: session.access?.valid_until ?? null,
    })
    .select("id")
    .single();

  if (connError || !connection) {
    await clearBankAuthState();
    return NextResponse.redirect(
      new URL(
        `/accounts/connect?error=${encodeURIComponent(`db: ${connError?.message ?? "no connection row"}`)}`,
        url,
      ),
    );
  }

  if (session.accounts?.length) {
    const accountRows = session.accounts.map((acc) =>
      normalizeAccount(acc, {
        household_id: householdId,
        bank_connection_id: connection.id,
      }),
    );
    const { error: accError } = await supabase.from("accounts").insert(accountRows);
    if (accError) {
      await clearBankAuthState();
      return NextResponse.redirect(
        new URL(
          `/accounts/connect?error=${encodeURIComponent(`db: ${accError.message}`)}`,
          url,
        ),
      );
    }
  }

  await clearBankAuthState();
  return NextResponse.redirect(new URL("/accounts?connected=1", url));
}
