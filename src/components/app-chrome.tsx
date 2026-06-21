"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  DatabaseZap,
  Home,
  LogOut,
  Mail,
  Menu,
  RefreshCcw,
  Search,
  Settings,
  Sparkles,
  UserCircle,
  WalletCards,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type DockItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  href?: string;
  options?: Array<{ label: string; href?: string; icon: LucideIcon }>;
};

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-[var(--background)]/88 px-5 backdrop-blur-xl">
      <button className="text-[var(--accent)]" aria-label="Open menu" type="button">
        <Menu size={25} />
      </button>
      <BrandLogo className="h-10 w-10" />
      <button className="text-[var(--accent)]" aria-label="Notifications" type="button">
        <Bell size={23} />
      </button>
      <a className="sr-only" href="/auth/signout">
        Sign out
      </a>
    </header>
  );
}

export function BottomDock({ active = "Home" }: { active?: "Home" | "Tools" }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const items: DockItem[] = [
    { label: "Home", icon: Home, active: active === "Home", href: "/" },
    {
      label: "Search",
      icon: Search,
      options: [
        { label: "Inbox", icon: Mail },
        { label: "Calendar", icon: CalendarDays },
      ],
    },
    {
      label: "AI",
      icon: Sparkles,
      options: [
        { label: "Generate brief", icon: Sparkles },
        { label: "Sync day", icon: RefreshCcw },
      ],
    },
    {
      label: "Tools",
      icon: Wrench,
      active: active === "Tools",
      options: [
        { label: "Real estate", href: "/real-estate", icon: Home },
        { label: "Ledger", href: "/ledger", icon: WalletCards },
        { label: "Coming soon", icon: DatabaseZap },
      ],
    },
    {
      label: "Settings",
      icon: Settings,
      options: [
        { label: "Profile", icon: UserCircle },
        { label: "Log out", href: "/auth/signout", icon: LogOut },
      ],
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--line)] bg-white/82 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl"
    >
      {items.map((item) => (
        <DockButton
          item={item}
          key={item.label}
          onOpenChange={setOpenMenu}
          open={openMenu === item.label}
        />
      ))}
    </nav>
  );
}

function DockButton({
  item,
  onOpenChange,
  open,
}: {
  item: DockItem;
  onOpenChange: (label: string | null) => void;
  open: boolean;
}) {
  const Icon = item.icon;
  const hasOptions = Boolean(item.options?.length);
  const buttonClass = `flex h-11 w-11 items-center justify-center rounded-full transition ${
    item.active || open
      ? "bg-[var(--secondary-container)] text-[var(--secondary)]"
      : "text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--accent)]"
  }`;

  return (
    <div
      className="group relative"
      onMouseEnter={() => {
        if (hasOptions) {
          onOpenChange(item.label);
        }
      }}
      onMouseLeave={() => {
        if (hasOptions) {
          onOpenChange(null);
        }
      }}
    >
      {item.href && !hasOptions ? (
        <Link aria-label={item.label} className={buttonClass} href={item.href}>
          <Icon size={21} />
        </Link>
      ) : (
        <button
          aria-expanded={hasOptions ? open : undefined}
          aria-label={item.label}
          className={buttonClass}
          onClick={() => {
            if (hasOptions) {
              onOpenChange(open ? null : item.label);
            }
          }}
          type="button"
        >
          <Icon size={21} />
        </button>
      )}

      {hasOptions ? (
        <>
          <div
            aria-hidden="true"
            className={`absolute bottom-11 left-1/2 h-6 min-w-44 -translate-x-1/2 ${
              open ? "pointer-events-auto" : "pointer-events-none"
            }`}
          />
          <div
            className={`absolute bottom-16 left-1/2 min-w-44 -translate-x-1/2 rounded-[1.25rem] border border-[var(--line)] bg-white p-2 shadow-[var(--shadow-soft)] transition ${
              open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            {item.options?.map((option) => {
              const OptionIcon = option.icon;
              const className =
                "flex h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm font-medium text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--accent)]";

              if (option.href) {
                return (
                  <Link className={className} href={option.href} key={option.label}>
                    <OptionIcon size={17} />
                    {option.label}
                  </Link>
                );
              }

              return (
                <button className={className} key={option.label} type="button">
                  <OptionIcon size={17} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      alt="Orange OS"
      className={className}
      height={48}
      priority
      src="/brand/citrus-logo-mark.svg"
      width={48}
    />
  );
}
