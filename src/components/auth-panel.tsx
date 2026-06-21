"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, CalendarDays, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { googleIntegrationScopes } from "@/lib/google/scopes";

type AuthPanelProps = {
  error?: string;
  mode: "login" | "missing-env";
};

export function AuthPanel({ error, mode }: AuthPanelProps) {
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
    <main className="os-page flex min-h-screen items-center justify-center px-5 py-10">
      <section className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[rgba(255,253,248,0.74)] shadow-[var(--shadow-soft)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
        <div className="os-watermark relative min-h-[34rem] overflow-hidden p-7 sm:p-10">
          <Image
            alt="Orange OS"
            className="h-16 w-16"
            height={64}
            priority
            src="/brand/citrus-logo-mark.svg"
            width={64}
          />
          <h1 className="mt-12 max-w-xl text-5xl font-bold tracking-normal text-balance sm:text-6xl">
            Your day, sliced clearly.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[var(--muted)]">
            Plan your time, track your projects, and keep every part of your life in one warm, focused workspace.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["Gmail", Mail],
              ["Calendar", CalendarDays],
              ["AI brief", Sparkles],
            ].map(([label, Icon]) => (
              <div className="rounded-2xl border border-[var(--line)] bg-white/62 p-4" key={label as string}>
                <Icon className="text-[var(--accent)]" size={19} />
                <p className="mt-3 text-sm font-semibold">{label as string}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center p-5 sm:p-8">
          <div className="os-card w-full p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="os-icon-bubble flex h-12 w-12 items-center justify-center">
                <ShieldCheck size={22} />
              </span>
              <div>
                <p className="os-label">Secure workspace</p>
                <h2 className="text-2xl font-bold">Sign in to Orange OS</h2>
              </div>
            </div>

            <p className="mt-5 leading-7 text-[var(--muted)]">
              Connect Google to unlock private project storage, Gmail, Calendar, and market-aware daily brief workflows.
            </p>

            {mode === "missing-env" ? (
              <div className="mt-6 rounded-[1.5rem] border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                Supabase environment variables are not configured yet. Add
                `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
                to `.env.local`, then restart the dev server.
              </div>
            ) : (
              <>
                {error === "not-allowed" ? (
                  <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    This Orange OS workspace is private. Sign in with an allowed Google account.
                  </div>
                ) : null}
                <button
                  className="os-primary-button mt-7 flex h-13 min-h-13 w-full items-center justify-center gap-2 px-5 text-sm font-semibold"
                  disabled={loading}
                  onClick={signInWithGoogle}
                  type="button"
                >
                  {loading ? "Opening Google..." : "Continue with Google"}
                  <ArrowRight size={17} />
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
