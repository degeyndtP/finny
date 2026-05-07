"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { enableBanking, EnableBankingError } from "@/lib/banking";
import { setBankAuthState } from "@/lib/banking/state-cookie";
import { createClient } from "@/lib/supabase/server";

export async function startBankAuth(formData: FormData) {
  const aspspName = formData.get("aspsp_name");
  const country = formData.get("country");
  if (typeof aspspName !== "string" || typeof country !== "string") {
    redirect("/accounts/connect?error=missing_input");
  }

  // Make sure the user is logged in. proxy.ts already handles this for the
  // page render, but server actions can be called from anywhere — defence
  // in depth.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const state = randomUUID();
  const redirectUri =
    process.env.ENABLE_BANKING_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/banking/callback`;

  let url: string;
  try {
    const auth = await enableBanking.startAuth({
      aspsp: { name: aspspName, country },
      redirect_url: redirectUri,
      state,
      psu_type: "personal",
    });
    url = auth.url;
  } catch (e) {
    const msg =
      e instanceof EnableBankingError
        ? `${e.status}: ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`
        : (e as Error).message;
    redirect(`/accounts/connect?error=${encodeURIComponent(msg)}`);
  }

  await setBankAuthState({ state, aspspName, country });
  redirect(url);
}
