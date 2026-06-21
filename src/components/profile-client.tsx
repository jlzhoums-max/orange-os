"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, LogOut, Mail } from "lucide-react";
import { AppChrome } from "@/components/app-chrome";
import { createClient } from "@/lib/supabase/client";
import { googleIntegrationScopes } from "@/lib/google/scopes";

type ConnectedAccount = {
  email: string;
  label: string;
  tone: "primary" | "work" | "project";
  kind: string;
  emailSync: boolean;
  calendarSync: boolean;
};

type IntegrationStatus = {
  profile?: {
    email: string | null;
  };
  google: {
    connected: boolean;
    accountEmail: string | null;
    scopes: string[];
    accounts?: Array<{
      accountEmail: string | null;
      scopes: string[];
      updatedAt: string | null;
    }>;
  };
};

function hasScope(scopes: string[], needle: string) {
  return scopes.some((scope) => scope.toLowerCase().includes(needle));
}

function accountFromStatus(account: NonNullable<IntegrationStatus["google"]["accounts"]>[number], index: number): ConnectedAccount {
  const scopes = account.scopes ?? [];
  return {
    email: account.accountEmail ?? "Google account",
    label: index === 0 ? "Primary" : "Google",
    tone: index === 0 ? "primary" : "project",
    kind: "Google",
    emailSync: hasScope(scopes, "gmail"),
    calendarSync: hasScope(scopes, "calendar"),
  };
}

export function ProfileClient() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState("Ready");

  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await fetch("/api/integrations/status", { cache: "no-store" });
        if (response.ok) {
          setStatus((await response.json()) as IntegrationStatus);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadStatus();
  }, []);

  const accounts = useMemo(() => {
    return (status?.google.accounts ?? []).map(accountFromStatus);
  }, [status]);
  const profileEmail = status?.profile?.email ?? accounts[0]?.email ?? "ju@home.os";

  async function connectGoogle() {
    setConnecting(true);
    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const origin = appUrl || window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/profile`,
        scopes: googleIntegrationScopes.join(" "),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setConnecting(false);
      setMessage(error.message);
    }
  }

  async function disconnectGoogle() {
    if (!window.confirm("Disconnect Google from JU OS? Email and calendar sync will stop until you reconnect.")) return;
    setMessage("Disconnecting Google");
    const response = await fetch("/api/integrations/status", { method: "DELETE" });
    if (response.ok) {
      setStatus((current) => current ? { ...current, google: { ...current.google, connected: false, accounts: [] } } : current);
      setMessage("Google disconnected");
    } else {
      const payload = (await response.json()) as { error?: string };
      setMessage(payload.error ?? "Could not disconnect Google");
    }
  }

  async function signOut() {
    await fetch("/auth/signout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <AppChrome active="profile">
      <main className="max-w-[760px] pb-32 md:pb-8">
        <h1 className="mb-[22px] hidden text-[25px] font-extrabold tracking-normal text-[var(--foreground)] md:block">Profile & Accounts</h1>
        <h1 className="mb-3 text-[22px] font-extrabold tracking-normal text-[var(--foreground)] md:hidden">Profile</h1>

        <section className="mb-3.5 flex items-center gap-3.5 rounded-[18px] border border-[var(--line)] bg-white p-[18px] shadow-[0_6px_16px_rgba(90,55,20,.04)] md:mb-[22px] md:gap-5 md:rounded-[22px] md:p-6 md:shadow-[var(--shadow-card)]">
          <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#F47E16,#E84B1B)] text-[22px] font-extrabold text-white md:h-[72px] md:w-[72px] md:text-[28px]">J</div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-extrabold text-[var(--foreground)] md:text-xl">Ju Carter</h2>
            <p className="mt-0.5 truncate text-[12.5px] font-semibold text-[var(--muted-soft)] md:text-[13.5px]">{profileEmail}<span className="hidden md:inline"> · Member since 2024</span></p>
          </div>
          <button className="rounded-[10px] bg-[#F1E8D8] px-3 py-[7px] text-xs font-bold text-[#6E6456] md:rounded-[12px] md:border-[1.5px] md:border-[#E7DBC4] md:bg-white md:px-[18px] md:py-2.5 md:text-[13.5px]" type="button">
            <span className="md:hidden">Edit</span>
            <span className="hidden md:inline">Edit profile</span>
          </button>
        </section>

        <section className="mb-3.5 rounded-[18px] border border-[var(--line)] bg-white p-[18px] shadow-[0_6px_16px_rgba(90,55,20,.04)] md:mb-[22px] md:rounded-[22px] md:p-6 md:shadow-[var(--shadow-card)]">
          <div className="mb-[3px] flex items-center justify-between gap-3 md:mb-1.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-[27px] w-[27px] items-center justify-center rounded-lg bg-[var(--panel-strong)] text-[var(--accent-hot)] md:h-[30px] md:w-[30px] md:rounded-[9px]">
                <Mail size={16} />
              </span>
              <h2 className="text-[14.5px] font-extrabold text-[var(--foreground)] md:text-base">Connected accounts</h2>
            </div>
            <span className="hidden text-[12.5px] font-bold text-[var(--muted-soft)] md:block">
              {loading ? "Checking" : `${accounts.length} connected`}
            </span>
          </div>
          <p className="mb-3.5 text-xs font-medium text-[var(--muted-soft)] md:mb-[18px] md:text-[13px]">Sync Google email & calendar into Ju OS.</p>

          <div className="grid gap-2.5 md:gap-3">
            {accounts.length ? (
              accounts.map((account, index) => (
                <AccountCard account={account} compact={index === 2} key={account.email} onDisconnect={disconnectGoogle} />
              ))
            ) : (
              <div className="rounded-[14px] border border-dashed border-[#D8CDB6] bg-[#FDFAF3] p-4 text-sm font-semibold text-[var(--muted)]">
                {loading ? "Checking Google connection..." : "No Google account connected yet."}
              </div>
            )}
          </div>

          <button className="mt-2.5 flex w-full items-center justify-center gap-2.5 rounded-[13px] border-[1.5px] border-dashed border-[#D8CDB6] bg-white p-[13px] text-[13.5px] font-bold text-[var(--foreground)] transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-70 md:mt-4 md:rounded-[15px] md:p-[15px] md:text-[14.5px]" disabled={connecting} onClick={connectGoogle} type="button">
            <GoogleIcon className="h-[17px] w-[17px] md:h-5 md:w-5" />
            <span className="md:hidden">{connecting ? "Opening Google" : "Connect Google account"}</span>
            <span className="hidden md:inline">{connecting ? "Opening Google" : accounts.length ? "Reconnect Google account" : "Connect Google account"}</span>
          </button>
          <span className="sr-only" aria-live="polite">{message}</span>
        </section>

        <button className="flex w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#F3D2C4] bg-white p-3.5 text-sm font-bold text-[#C0392B] transition hover:-translate-y-px md:rounded-[15px] md:p-[15px] md:text-[14.5px]" onClick={signOut} type="button">
          <LogOut size={17} />
          Log out
        </button>
      </main>
    </AppChrome>
  );
}

function AccountCard({ account, compact = false, onDisconnect }: { account: ConnectedAccount; compact?: boolean; onDisconnect: () => void }) {
  return (
    <article className={`${compact ? "hidden md:block" : ""} rounded-[14px] border border-[var(--line)] bg-[#FDFAF3] p-[13px] md:rounded-2xl md:p-[16px_18px]`}>
      <div className="mb-[11px] flex items-center gap-2.5 md:mb-0 md:gap-[13px]">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[var(--line)] bg-white md:h-10 md:w-10 md:rounded-[11px]">
          <GoogleIcon className="h-[17px] w-[17px] md:h-5 md:w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[13px] font-extrabold text-[var(--foreground)] md:text-[14.5px]">{account.email}</p>
            <span className={`hidden rounded-[7px] px-2 py-0.5 text-[10.5px] font-extrabold md:inline ${badgeClass(account.tone)}`}>{account.label}</span>
          </div>
          <p className={`mt-0.5 text-[10.5px] font-bold md:text-xs md:font-semibold ${account.tone === "primary" ? "text-[#256B43]" : account.tone === "work" ? "text-[var(--accent-ink)]" : "text-[var(--muted-soft)]"}`}>
            <span className="md:hidden">{account.kind}{account.tone === "primary" ? " · Primary" : account.tone === "work" ? " · Work" : ""}</span>
            <span className="hidden md:inline">{account.kind}</span>
          </p>
        </div>
        <button className="hidden rounded-[9px] px-2.5 py-1.5 text-[12.5px] font-bold text-[var(--muted-soft)] hover:bg-[#FBF6EC] md:block" onClick={onDisconnect} type="button">Disconnect</button>
      </div>
      <div className="grid gap-2 md:mt-3.5 md:grid-cols-2 md:gap-6 md:border-t md:border-[var(--line)] md:pt-3.5">
        <SyncRow icon={Mail} label="Email" enabled={account.emailSync} />
        <SyncRow icon={CalendarDays} label="Calendar" enabled={account.calendarSync} />
      </div>
    </article>
  );
}

function SyncRow({ icon: Icon, label, enabled }: { icon: typeof Mail; label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="hidden text-[#8B7A57] md:block" size={16} />
      <span className={`flex-1 text-[12.5px] font-bold md:text-[13.5px] ${enabled ? "text-[#42392E]" : "text-[var(--muted-soft)]"}`}>{label}</span>
      <span className={`relative h-[22px] w-[38px] shrink-0 rounded-full md:h-6 md:w-[42px] ${enabled ? "bg-[var(--positive)]" : "bg-[#E1D6BF]"}`}>
        <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] md:h-[18px] md:w-[18px] ${enabled ? "right-[3px]" : "left-[3px]"}`} />
      </span>
    </div>
  );
}

function badgeClass(tone: ConnectedAccount["tone"]) {
  if (tone === "primary") return "bg-[var(--secondary-container)] text-[#256B43]";
  if (tone === "work") return "bg-[var(--panel-strong)] text-[var(--accent-ink)]";
  return "bg-[var(--panel-deep)] text-[var(--muted)]";
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
