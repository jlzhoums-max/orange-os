import Link from "next/link";
import { ArrowLeft, CalendarDays, Inbox, ListTodo, Tags } from "lucide-react";
import { AppChrome } from "@/components/app-chrome";
import { TodoTool } from "@/components/todo-tool";

export default function TodoPage() {
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
                <ListTodo size={24} />
              </div>
              <h1 className="text-4xl font-bold tracking-normal text-balance sm:text-5xl">
                To-do
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                Capture tasks, organize projects, plan the day, and keep next actions moving.
              </p>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["Inbox", "Fast capture for anything unfinished.", Inbox],
              ["Today", "Choose what actually matters now.", CalendarDays],
              ["Labels", "Filter tasks by context and energy.", Tags],
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

        <TodoTool />
      </div>
    </AppChrome>
  );
}
