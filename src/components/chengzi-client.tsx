"use client";

import { useState } from "react";
import Image from "next/image";
import { Code2, Send, Sparkles } from "lucide-react";
import { AppChrome } from "@/components/app-chrome";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const seedMessages: Message[] = [
  {
    id: "m1",
    role: "assistant",
    text: "Morning, Ju. It's a lighter Saturday - the renovation walkthrough at 11 is really the only anchor. Want me to walk you through the day?",
  },
  {
    id: "m2",
    role: "user",
    text: "Yes - what should I focus on today?",
  },
  {
    id: "m3",
    role: "assistant",
    text: "Three things matter today: the walkthrough, the lender reply, and the insurance premium. Clear the money items early so the walkthrough has your full attention.",
  },
];

export function ChengZiClient() {
  const [mode, setMode] = useState<"Quick Capture" | "Ask" | "Draft">("Quick Capture");
  const [messages, setMessages] = useState(seedMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function sendMessage() {
    const value = draft.trim();
    if (!value || sending) return;

    const userMessage: Message = { id: `u-${Date.now()}`, role: "user", text: value };
    setMessages((current) => [...current, userMessage]);
    setDraft("");

    if (mode === "Quick Capture") {
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "Captured. I can sort that into the right part of JU OS when you are ready.",
        },
      ]);
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/chengzi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: [...messages, userMessage] }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Cheng Zi could not answer right now.");
      }

      const responseText = payload.message;
      setMessages((current) => [...current, { id: `a-${Date.now()}`, role: "assistant", text: responseText }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: error instanceof Error ? error.message : "Cheng Zi could not answer right now.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <AppChrome active="chengzi">
      <div className="mx-auto flex h-[calc(100vh-56px)] max-w-[1158px] flex-col overflow-hidden rounded-[26px] border border-[var(--line-strong)] bg-[var(--background)] shadow-[0_2px_6px_rgba(80,50,20,.06),0_30px_70px_rgba(80,50,20,.12)]">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] bg-[var(--background)] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#F4D9BE] bg-[#FFF1E2]">
              <Image alt="" height={24} src="/brand/citrus-logo-mark-512.png" width={24} />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-[var(--foreground)]">Cheng Zi</h1>
              <p className="mt-px flex items-center gap-1.5 text-xs font-semibold text-[var(--muted-soft)]">
                <span className="h-[7px] w-[7px] rounded-full bg-[#3E9E66]" />
                Connected to your day
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2.5">
            <SelectBox label="Provider" value="OpenAI" />
            <SelectBox label="Model" value="Balanced" />
            <button className="os-secondary-button flex h-[42px] w-[42px] items-center justify-center text-[var(--muted)]" type="button" aria-label="Developer mode">
              <Code2 size={17} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-5 md:px-7">
          <div className="flex flex-col gap-4">
            {messages.map((message) =>
              message.role === "assistant" ? (
                <div className="flex items-start gap-3" key={message.id}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[#F4D9BE] bg-[#FFF1E2]">
                    <Image alt="" height={22} src="/brand/citrus-logo-mark-512.png" width={22} />
                  </div>
                  <div className="max-w-[84%] rounded-[4px_18px_18px_18px] border border-[var(--line)] bg-white px-4 py-3 text-[14.5px] leading-[1.6] text-[#42392E] shadow-[0_4px_14px_rgba(90,55,20,.04)]">
                    {message.text}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end" key={message.id}>
                  <div className="max-w-[70%] rounded-[18px_4px_18px_18px] bg-[linear-gradient(135deg,#F47E16,#E84B1B)] px-4 py-3 text-[14.5px] font-medium leading-[1.5] text-white shadow-[0_6px_16px_rgba(224,70,26,.22)]">
                    {message.text}
                  </div>
                </div>
              ),
            )}
          </div>
        </main>

        <footer className="border-t border-[var(--line)] bg-[var(--background)] px-4 py-4 md:px-7">
          <div className="mb-3 inline-flex rounded-[13px] bg-[var(--panel-deep)] p-[3px]">
            {(["Quick Capture", "Ask", "Draft"] as const).map((nextMode) => (
              <button
                className={`rounded-[10px] px-4 py-2 text-[13px] font-bold transition ${
                  mode === nextMode ? "bg-white text-[var(--accent-ink)] shadow-[0_1px_3px_rgba(120,70,20,.12)]" : "text-[#8B8173]"
                }`}
                key={nextMode}
                onClick={() => setMode(nextMode)}
                type="button"
              >
                {nextMode}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 rounded-[18px] border border-[var(--line-strong)] bg-white py-2 pl-4 pr-2 shadow-[0_8px_24px_rgba(90,55,20,.06)]">
            <Sparkles size={18} className="shrink-0 text-[var(--muted-faint)]" />
            <input
              className="min-w-0 flex-1 bg-transparent text-[14.5px] font-medium outline-none placeholder:text-[#A99B82]"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void sendMessage();
              }}
              placeholder={mode === "Quick Capture" ? "Capture a note, task or event for Cheng Zi..." : mode === "Ask" ? "Ask Cheng Zi anything about your day..." : "Tell Cheng Zi what to draft..."}
              value={draft}
            />
            <button className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-[linear-gradient(135deg,#F47E16,#E84B1B)] text-white shadow-[0_6px_14px_rgba(224,70,26,.3)] disabled:cursor-wait disabled:opacity-70" disabled={sending} onClick={() => void sendMessage()} type="button" aria-label="Send">
              <Send size={19} />
            </button>
          </div>
        </footer>
      </div>
    </AppChrome>
  );
}

function SelectBox({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid min-w-[160px] gap-1.5">
      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--muted-faint)]">{label}</span>
      <span className="flex items-center justify-between rounded-[11px] border border-[var(--line-strong)] bg-white px-3 py-2.5 text-[13px] font-bold">
        {value}
        <span className="text-[var(--muted-soft)]">⌄</span>
      </span>
    </label>
  );
}
