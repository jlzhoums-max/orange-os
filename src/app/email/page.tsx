import Link from "next/link";
import { ArrowLeft, CalendarDays, MailCheck, Sparkles, Zap } from "lucide-react";
import { AppChrome } from "@/components/app-chrome";
import { EmailClient } from "@/components/email-client";

export default function EmailPage() {
  return (
    <AppChrome active="Mail">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="grid gap-4 xl:grid-cols-[1fr_26rem]">
          <section className="os-card overflow-hidden p-5 sm:p-6">
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]"
              href="/"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>
            <div className="mt-7 max-w-4xl">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[#111827] text-[#ff8a4c]">
                <MailCheck size={25} />
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-normal text-balance sm:text-5xl">
                Email that moves at thought speed.
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                A Superhuman-inspired Orange OS inbox for split triage, AI replies, read status, follow-ups,
                snippets, and calendar-aware decisions in one focused workspace.
              </p>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              ["Split inbox", "Important mail rises above noisy tools and newsletters.", Zap],
              ["AI reply", "Draft, rewrite, and queue responses from the active thread.", Sparkles],
              ["Calendar fit", "See follow-ups and availability without leaving mail.", CalendarDays],
            ].map(([title, detail, Icon]) => (
              <div className="os-card-soft flex items-start gap-3 p-4" key={title as string}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-[#ff8a4c]">
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

        <EmailClient />
      </div>
    </AppChrome>
  );
}
