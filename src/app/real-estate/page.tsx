import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, Camera, ClipboardList, Home, Plus } from "lucide-react";
import { AppChrome } from "@/components/app-chrome";
import { RealEstateTracker } from "@/components/real-estate-tracker";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function RealEstateToolPage() {
  if (hasSupabasePublicEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (!data?.claims) {
      redirect("/login");
    }
  }

  return (
    <AppChrome active="Tools">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
          <header className="grid gap-5 lg:grid-cols-[1fr_0.72fr] lg:items-stretch">
            <section className="os-card os-watermark overflow-hidden p-6 sm:p-8">
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
                href="/"
              >
                <ArrowLeft size={16} />
                Dashboard
              </Link>
              <div className="mt-8 flex max-w-3xl flex-col gap-4">
                <div className="os-icon-bubble flex h-14 w-14 items-center justify-center">
                  <Home size={24} />
                </div>
                <h1 className="text-4xl font-bold tracking-normal text-balance sm:text-5xl">
                  Real Estate Tool
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                  Track projects, costs, receipts, values, budgets, risk, and next actions in one focused workspace.
                </p>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ["Projects", "Create and update active deals.", ClipboardList],
                ["Expenses", "Log cost, vendor, status, and notes.", BadgeDollarSign],
                ["Receipts", "Attach supporting images to expenses.", Camera],
              ].map(([title, detail, Icon]) => (
                <div className="os-card-soft flex items-start gap-3 p-4" key={title as string}>
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-[var(--line)] bg-white px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">Workspace</p>
              <p className="text-sm text-[var(--muted)]">The tracker below is the working surface for this tool.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
              <Plus size={16} />
              Use Add Project in the tracker
            </div>
          </div>

          <RealEstateTracker />
        </div>
    </AppChrome>
  );
}
