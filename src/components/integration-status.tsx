"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Mail, RefreshCcw, Zap } from "lucide-react";

type StatusResponse = {
  google: {
    connected: boolean;
    accountEmail?: string | null;
    accounts?: Array<{
      id: string;
      account_email: string | null;
      display_name: string | null;
      is_primary: boolean;
    }>;
    reason?: string;
    updatedAt?: string | null;
  };
};

type IntegrationStatusProps = {
  onSynced?: () => void;
};

export function IntegrationStatus({ onSynced }: IntegrationStatusProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/status");
      if (response.ok) {
        setStatus((await response.json()) as StatusResponse);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const connected = status?.google.connected;
  const accountCount = status?.google.accounts?.length ?? 0;

  async function syncWorkspace() {
    if (!connected) {
      return;
    }

    setSyncing(true);
    setMessage(null);

    try {
      const [gmail, calendar, market] = await Promise.all([
        fetch("/api/integrations/google/gmail/sync", { method: "POST" }),
        fetch("/api/integrations/google/calendar/sync", { method: "POST" }),
        fetch("/api/market/quotes?symbols=SPY,QQQ,VNQ"),
      ]);

      if (!gmail.ok || !calendar.ok || !market.ok) {
        throw new Error("One or more sync jobs failed.");
      }

      const [gmailData, calendarData] = (await Promise.all([
        gmail.json(),
        calendar.json(),
      ])) as Array<{ synced?: number }>;

      setMessage(
        `Synced ${gmailData.synced ?? 0} emails and ${calendarData.synced ?? 0} calendar events.`,
      );
      await loadStatus();
      onSynced?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[var(--accent)]">
            <Mail size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Google workspace</p>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--muted)]">
              {connected
                ? accountCount > 1
                  ? `${accountCount} Google accounts connected`
                  : status?.google.accountEmail ?? "Connected"
                : status?.google.reason ?? "Connect Google to sync Gmail and Calendar."}
            </p>
          </div>
        </div>
        {connected ? (
          <CheckCircle2 className="text-[var(--secondary)]" size={20} />
        ) : (
          <CircleAlert className="text-[var(--warning)]" size={20} />
        )}
      </div>
      <button
        className="mt-3 inline-flex h-8 items-center justify-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-[var(--muted)]"
        onClick={loadStatus}
        type="button"
      >
        <RefreshCcw size={14} />
        {loading ? "Checking..." : "Check status"}
      </button>
      {connected ? (
        <button
          className="ml-2 mt-3 inline-flex h-8 items-center justify-center gap-2 rounded-full bg-[var(--secondary-container)] px-3 text-xs font-semibold text-[var(--secondary)]"
          disabled={syncing}
          onClick={syncWorkspace}
          type="button"
        >
          <Zap size={14} />
          {syncing ? "Syncing..." : "Sync now"}
        </button>
      ) : null}
      <a
        className="ml-2 mt-3 inline-flex h-8 items-center justify-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-[var(--muted)]"
        href="/api/integrations/google/connect?next=/"
      >
        Connect account
      </a>
      {message ? <p className="mt-2 text-sm leading-5 text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
