"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Grid2X2,
  Home,
  ListTodo,
  Mail,
  MessageCircle,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type AppSection = "overview" | "email" | "calendar" | "todo" | "realestate" | "ledger" | "assets" | "chengzi" | "profile" | "life" | "tool" | "setting";
type LegacySection = "Home" | "Mail" | "Tools";

type NavChild = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type AppChromeProps = {
  active?: AppSection | LegacySection;
  children: React.ReactNode;
};

const lifeItems: NavChild[] = [
  { label: "Email", href: "/email", icon: Mail },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "To-Do", href: "/todo", icon: ListTodo },
];

const toolItems: NavChild[] = [
  { label: "Real Estate", href: "/real-estate", icon: Home },
  { label: "The Ledger", href: "/ledger", icon: BarChart3 },
  { label: "Assets", href: "/assets", icon: CircleDollarSign },
];

const desktopItems: Array<NavChild & { key: AppSection; badge?: string }> = [
  { key: "overview", label: "Overview", href: "/", icon: Grid2X2 },
  { key: "email", label: "Email", href: "/email", icon: Mail, badge: "12" },
  { key: "calendar", label: "Calendar", href: "/calendar", icon: CalendarDays },
  { key: "todo", label: "To-Do", href: "/todo", icon: ListTodo, badge: "5" },
  { key: "realestate", label: "Real Estate", href: "/real-estate", icon: Home },
  { key: "ledger", label: "The Ledger", href: "/ledger", icon: BarChart3 },
  { key: "assets", label: "Assets", href: "/assets", icon: CircleDollarSign },
  { key: "chengzi", label: "Cheng Zi", href: "/chengzi", icon: MessageCircle, badge: "AI" },
];

function normalizeActive(active: AppChromeProps["active"], pathname: string): AppSection {
  if (active === "Home") return "overview";
  if (active === "Mail") return "email";
  if (active === "Tools") return "tool";
  if (pathname === "/email") return "email";
  if (pathname === "/calendar") return "calendar";
  if (pathname === "/todo") return "todo";
  if (pathname === "/real-estate") return "realestate";
  if (pathname === "/ledger") return "ledger";
  if (pathname === "/assets") return "assets";
  if (pathname === "/") return "overview";
  if (pathname === "/chengzi") return "chengzi";
  if (pathname === "/profile") return "profile";
  if (active === "overview" || active === "life" || active === "tool" || active === "setting" || active === "chengzi" || active === "profile") return active;
  return "overview";
}

export function AppChrome({ active, children }: AppChromeProps) {
  const pathname = usePathname();
  const current = normalizeActive(active, pathname);

  return (
    <div className="os-page">
      <div className="os-shell">
        <Sidebar active={current} pathname={pathname} />
        <main className="os-main">{children}</main>
      </div>
      <BottomDock active={current} pathname={pathname} />
    </div>
  );
}

function Sidebar({ active, pathname }: { active: AppSection; pathname: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--line)] bg-white px-4 py-6 lg:flex">
      <Link className="flex items-center gap-[11px] px-2 pb-[22px] no-underline" href="/">
        <BrandLogo className="h-[34px] w-[34px]" />
        <span className="flex flex-col leading-none">
          <span className="text-[18px] font-extrabold tracking-normal text-[var(--foreground)]">JU OS</span>
          <span className="mt-[3px] text-[11px] font-semibold text-[#A99B82]">Personal system</span>
        </span>
      </Link>

      <div className="os-label px-2 pb-2 pt-1">Workspace</div>
      <nav className="flex flex-col gap-[3px]" aria-label="Desktop navigation">
        {desktopItems.map((item) => (
          <SidebarLink
            active={active === item.key || pathname === item.href}
            badge={item.badge}
            href={item.href}
            icon={item.icon}
            key={item.href}
            label={item.label}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <SidebarLink href="/profile" icon={SlidersHorizontal} label="Settings" active={active === "profile"} />
        <div className="flex items-center gap-[11px]">
          <div className="flex flex-1 items-center gap-[11px] rounded-[14px] bg-[#F8F1E4] p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#F47E16,#E84B1B)] text-[15px] font-extrabold text-white">
              J
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13.5px] font-bold text-[var(--foreground)]">Ju</div>
              <div className="truncate text-[11.5px] text-[#A99B82]">Private workspace</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  label,
  icon: Icon,
  href,
  active,
  badge,
}: {
  label: string;
  icon: LucideIcon;
  href: string;
  active: boolean;
  badge?: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-[13px] px-3 py-[11px] text-sm no-underline transition ${
        active
          ? "bg-[var(--panel-strong)] font-bold text-[var(--accent-ink)]"
          : "font-semibold text-[var(--muted)] hover:bg-[#F2E8D6]"
      }`}
      href={href}
    >
      <Icon size={19} strokeWidth={1.9} />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-lg bg-[var(--panel-strong)] px-[7px] py-0.5 text-[10px] font-extrabold tracking-[0.04em] text-[var(--accent-ink)]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function BottomDock({
  active,
  pathname,
}: {
  active?: AppSection;
  pathname?: string;
}) {
  const [open, setOpen] = useState<"life" | "tool" | "setting" | null>(null);
  const currentPath = pathname ?? "";
  const settingItems: NavChild[] = [
    { label: "Profile", href: "/profile", icon: SlidersHorizontal },
    { label: "Sync", href: "/profile", icon: Settings2 },
    { label: "Log Out", href: "/auth/signout", icon: Settings2 },
  ];
  const sheet = open === "life"
    ? { title: "Life", items: lifeItems }
    : open === "tool"
      ? { title: "Tool", items: toolItems }
      : open === "setting"
        ? { title: "Setting", items: settingItems }
        : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-6 lg:hidden">
      {sheet ? (
        <>
          <button
            aria-label={`Close ${sheet.title} menu`}
            className="fixed inset-0 bottom-0 z-[-1] bg-[rgba(42,30,20,.32)]"
            onClick={() => setOpen(null)}
            type="button"
          />
          <div className="mb-3 rounded-[22px] border border-[var(--line)] bg-white p-2 shadow-[0_20px_46px_rgba(70,45,18,.26)]">
            <div className="flex items-center gap-2 px-3 pb-2 pt-[9px]">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-[var(--accent-ink)]">
                {sheet.title}
              </span>
              <span className="flex-1" />
              <button
                className="text-[11px] font-bold text-[var(--muted-soft)]"
                onClick={() => setOpen(null)}
                type="button"
              >
                Close
              </button>
            </div>
            {sheet.items.map((item) => (
              <Link
                className="flex items-center gap-3 rounded-[14px] px-3 py-[13px] no-underline transition hover:bg-[#FBF6EC]"
                href={item.href}
                key={`${sheet.title}-${item.label}`}
                onClick={() => setOpen(null)}
              >
                <span className="h-[9px] w-[9px] shrink-0 rounded-[3px] bg-[var(--accent)]" />
                <span className="flex-1 text-[14.5px] font-bold text-[var(--foreground)]">{item.label}</span>
                <ChevronRight size={17} strokeWidth={2.2} className="text-[#C4B79C]" />
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <nav
        aria-label="Mobile navigation"
        className="mx-auto flex w-fit items-center gap-1.5 rounded-[30px] border border-[#EDE3CF] bg-[rgba(255,255,255,.97)] px-3 py-2.5 shadow-[var(--shadow-soft)] backdrop-blur-xl"
      >
        <DockLink href="/" label="Overview" active={active === "overview" || currentPath === "/"} icon={Grid2X2} />
        <DockButton label="Life" active={active === "life" || ["email", "calendar", "todo"].includes(active ?? "") || open === "life"} onClick={() => setOpen(open === "life" ? null : "life")}>
          <CitrusLifeIcon className="h-[22px] w-[22px]" />
        </DockButton>
        <DockCustomLink href="/chengzi" label="Cheng Zi" active={active === "chengzi"}>
          <ChengZiDockIcon className="h-[30px] w-[30px]" />
        </DockCustomLink>
        <DockButton label="Tools" active={active === "tool" || ["realestate", "ledger", "assets"].includes(active ?? "") || open === "tool"} onClick={() => setOpen(open === "tool" ? null : "tool")}>
          <ToolDockIcon className="h-[22px] w-[22px]" />
        </DockButton>
        <DockButton label="Settings" active={active === "profile" || active === "setting" || open === "setting"} onClick={() => setOpen(open === "setting" ? null : "setting")}>
          <Settings2 size={22} strokeWidth={1.8} />
        </DockButton>
      </nav>
    </div>
  );
}

function DockLink({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: LucideIcon;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={`flex h-[42px] w-12 items-center justify-center rounded-[15px] no-underline transition hover:-translate-y-px ${
        active ? "bg-[var(--panel-strong)] text-[var(--accent-hot)]" : "text-[#A99B82]"
      }`}
      href={href}
    >
      <Icon size={22} strokeWidth={1.9} />
    </Link>
  );
}

function DockCustomLink({
  active,
  children,
  href,
  label,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={`flex h-[42px] w-12 items-center justify-center rounded-[15px] no-underline transition hover:-translate-y-px ${
        active ? "bg-[var(--panel-strong)] text-[var(--accent-hot)]" : "text-[#A99B82]"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}

function DockButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={`flex h-[42px] w-12 items-center justify-center rounded-[15px] transition hover:-translate-y-px ${
        active ? "bg-[var(--panel-strong)] text-[var(--accent-hot)]" : "text-[#A99B82]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      alt="JU OS"
      className={className}
      height={64}
      priority
      src="/brand/citrus-logo-mark-512.png"
      width={64}
    />
  );
}

function CitrusLifeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" strokeWidth="1.9" />
      <path d="M12 11.2C9.35 11 7.35 9.45 6 6.55 8.95 6.25 11.1 7.45 12 10" strokeWidth="1.8" />
      <path d="M12 11.2c2.65-.2 4.65-1.75 6-4.65-2.95-.3-5.1.9-6 3.45" strokeWidth="1.8" />
      <path d="M8.9 20h6.2" strokeWidth="1.9" />
    </svg>
  );
}

function ChengZiDockIcon({ className }: { className?: string }) {
  return (
    <BrandLogo className={className} />
  );
}

function ToolDockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" strokeWidth="1.8" />
    </svg>
  );
}
