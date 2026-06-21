"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Command,
  DatabaseZap,
  Home,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  Plus,
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

type AppChromeProps = {
  active?: "Home" | "Mail" | "Tools";
  children: React.ReactNode;
};

export function AppChrome({ active = "Home", children }: AppChromeProps) {
  return (
    <div className="os-page">
      <div className="os-shell">
        <Sidebar active={active} />
        <div className="min-w-0">
          <AppTopbar />
          <main className="os-main">{children}</main>
        </div>
      </div>
      <BottomDock active={active} />
    </div>
  );
}

export function AppTopbar() {
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--background)]/88 px-3 py-2 backdrop-blur-xl lg:px-5">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
        <button className="text-[var(--accent)] lg:hidden" aria-label="Open menu" type="button">
          <Menu size={22} />
        </button>

        <label className="hidden h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-[var(--line)] bg-[rgba(255,253,248,0.78)] px-3 shadow-[0_8px_22px_rgba(110,56,13,0.05)] lg:flex">
          <Search size={17} className="text-[var(--muted)]" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-soft)]"
            placeholder="Search anything..."
            type="search"
          />
          <span className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-white/70 px-1.5 py-0.5 font-mono text-[11px] text-[var(--muted)]">
            <Command size={12} /> K
          </span>
        </label>

        <BrandLogo className="h-8 w-8 lg:hidden" />

        <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
          <div className="hidden items-center gap-2 md:flex">
            <CalendarDays size={17} className="text-[var(--muted)]" />
            <span suppressHydrationWarning>{date}</span>
          </div>
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[rgba(255,253,248,0.78)] text-[var(--foreground)]"
            aria-label="Notifications"
            type="button"
          >
            <Bell size={17} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--accent-hot)] ring-2 ring-[var(--surface)]" />
          </button>
          <Link
            className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-[rgba(255,253,248,0.78)] py-1 pl-1 pr-2.5 md:flex"
            href="/"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--secondary-container)] text-xs font-bold text-[var(--secondary)]">
              J
            </span>
            <span className="font-semibold">Justin</span>
            <ChevronDown size={15} className="text-[var(--muted)]" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ active }: { active: "Home" | "Mail" | "Tools" }) {
  const pathname = usePathname();
  const primary = [
    { label: "Today", href: "/", icon: LayoutDashboard, active: active === "Home" && pathname === "/" },
    { label: "Calendar", icon: CalendarDays },
    { label: "Inbox", href: "/email", icon: Mail, active: active === "Mail" || pathname === "/email" },
    { label: "AI Brief", icon: Sparkles },
  ];
  const tools = [
    { label: "To-do", href: "/todo", icon: ListTodo },
    { label: "Real Estate", href: "/real-estate", icon: Home },
    { label: "Ledger", href: "/ledger", icon: WalletCards },
    { label: "Future Tools", icon: DatabaseZap },
  ];

  return (
    <aside className="sticky top-0 hidden h-screen border-r border-[var(--line)] bg-[rgba(255,244,230,0.52)] p-4 backdrop-blur-xl lg:flex lg:flex-col">
      <Link className="flex items-center gap-3" href="/">
        <BrandLogo className="h-9 w-9" />
        <div>
          <p className="font-bold leading-tight">Orange OS</p>
          <p className="text-xs text-[var(--muted)]">Daily tools</p>
        </div>
      </Link>

      <button className="os-primary-button mt-5 flex h-10 items-center justify-center gap-2 px-3 text-sm font-semibold" type="button">
        <Plus size={17} />
        Quick capture
      </button>

      <nav className="mt-5 grid gap-1" aria-label="Desktop navigation">
        {primary.map((item) => (
          <SidebarLink key={item.label} {...item} />
        ))}
      </nav>

      <div className="mt-5">
        <p className="os-label px-3">Tools</p>
        <nav className="mt-2 grid gap-1" aria-label="Tool navigation">
          {tools.map((item) => (
            <SidebarLink key={item.label} {...item} active={Boolean(item.href && pathname === item.href)} />
          ))}
        </nav>
      </div>

      <div className="mt-auto grid gap-2">
        <SidebarLink label="Settings" icon={Settings} />
        <Link
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-white/62 hover:text-[var(--accent)]"
          href="/auth/signout"
        >
          <LogOut size={18} />
          Log out
        </Link>
      </div>
    </aside>
  );
}

function SidebarLink({
  label,
  icon: Icon,
  href,
  active = false,
}: {
  label: string;
  icon: LucideIcon;
  href?: string;
  active?: boolean;
}) {
  const className = `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    active
      ? "bg-white text-[var(--accent)] shadow-[0_9px_26px_rgba(110,56,13,0.07)]"
      : "text-[var(--muted)] hover:bg-white/62 hover:text-[var(--accent)]"
  }`;
  const content = (
    <>
      {active ? <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> : null}
      <Icon size={18} />
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <button className={className} type="button">
      {content}
    </button>
  );
}

export function BottomDock({ active = "Home" }: { active?: "Home" | "Mail" | "Tools" }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const pathname = usePathname();
  const items: DockItem[] = [
    { label: "Home", icon: LayoutDashboard, active: active === "Home", href: "/" },
    {
      label: "Search",
      icon: Search,
      options: [
        { label: "Inbox", href: "/email", icon: Mail },
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
        { label: "To-do", href: "/todo", icon: ListTodo },
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
      className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[rgba(255,253,248,0.92)] px-2 py-2 shadow-[var(--shadow-soft)] backdrop-blur-xl lg:hidden"
    >
      {items.map((item) => (
        <DockButton
          item={item}
          key={item.label}
          onOpenChange={setOpenMenu}
          open={openMenu === item.label}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}

function DockButton({
  item,
  onOpenChange,
  open,
  pathname,
}: {
  item: DockItem;
  onOpenChange: (label: string | null) => void;
  open: boolean;
  pathname: string;
}) {
  const Icon = item.icon;
  const hasOptions = Boolean(item.options?.length);
  const isActive = Boolean(item.active);
  const buttonClass = `flex h-10 w-10 items-center justify-center rounded-full transition ${
    isActive
      ? "border border-[rgba(244,126,22,0.24)] bg-[rgba(244,126,22,0.14)] text-[var(--accent)] shadow-[0_10px_20px_rgba(232,75,27,0.12)]"
      : open
      ? "bg-[var(--panel-strong)] text-[var(--accent)]"
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
        <Link aria-current={isActive ? "page" : undefined} aria-label={item.label} className={buttonClass} href={item.href}>
          <Icon size={19} />
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
          <Icon size={19} />
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
            className={`absolute bottom-16 left-1/2 min-w-44 -translate-x-1/2 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft)] transition ${
              open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            {item.options?.map((option) => {
              const OptionIcon = option.icon;
              const optionActive = Boolean(option.href && pathname === option.href);
              const className = `flex h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm font-medium transition ${
                optionActive
                  ? "bg-[rgba(244,126,22,0.12)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--accent)]"
              }`;

              if (option.href) {
                return (
                  <Link aria-current={optionActive ? "page" : undefined} className={className} href={option.href} key={option.label}>
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
