"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  Check,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { TodoTask } from "@/lib/todos/types";

type TodoView = "today" | "upcoming" | "lists";

type TodoForm = {
  title: string;
  project: string;
  dueDate: string;
  amount: string;
};

const storageKey = "orange-os.todo-tool.v1";
const projects = ["Real Estate", "Finance", "Home", "Personal"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const seedTasks: TodoTask[] = [
  {
    id: "task-insurance",
    title: "Pay home insurance premium",
    notes: "",
    project: "Finance",
    dueDate: todayKey(),
    labels: ["Today", "Finance"],
    completed: false,
    createdAt: new Date().toISOString(),
    amount: "$2,400",
    flagged: true,
  },
  {
    id: "task-lender",
    title: "Reply to lender re: rate lock",
    notes: "",
    project: "Real Estate",
    dueDate: todayKey(),
    labels: ["Today", "Real Estate"],
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-tile",
    title: "Confirm tile order for Maple St",
    notes: "",
    project: "Real Estate",
    dueDate: todayKey(),
    labels: ["Today", "Real Estate"],
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-walkthrough",
    title: "Schedule walkthrough",
    notes: "",
    project: "Real Estate",
    dueDate: todayKey(),
    labels: ["Today"],
    completed: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-receipts",
    title: "Send Oak Ave receipts to bookkeeper",
    notes: "",
    project: "Finance",
    dueDate: todayKey(),
    labels: ["Finance"],
    completed: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-paint",
    title: "Review Oak Ave paint samples",
    notes: "",
    project: "Home",
    dueDate: addDays(1),
    labels: ["Home"],
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-lock",
    title: "Lock mortgage rate with lender",
    notes: "",
    project: "Real Estate",
    dueDate: addDays(2),
    labels: ["Real Estate"],
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-deposit",
    title: "Pay contractor deposit",
    notes: "",
    project: "Real Estate",
    dueDate: addDays(4),
    labels: ["Real Estate"],
    completed: false,
    createdAt: new Date().toISOString(),
    amount: "$8,000",
  },
  {
    id: "task-mileage",
    title: "Submit Q2 mileage log",
    notes: "",
    project: "Finance",
    dueDate: addDays(6),
    labels: ["Finance"],
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-solar",
    title: "Research solar quotes",
    notes: "",
    project: "Home",
    dueDate: "",
    labels: ["Someday"],
    completed: false,
    createdAt: new Date().toISOString(),
    someday: true,
  },
  {
    id: "task-budget",
    title: "Plan Q3 budget",
    notes: "",
    project: "Finance",
    dueDate: "",
    labels: ["Someday"],
    completed: false,
    createdAt: new Date().toISOString(),
    someday: true,
  },
];

const emptyForm: TodoForm = {
  title: "",
  project: "Real Estate",
  dueDate: todayKey(),
  amount: "",
};

function createId() {
  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function displayDate(value: string) {
  if (!value) return "Someday";
  if (value === todayKey()) return "Today";
  if (value === addDays(1)) return "Tomorrow";

  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
  }).format(date);
}

function fullTodayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function normalizeTask(task: TodoTask): TodoTask {
  const fallbackProject = task.project === "Inbox" || task.project === "Work" ? "Personal" : task.project;
  return {
    ...task,
    project: projects.includes(fallbackProject) ? fallbackProject : "Personal",
    labels: Array.isArray(task.labels) ? task.labels : [],
    amount: task.amount ?? "",
    flagged: task.flagged ?? task.priority === 1,
    someday: task.someday ?? !task.dueDate,
  };
}

function projectColor(project: string) {
  if (project === "Real Estate") return "bg-[#E0461A]";
  if (project === "Finance") return "bg-[#3E9E66]";
  if (project === "Home") return "bg-[#C9A14A]";
  return "bg-[#B8A77F]";
}

function tagClass(label: string) {
  if (label === "Today") return "bg-[#FCEBDD] text-[#C24A12]";
  if (label === "Finance") return "bg-[#E6F0E5] text-[#256B43]";
  if (label === "Real Estate") return "bg-[#F8E2D0] text-[#9A3A0E]";
  return "bg-[#F1E8D8] text-[#8B8173]";
}

export function TodoTool() {
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loadedStoredTasks, setLoadedStoredTasks] = useState(false);
  const [storageMode, setStorageMode] = useState<"supabase" | "local">("supabase");
  const [form, setForm] = useState<TodoForm>(emptyForm);
  const [adding, setAdding] = useState(false);
  const [mobileView, setMobileView] = useState<TodoView>("today");

  useEffect(() => {
    function loadLocalTasks() {
      const stored = window.localStorage.getItem(storageKey);

      if (!stored) {
        setTasks(seedTasks);
        setLoadedStoredTasks(true);
        return;
      }

      try {
        const parsed = JSON.parse(stored) as TodoTask[];
        setTasks(Array.isArray(parsed) ? parsed.map(normalizeTask) : seedTasks);
      } catch {
        window.localStorage.removeItem(storageKey);
        setTasks(seedTasks);
      } finally {
        setLoadedStoredTasks(true);
      }
    }

    const loadHandle = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/todos", { cache: "no-store" });
        if (!response.ok) {
          setStorageMode("local");
          loadLocalTasks();
          return;
        }

        const payload = (await response.json()) as { tasks: TodoTask[] };
        setStorageMode("supabase");
        setTasks((payload.tasks ?? []).map(normalizeTask));
        setLoadedStoredTasks(true);
      } catch {
        setStorageMode("local");
        loadLocalTasks();
      }
    }, 0);

    return () => window.clearTimeout(loadHandle);
  }, []);

  useEffect(() => {
    if (!loadedStoredTasks || storageMode !== "local") return;
    window.localStorage.setItem(storageKey, JSON.stringify(tasks));
  }, [loadedStoredTasks, storageMode, tasks]);

  const todayTasks = useMemo(
    () => tasks.filter((task) => task.dueDate === todayKey() && !task.someday),
    [tasks],
  );
  const upcomingTasks = useMemo(
    () => tasks.filter((task) => !task.completed && !task.someday && task.dueDate && task.dueDate > todayKey()).sort((first, second) => first.dueDate.localeCompare(second.dueDate)),
    [tasks],
  );
  const somedayTasks = useMemo(
    () => tasks.filter((task) => !task.completed && task.someday),
    [tasks],
  );
  const todayDone = todayTasks.filter((task) => task.completed).length;
  const todayLeft = todayTasks.length - todayDone;
  const progress = todayTasks.length ? Math.round((todayDone / todayTasks.length) * 100) : 0;

  const listCounts = useMemo(
    () =>
      projects.map((project) => ({
        project,
        count: tasks.filter((task) => !task.completed && task.project === project).length,
      })),
    [tasks],
  );

  async function saveTask() {
    const title = form.title.trim();
    if (!title) return;

    const project = form.project;
    const dueDate = form.dueDate;
    const nextTask: TodoTask = {
      id: createId(),
      title,
      notes: "",
      project,
      dueDate,
      priority: 2,
      labels: dueDate === todayKey() ? ["Today", project] : [project],
      completed: false,
      createdAt: new Date().toISOString(),
      amount: form.amount.trim(),
      flagged: false,
      someday: !dueDate,
    };

    if (storageMode === "supabase") {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextTask),
      });

      if (response.ok) {
        const payload = (await response.json()) as { task: TodoTask };
        setTasks((current) => [normalizeTask(payload.task), ...current]);
      } else {
        setTasks((current) => [nextTask, ...current]);
      }
    } else {
      setTasks((current) => [nextTask, ...current]);
    }
    setForm(emptyForm);
    setAdding(false);
    setMobileView(dueDate === todayKey() ? "today" : "upcoming");
  }

  async function toggleTask(taskId: string) {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) return;
    const completed = !currentTask.completed;

    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, completed } : task)),
    );

    if (storageMode !== "supabase") return;

    const response = await fetch(`/api/todos/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });

    if (!response.ok) {
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, completed: currentTask.completed } : task)),
      );
    }
  }

  async function deleteTask(taskId: string) {
    const currentTask = tasks.find((task) => task.id === taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));

    if (storageMode !== "supabase" || !currentTask) return;

    const response = await fetch(`/api/todos/${taskId}`, { method: "DELETE" });
    if (!response.ok) {
      setTasks((current) => [currentTask, ...current]);
    }
  }

  return (
    <section className="mx-auto max-w-[1158px]">
      <header className="mb-[22px] flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[25px] font-extrabold tracking-normal text-[var(--foreground)] md:text-[25px]">To-Do</h1>
          <p className="mt-[3px] text-[13.5px] font-semibold text-[var(--muted-soft)]">
            <span className="md:hidden">{todayLeft} left today</span>
            <span className="hidden md:inline">
              {fullTodayLabel()} · {todayLeft} task{todayLeft === 1 ? "" : "s"} left today
            </span>
          </p>
        </div>
        <button
          className="os-primary-button hidden h-11 w-fit items-center gap-2 px-[18px] text-sm font-bold md:inline-flex"
          onClick={() => setAdding((current) => !current)}
          type="button"
        >
          {adding ? <X size={16} /> : <Plus size={16} />}
          Add task
        </button>
        <ProgressRing done={todayDone} total={todayTasks.length} />
      </header>

      {adding ? (
        <section className="mb-[18px] rounded-[22px] border border-[var(--line)] bg-white p-4 shadow-[0_1px_2px_rgba(60,40,20,.04),0_10px_26px_rgba(90,55,20,.05)]">
          <div className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_8rem_auto] md:items-center">
            <input
              className="os-input h-11 px-4 text-sm font-semibold"
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveTask();
              }}
              placeholder="Add a task"
              value={form.title}
            />
            <select className="os-input h-11 px-3 text-sm font-semibold" onChange={(event) => setForm({ ...form, project: event.target.value })} value={form.project}>
              {projects.map((project) => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
            <input className="os-input h-11 px-3 text-sm font-semibold" onChange={(event) => setForm({ ...form, dueDate: event.target.value })} type="date" value={form.dueDate} />
            <input className="os-input h-11 px-3 text-sm font-semibold" onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="$ optional" value={form.amount} />
            <button className="os-primary-button h-11 px-5 text-sm font-bold" onClick={saveTask} type="button">
              Add
            </button>
          </div>
        </section>
      ) : null}

      <div className="mb-3 flex gap-2 overflow-x-auto md:hidden">
        <MobileTab active={mobileView === "today"} label="Today" onClick={() => setMobileView("today")} />
        <MobileTab active={mobileView === "upcoming"} label="Upcoming" onClick={() => setMobileView("upcoming")} />
        <MobileTab active={mobileView === "lists"} label="Lists" onClick={() => setMobileView("lists")} />
      </div>

      <div className="md:hidden">
        {mobileView === "today" ? <MobileTaskList tasks={todayTasks} onDelete={deleteTask} onToggle={toggleTask} /> : null}
        {mobileView === "upcoming" ? <MobileTaskList showDate tasks={upcomingTasks} onDelete={deleteTask} onToggle={toggleTask} /> : null}
        {mobileView === "lists" ? (
          <div className="grid gap-4">
            <MobileLists listCounts={listCounts} />
            <MobileSomeday tasks={somedayTasks} onDelete={deleteTask} onToggle={toggleTask} />
          </div>
        ) : null}
      </div>

      <button
        aria-label="Add task"
        className="os-primary-button fixed bottom-28 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-[18px] p-0 shadow-[0_10px_24px_rgba(224,70,26,.4)] md:hidden"
        onClick={() => setAdding((current) => !current)}
        type="button"
      >
        {adding ? <X size={24} /> : <Plus size={24} />}
      </button>

      <div className="hidden gap-[22px] md:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <TaskPanel
            completed={todayDone}
            progress={progress}
            subtitle={`${todayDone} of ${todayTasks.length} done`}
            tasks={todayTasks}
            title="Today"
            onDelete={deleteTask}
            onToggle={toggleTask}
          />

          <section className={`${mobileView === "today" ? "hidden md:block" : "block"} rounded-[22px] border border-[var(--line)] bg-white p-[22px] shadow-[0_1px_2px_rgba(60,40,20,.04),0_10px_26px_rgba(90,55,20,.05)]`}>
            <h2 className="text-base font-extrabold text-[var(--foreground)]">Upcoming</h2>
            <div className="mt-2.5 grid gap-1">
              {upcomingTasks.length ? upcomingTasks.map((task) => (
                <TaskRow compact key={task.id} task={task} onDelete={deleteTask} onToggle={toggleTask} />
              )) : (
                <p className="px-1 py-3 text-sm font-semibold text-[var(--muted)]">Nothing coming up.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-[18px]">
          <section className="rounded-[22px] bg-[linear-gradient(135deg,#F4831C,#E0461A)] p-[22px] shadow-[0_12px_30px_rgba(224,70,26,.24)]">
            <div className="mb-[11px] flex items-center gap-2">
              <SparkleMark />
              <span className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[#FFE3CC]">Today&apos;s focus</span>
            </div>
            <p className="text-[17px] font-bold leading-[1.4] text-white">
              Clear the two money items first so the rest of the day has less drag.
            </p>
          </section>

          <section className="rounded-[22px] border border-[var(--line)] bg-white p-[22px] shadow-[0_1px_2px_rgba(60,40,20,.04),0_10px_26px_rgba(90,55,20,.05)]">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">Lists</h2>
            <div className="mt-3.5 grid gap-[13px]">
              {listCounts.map((item) => (
                <div className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-[#FBF6EC]" key={item.project}>
                  <span className={`h-3 w-3 shrink-0 rounded-[5px] ${projectColor(item.project)}`} />
                  <span className="min-w-0 flex-1 text-sm font-bold text-[var(--foreground)]">{item.project}</span>
                  <span className="text-[12.5px] font-bold text-[var(--muted-soft)]">{item.count} open</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[22px] border border-[var(--line)] bg-white p-[22px] shadow-[0_1px_2px_rgba(60,40,20,.04),0_10px_26px_rgba(90,55,20,.05)]">
            <h2 className="text-base font-extrabold text-[var(--foreground)]">Someday</h2>
            <div className="mt-2.5 grid gap-1">
              {somedayTasks.length ? somedayTasks.map((task) => (
                <TaskRow compact muted key={task.id} task={task} onDelete={deleteTask} onToggle={toggleTask} />
              )) : (
                <p className="px-1 py-3 text-sm font-semibold text-[var(--muted)]">No someday tasks.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function MobileTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-[12.5px] font-extrabold transition ${
        active ? "bg-[linear-gradient(135deg,#F47E16,#E84B1B)] text-white" : "bg-[#F1E8D8] text-[#8B8173]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const progress = total ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full md:hidden"
      style={{ background: `conic-gradient(#3E9E66 0% ${progress}%, #EDE3D0 ${progress}% 100%)` }}
    >
      <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[var(--background)]">
        <span className="text-sm font-extrabold text-[#2E7D52]">{done}/{total}</span>
      </div>
    </div>
  );
}

function MobileTaskList({
  showDate,
  tasks,
  onDelete,
  onToggle,
}: {
  showDate?: boolean;
  tasks: TodoTask[];
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
}) {
  if (!tasks.length) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white px-5 py-10 text-center shadow-[0_6px_16px_rgba(90,55,20,.04)]">
        <CheckCircle2 className="mx-auto text-[#3E9E66]" size={28} />
        <p className="mt-2 text-sm font-bold text-[var(--foreground)]">Nothing here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5 pb-28">
      {tasks.map((task) => (
        <MobileTaskCard showDate={showDate} key={task.id} task={task} onDelete={onDelete} onToggle={onToggle} />
      ))}
    </div>
  );
}

function MobileTaskCard({
  showDate,
  task,
  onDelete,
  onToggle,
}: {
  showDate?: boolean;
  task: TodoTask;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-3.5 shadow-[0_6px_16px_rgba(90,55,20,.04)] ${task.completed ? "opacity-55" : ""}`}>
      <button
        aria-label={task.completed ? "Mark incomplete" : "Complete task"}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
        onClick={() => onToggle(task.id)}
        type="button"
      >
        {task.completed ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#8FC7A7] text-white">
            <Check size={14} strokeWidth={3.2} />
          </span>
        ) : (
          <span className={`h-6 w-6 rounded-lg border-2 ${task.flagged ? "border-[#F47E16]" : "border-[#D8CDB6]"}`} />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-[14.5px] font-bold leading-5 text-[var(--foreground)] ${task.completed ? "text-[var(--muted-soft)] line-through" : ""}`}>
          {task.title}
        </div>
        {!task.completed ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {(task.dueDate === todayKey() ? ["Today"] : []).concat(task.amount && !showDate ? [task.amount] : [task.project]).filter(Boolean).slice(0, 2).map((label) => (
              <span className={`rounded-[7px] px-2 py-0.5 text-[10.5px] font-bold ${label.startsWith("$") ? "bg-[#E6F0E5] text-[#256B43]" : tagClass(label)}`} key={label}>
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {showDate ? <span className="shrink-0 text-[11.5px] font-bold text-[#8B8173]">{displayDate(task.dueDate)}</span> : null}
      {task.flagged && !task.completed ? <Bookmark className="shrink-0 text-[#E0461A]" size={16} fill="currentColor" /> : null}
      <button aria-label="Delete task" className="sr-only" onClick={() => onDelete(task.id)} type="button">
        Delete task
      </button>
    </div>
  );
}

function MobileLists({ listCounts }: { listCounts: Array<{ project: string; count: number }> }) {
  return (
    <section className="rounded-[22px] border border-[var(--line)] bg-white p-[22px] shadow-[0_6px_16px_rgba(90,55,20,.04)]">
      <h2 className="text-base font-extrabold text-[var(--foreground)]">Lists</h2>
      <div className="mt-3.5 grid gap-[13px]">
        {listCounts.map((item) => (
          <div className="flex items-center gap-3 rounded-xl p-1.5" key={item.project}>
            <span className={`h-3 w-3 shrink-0 rounded-[5px] ${projectColor(item.project)}`} />
            <span className="min-w-0 flex-1 text-sm font-bold text-[var(--foreground)]">{item.project}</span>
            <span className="text-[12.5px] font-bold text-[var(--muted-soft)]">{item.count} open</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MobileSomeday({
  tasks,
  onDelete,
  onToggle,
}: {
  tasks: TodoTask[];
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
}) {
  return (
    <section className="rounded-[22px] border border-[var(--line)] bg-white p-[22px] shadow-[0_6px_16px_rgba(90,55,20,.04)]">
      <h2 className="text-base font-extrabold text-[var(--foreground)]">Someday</h2>
      <div className="mt-3 grid gap-2">
        {tasks.length ? tasks.map((task) => (
          <MobileTaskCard key={task.id} task={task} onDelete={onDelete} onToggle={onToggle} />
        )) : (
          <p className="text-sm font-semibold text-[var(--muted)]">No someday tasks.</p>
        )}
      </div>
    </section>
  );
}

function TaskPanel({
  completed,
  progress,
  subtitle,
  tasks,
  title,
  onDelete,
  onToggle,
}: {
  completed: number;
  progress: number;
  subtitle: string;
  tasks: TodoTask[];
  title: string;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
}) {
  return (
    <section className="rounded-[22px] border border-[var(--line)] bg-white p-[22px] shadow-[0_1px_2px_rgba(60,40,20,.04),0_10px_26px_rgba(90,55,20,.05)]">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-base font-extrabold text-[var(--foreground)]">{title}</h2>
        <span className="text-[12.5px] font-bold text-[var(--muted-soft)]">{subtitle}</span>
      </div>
      <div className="mb-3 h-[7px] overflow-hidden rounded bg-[#EDE3D0]">
        <div className="h-full rounded bg-[linear-gradient(90deg,#3E9E66,#5BB57F)]" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid gap-1">
        {tasks.length ? tasks.map((task) => (
          <TaskRow key={task.id} task={task} onDelete={onDelete} onToggle={onToggle} />
        )) : (
          <div className="py-9 text-center">
            <CheckCircle2 className="mx-auto text-[#3E9E66]" size={28} />
            <p className="mt-2 text-sm font-bold text-[var(--foreground)]">Today is clear.</p>
          </div>
        )}
      </div>
      <span className="sr-only">{completed} completed</span>
    </section>
  );
}

function TaskRow({
  compact,
  muted,
  task,
  onDelete,
  onToggle,
}: {
  compact?: boolean;
  muted?: boolean;
  task: TodoTask;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
}) {
  const isMuted = muted || task.completed;

  return (
    <div
      className={`group flex items-center gap-[13px] rounded-[13px] transition hover:bg-[#FBF6EC] ${
        compact ? "px-1.5 py-[9px]" : "px-2.5 py-[11px]"
      } ${isMuted ? "opacity-55" : ""}`}
    >
      <button
        aria-label={task.completed ? "Mark incomplete" : "Complete task"}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
        onClick={() => onToggle(task.id)}
        type="button"
      >
        {task.completed ? (
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-[#3E9E66] text-white">
            <Check size={14} strokeWidth={3.2} />
          </span>
        ) : (
          <span className={`h-[22px] w-[22px] rounded-[7px] border-2 ${task.flagged ? "border-[#F47E16]" : "border-[#D8CDB6]"}`}>
            <Circle className="sr-only" size={1} />
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-[14.5px] font-bold text-[var(--foreground)] ${task.completed ? "text-[var(--muted-soft)] line-through" : ""}`}>
          {task.title}
          {compact && task.amount ? <span className="font-mono text-xs font-medium text-[#8B8173]"> · {task.amount}</span> : null}
        </div>
        {!compact && !task.completed ? (
          <div className="mt-1 flex flex-wrap items-center gap-[7px]">
            {(task.dueDate === todayKey() ? ["Today", task.project] : [task.project]).filter(Boolean).slice(0, 2).map((label) => (
              <span className={`rounded-[7px] px-2 py-0.5 text-[11px] font-bold ${tagClass(label)}`} key={label}>
                {label}
              </span>
            ))}
            {task.amount ? <span className="font-mono text-[11px] font-semibold text-[#8B8173]">{task.amount}</span> : null}
          </div>
        ) : null}
      </div>
      {compact && !task.someday ? <span className="shrink-0 text-xs font-bold text-[#8B8173]">{displayDate(task.dueDate)}</span> : null}
      {task.flagged && !task.completed ? <Bookmark className="hidden shrink-0 text-[#E0461A] sm:block" size={16} fill="currentColor" /> : null}
      <button
        aria-label="Delete task"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted-soft)] opacity-100 hover:bg-white hover:text-[var(--danger)] sm:opacity-0 sm:group-hover:opacity-100"
        onClick={() => onDelete(task.id)}
        type="button"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function SparkleMark() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="#fff">
      <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z" />
    </svg>
  );
}
