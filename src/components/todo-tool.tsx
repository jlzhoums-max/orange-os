"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Flag,
  Hash,
  Inbox,
  ListChecks,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type TodoPriority = 1 | 2 | 3 | 4;
type TodoView = "inbox" | "today" | "upcoming" | "all";

type TodoTask = {
  id: string;
  title: string;
  notes: string;
  project: string;
  dueDate: string;
  priority: TodoPriority;
  labels: string[];
  completed: boolean;
  createdAt: string;
};

type TodoForm = {
  title: string;
  notes: string;
  project: string;
  dueDate: string;
  priority: TodoPriority;
  labels: string;
};

const storageKey = "orange-os.todo-tool.v1";
const projects = ["Inbox", "Personal", "Work", "Real Estate", "Finance"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowKey() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

const seedTasks: TodoTask[] = [
  {
    id: "task-seed-1",
    title: "Review today's calendar and choose top three actions",
    notes: "Start with work that unlocks other tasks.",
    project: "Inbox",
    dueDate: todayKey(),
    priority: 1,
    labels: ["planning", "daily"],
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-seed-2",
    title: "Update Real Estate Tool project notes",
    notes: "Add next action and any open receipts.",
    project: "Real Estate",
    dueDate: todayKey(),
    priority: 2,
    labels: ["property"],
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "task-seed-3",
    title: "Check ledger pacing for this week",
    notes: "Look for unusual spending before adding new entries.",
    project: "Finance",
    dueDate: tomorrowKey(),
    priority: 3,
    labels: ["money"],
    completed: false,
    createdAt: new Date().toISOString(),
  },
];

const emptyForm: TodoForm = {
  title: "",
  notes: "",
  project: "Inbox",
  dueDate: todayKey(),
  priority: 2,
  labels: "",
};

function createId() {
  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDueDate(value: string) {
  if (!value) {
    return "No date";
  }

  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function priorityClass(priority: TodoPriority) {
  if (priority === 1) {
    return "text-[#e84b1b]";
  }

  if (priority === 2) {
    return "text-[var(--accent)]";
  }

  if (priority === 3) {
    return "text-[var(--amber)]";
  }

  return "text-[var(--muted-soft)]";
}

function taskMatchesView(task: TodoTask, view: TodoView, selectedProject: string) {
  if (task.completed) {
    return false;
  }

  if (selectedProject !== "All" && task.project !== selectedProject) {
    return false;
  }

  if (view === "inbox") {
    return task.project === "Inbox";
  }

  if (view === "today") {
    return task.dueDate === todayKey();
  }

  if (view === "upcoming") {
    return task.dueDate > todayKey();
  }

  return true;
}

export function TodoTool() {
  const [tasks, setTasks] = useState<TodoTask[]>(() => {
    if (typeof window === "undefined") {
      return seedTasks;
    }

    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      return seedTasks;
    }

    try {
      const parsed = JSON.parse(stored) as TodoTask[];
      return Array.isArray(parsed) ? parsed : seedTasks;
    } catch {
      window.localStorage.removeItem(storageKey);
      return seedTasks;
    }
  });
  const [form, setForm] = useState<TodoForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<TodoView>("today");
  const [selectedProject, setSelectedProject] = useState("All");
  const [query, setQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(tasks));
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks
      .filter((task) => (showCompleted ? true : taskMatchesView(task, view, selectedProject)))
      .filter((task) => (showCompleted ? task.completed : true))
      .filter((task) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          task.title,
          task.notes,
          task.project,
          task.labels.join(" "),
        ].join(" ").toLowerCase().includes(normalizedQuery);
      })
      .sort((first, second) => {
        if (first.completed !== second.completed) {
          return first.completed ? 1 : -1;
        }

        if (first.dueDate !== second.dueDate) {
          return first.dueDate.localeCompare(second.dueDate);
        }

        return first.priority - second.priority;
      });
  }, [query, selectedProject, showCompleted, tasks, view]);

  const counts = useMemo(() => {
    const open = tasks.filter((task) => !task.completed);
    return {
      inbox: open.filter((task) => task.project === "Inbox").length,
      today: open.filter((task) => task.dueDate === todayKey()).length,
      upcoming: open.filter((task) => task.dueDate > todayKey()).length,
      all: open.length,
      completed: tasks.filter((task) => task.completed).length,
    };
  }, [tasks]);

  function saveTask() {
    const title = form.title.trim();

    if (!title) {
      return;
    }

    const nextTask: TodoTask = {
      id: editingId ?? createId(),
      title,
      notes: form.notes.trim(),
      project: form.project,
      dueDate: form.dueDate,
      priority: form.priority,
      labels: form.labels.split(",").map((label) => label.trim()).filter(Boolean),
      completed: editingId ? tasks.find((task) => task.id === editingId)?.completed ?? false : false,
      createdAt: editingId ? tasks.find((task) => task.id === editingId)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
    };

    setTasks((current) =>
      editingId
        ? current.map((task) => (task.id === editingId ? nextTask : task))
        : [nextTask, ...current],
    );
    setForm(emptyForm);
    setEditingId(null);
  }

  function editTask(task: TodoTask) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      notes: task.notes,
      project: task.project,
      dueDate: task.dueDate,
      priority: task.priority,
      labels: task.labels.join(", "),
    });
  }

  function toggleTask(taskId: string) {
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)),
    );
  }

  function deleteTask(taskId: string) {
    setTasks((current) => current.filter((task) => task.id !== taskId));

    if (editingId === taskId) {
      setEditingId(null);
      setForm(emptyForm);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[18rem_1fr]">
      <aside className="os-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
          <input
            className="os-input h-11 w-full pl-9 pr-3 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks"
            type="search"
            value={query}
          />
        </div>

        <nav className="mt-4 grid gap-1" aria-label="Task views">
          <ViewButton active={view === "inbox" && !showCompleted} count={counts.inbox} icon={Inbox} label="Inbox" onClick={() => { setView("inbox"); setShowCompleted(false); }} />
          <ViewButton active={view === "today" && !showCompleted} count={counts.today} icon={CalendarDays} label="Today" onClick={() => { setView("today"); setShowCompleted(false); }} />
          <ViewButton active={view === "upcoming" && !showCompleted} count={counts.upcoming} icon={ListChecks} label="Upcoming" onClick={() => { setView("upcoming"); setShowCompleted(false); }} />
          <ViewButton active={view === "all" && !showCompleted} count={counts.all} icon={Hash} label="All tasks" onClick={() => { setView("all"); setShowCompleted(false); }} />
          <ViewButton active={showCompleted} count={counts.completed} icon={CheckCircle2} label="Completed" onClick={() => setShowCompleted(true)} />
        </nav>

        <div className="mt-6">
          <p className="os-label px-3">Projects</p>
          <div className="mt-2 grid gap-1">
            {["All", ...projects].map((project) => (
              <button
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  selectedProject === project
                    ? "bg-white text-[var(--accent)] shadow-[0_9px_26px_rgba(110,56,13,0.07)]"
                    : "text-[var(--muted)] hover:bg-white/62 hover:text-[var(--accent)]"
                }`}
                key={project}
                onClick={() => setSelectedProject(project)}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)] opacity-70" />
                  {project}
                </span>
                <span className="text-xs text-[var(--muted-soft)]">
                  {project === "All" ? counts.all : tasks.filter((task) => !task.completed && task.project === project).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="grid gap-4">
        <section className="os-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="grid flex-1 gap-1 text-sm font-semibold">
              <span>Task</span>
              <input
                className="os-input h-12 px-4"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    saveTask();
                  }
                }}
                placeholder="Add a task"
                value={form.title}
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              <span>Project</span>
              <select className="os-input h-12 px-3" onChange={(event) => setForm({ ...form, project: event.target.value })} value={form.project}>
                {projects.map((project) => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              <span>Due</span>
              <input className="os-input h-12 px-3" onChange={(event) => setForm({ ...form, dueDate: event.target.value })} type="date" value={form.dueDate} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              <span>Priority</span>
              <select className="os-input h-12 px-3" onChange={(event) => setForm({ ...form, priority: Number(event.target.value) as TodoPriority })} value={form.priority}>
                <option value={1}>P1</option>
                <option value={2}>P2</option>
                <option value={3}>P3</option>
                <option value={4}>P4</option>
              </select>
            </label>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_18rem_auto]">
            <input
              className="os-input h-11 px-4 text-sm"
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Description"
              value={form.notes}
            />
            <input
              className="os-input h-11 px-4 text-sm"
              onChange={(event) => setForm({ ...form, labels: event.target.value })}
              placeholder="Labels, comma separated"
              value={form.labels}
            />
            <div className="flex gap-2">
              {editingId ? (
                <button className="os-secondary-button h-11 px-4 text-sm font-semibold" onClick={() => { setEditingId(null); setForm(emptyForm); }} type="button">
                  <X size={16} />
                </button>
              ) : null}
              <button className="os-primary-button inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-semibold" onClick={saveTask} type="button">
                <Plus size={16} />
                {editingId ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </section>

        <section className="os-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-5">
            <div>
              <p className="os-label">{showCompleted ? "Archive" : "Task list"}</p>
              <h2 className="mt-1 text-2xl font-bold">
                {showCompleted ? "Completed" : view === "all" ? "All tasks" : view[0].toUpperCase() + view.slice(1)}
              </h2>
            </div>
            <div className="rounded-full bg-[var(--panel-strong)] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
              {visibleTasks.length} task{visibleTasks.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="divide-y divide-[var(--line)]">
            {visibleTasks.length ? (
              visibleTasks.map((task) => (
                <article className="group grid gap-3 px-4 py-4 transition hover:bg-[var(--panel-strong)] sm:px-5" key={task.id}>
                  <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
                    <button
                      aria-label={task.completed ? "Mark incomplete" : "Complete task"}
                      className="mt-0.5 text-[var(--muted-soft)] hover:text-[var(--accent)]"
                      onClick={() => toggleTask(task.id)}
                      type="button"
                    >
                      {task.completed ? <CheckCircle2 size={21} className="text-[var(--secondary)]" /> : <Circle size={21} />}
                    </button>
                    <button className="min-w-0 text-left" onClick={() => editTask(task)} type="button">
                      <p className={`font-semibold leading-6 ${task.completed ? "text-[var(--muted-soft)] line-through" : ""}`}>
                        {task.title}
                      </p>
                      {task.notes ? <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{task.notes}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
                          <Hash size={12} />
                          {task.project}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
                          <CalendarDays size={12} />
                          {formatDueDate(task.dueDate)}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ${priorityClass(task.priority)}`}>
                          <Flag size={12} />
                          P{task.priority}
                        </span>
                        {task.labels.map((label) => (
                          <span className="rounded-full bg-[var(--panel-deep)] px-2.5 py-1" key={label}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </button>
                    <button
                      aria-label="Delete task"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted-soft)] opacity-100 hover:bg-white hover:text-[var(--danger)] sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => deleteTask(task.id)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-5 py-12 text-center">
                <div className="os-icon-bubble mx-auto flex h-14 w-14 items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <p className="mt-4 font-semibold">Nothing here right now.</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Add a task or switch views to see more.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function ViewButton({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-white text-[var(--accent)] shadow-[0_9px_26px_rgba(110,56,13,0.07)]"
          : "text-[var(--muted)] hover:bg-white/62 hover:text-[var(--accent)]"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex items-center gap-2">
        <Icon size={17} />
        {label}
      </span>
      <span className="text-xs text-[var(--muted-soft)]">{count}</span>
    </button>
  );
}
