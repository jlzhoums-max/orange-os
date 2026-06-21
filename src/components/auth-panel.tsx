"use client";

import { useState } from "react";
import Image from "next/image";
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
    const origin = window.location.origin;

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
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10">
      <section className="os-card w-full max-w-lg p-6 sm:p-8">
        <Image
          alt="Orange OS"
          className="h-16 w-16"
          height={64}
          priority
          src="/brand/citrus-logo-mark.svg"
          width={64}
        />
        <h1 className="sr-only">Orange OS</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">
          Sign in with Google to unlock Supabase Auth, private project storage,
          Gmail, Calendar, and market-aware daily brief workflows.
        </p>

        {mode === "missing-env" ? (
          <div className="mt-6 rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
            Supabase environment variables are not configured yet. Add
            `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
            to `.env.local`, then restart the dev server.
          </div>
        ) : (
          <button
            className="os-primary-button mt-6 flex h-12 w-full items-center justify-center gap-2 px-5 text-sm font-semibold"
            disabled={loading}
            onClick={signInWithGoogle}
            type="button"
          >
            {loading ? "Opening Google..." : "Continue with Google"}
          </button>
        )}
      </section>
    </main>
  );
}
