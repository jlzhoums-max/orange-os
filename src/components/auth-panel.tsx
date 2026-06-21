"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { googleIntegrationScopes } from "@/lib/google/scopes";

type AuthPanelProps = {
  mode: "login" | "missing-env";
};

export function AuthPanel({ mode }: AuthPanelProps) {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const origin = appUrl || window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/`,
        scopes: googleIntegrationScopes.join(" "),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setLoading(false);
      alert(error.message);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[176px_1fr]">
        <aside className="relative hidden overflow-hidden bg-[linear-gradient(180deg,#F47E16_0%,#E84B1B_100%)] lg:block">
          <div className="absolute -bottom-16 -left-12 h-72 w-72 rounded-full bg-white/15" />
          <div className="absolute bottom-20 left-10 h-44 w-44 rounded-[42px] bg-white/18 rotate-[-14deg]" />
        </aside>

        <section className="flex min-h-screen items-center justify-center px-5 py-10">
          <div className="w-full max-w-[390px] text-center">
            <Image
              alt="JU OS"
              className="mx-auto h-12 w-12"
              height={48}
              priority
              src="/brand/citrus-logo-mark-512.png"
              width={48}
            />
            <h1 className="mt-8 text-[26px] font-extrabold tracking-normal">Welcome to JU OS</h1>
            <p className="mx-auto mt-3 max-w-[280px] text-sm font-semibold leading-6 text-[var(--muted-soft)]">
              Sign in to pick up right where you left off.
            </p>

            {mode === "missing-env" ? (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm leading-6 text-red-800">
                Supabase environment variables are not configured yet. Add `NEXT_PUBLIC_SUPABASE_URL` and
                `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local`, then restart the dev server.
              </div>
            ) : (
              <button
                className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-[14px] border border-[var(--line-strong)] bg-white px-5 text-sm font-extrabold text-[var(--foreground)] shadow-[0_8px_22px_rgba(90,55,20,.08)] transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-70"
                disabled={loading}
                onClick={signInWithGoogle}
                type="button"
              >
                <span className="text-xl font-extrabold text-[#4285F4]">G</span>
                {loading ? "Opening Google..." : "Continue with Google"}
                <ArrowRight size={16} className="text-[var(--muted-soft)]" />
              </button>
            )}

            <p className="mt-5 flex items-start justify-center gap-2 text-left text-xs font-semibold leading-5 text-[var(--muted-faint)]">
              <Lock size={14} className="mt-0.5 shrink-0" />
              Private by default - we never post or email on your behalf.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
