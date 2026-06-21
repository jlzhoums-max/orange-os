import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, CalendarDays, Landmark, WalletCards } from "lucide-react";
import { AppTopbar, BottomDock } from "@/components/app-chrome";
import { LedgerTool } from "@/components/ledger-tool";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function LedgerPage() {
  if (hasSupabasePublicEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
      redirect("/login");
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppTopbar />
      <main className="min-h-screen px-4 pb-28 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <header className="grid gap-5 lg:grid-cols-[1fr_0.72fr] lg:items-stretch">
            <section className="os-card overflow-hidden border-2 p-6 sm:p-8">
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
                href="/"
              >
                <ArrowLeft size={16} />
                Dashboard
              </Link>
              <div className="mt-8 flex max-w-3xl flex-col gap-4">
                <div className="os-icon-bubble flex h-14 w-14 items-center justify-center">
                  <WalletCards size={24} />
                </div>
                <h1 className="text-4xl font-bold tracking-normal text-balance sm:text-5xl">
                  The Ledger
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                  Manual cash-flow awareness, liquid account balances, weekly pace, and monthly budget framing.
                </p>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["Budget", "Needs, wants, and savings split.", BadgeDollarSign],
                ["Weekly frame", "Pace without daily micromanagement.", CalendarDays],
                ["Liquid wealth", "Cash and investment balances only.", Landmark],
              ].map(([title, detail, Icon]) => (
                <div className="os-card-soft flex items-start gap-3 border-2 p-4" key={title as string}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--accent)]">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-semibold">{title as string}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{detail as string}</p>
                  </div>
                </div>
              ))}
            </section>
          </header>

          <LedgerTool />
        </div>
      </main>
      <BottomDock active="Tools" />
    </div>
  );
}
