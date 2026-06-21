import type { TodoTask, TodoTaskPayload } from "@/lib/todos/types";

type TodoTaskRow = {
  id: string;
  title: string;
  notes: string | null;
  project: string;
  due_date: string | null;
  priority: number | null;
  labels: string[];
  completed: boolean;
  amount: string | null;
  flagged: boolean;
  someday: boolean;
  created_at: string;
};

export function dbTodoTask(row: TodoTaskRow): TodoTask {
  const priority = row.priority && row.priority >= 1 && row.priority <= 4 ? (row.priority as TodoTask["priority"]) : undefined;

  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? "",
    project: row.project,
    dueDate: row.due_date ?? "",
    priority,
    labels: row.labels ?? [],
    completed: row.completed,
    createdAt: row.created_at,
    amount: row.amount ?? "",
    flagged: row.flagged,
    someday: row.someday,
  };
}

export function todoTaskInsert(userId: string, payload: TodoTaskPayload) {
  const dueDate = payload.dueDate || null;

  return {
    user_id: userId,
    title: payload.title?.trim() || "Untitled task",
    notes: payload.notes ?? "",
    project: payload.project || "Personal",
    due_date: dueDate,
    priority: payload.priority ?? null,
    labels: Array.isArray(payload.labels) ? payload.labels : [],
    completed: payload.completed ?? false,
    amount: payload.amount?.trim() || null,
    flagged: payload.flagged ?? false,
    someday: payload.someday ?? !dueDate,
  };
}

export function todoTaskUpdate(payload: TodoTaskPayload) {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.title !== undefined) update.title = payload.title.trim() || "Untitled task";
  if (payload.notes !== undefined) update.notes = payload.notes;
  if (payload.project !== undefined) update.project = payload.project || "Personal";
  if (payload.dueDate !== undefined) update.due_date = payload.dueDate || null;
  if (payload.priority !== undefined) update.priority = payload.priority ?? null;
  if (payload.labels !== undefined) update.labels = Array.isArray(payload.labels) ? payload.labels : [];
  if (payload.completed !== undefined) update.completed = payload.completed;
  if (payload.amount !== undefined) update.amount = payload.amount.trim() || null;
  if (payload.flagged !== undefined) update.flagged = payload.flagged;
  if (payload.someday !== undefined) update.someday = payload.someday;

  return update;
}
