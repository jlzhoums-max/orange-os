import type { ProjectExpense, TrackerProject } from "@/lib/dashboard-data";
import type { Database } from "@/lib/database.types";

type ProjectRow = Database["public"]["Tables"]["real_estate_projects"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["project_expenses"]["Row"];
type AttachmentRow = Database["public"]["Tables"]["expense_attachments"]["Row"];

export type ProjectWithRelations = ProjectRow & {
  project_expenses: Array<
    ExpenseRow & {
      expense_attachments: AttachmentRow[];
    }
  >;
};

export function dbProjectToTrackerProject(project: ProjectWithRelations): TrackerProject {
  return {
    id: project.id,
    name: project.name,
    address: project.address ?? "",
    type: project.project_type ?? "Single family rehab",
    status: project.status as TrackerProject["status"],
    risk: project.risk as TrackerProject["risk"],
    estimatedValue: Number(project.estimated_value),
    purchasePrice: Number(project.purchase_price),
    targetBudget: Number(project.target_budget),
    progress: project.progress,
    due: project.due ?? "",
    nextAction: project.next_action ?? "",
    notes: project.notes ?? "",
    expenses: project.project_expenses.map(dbExpenseToProjectExpense),
  };
}

export function dbExpenseToProjectExpense(
  expense: ExpenseRow & { expense_attachments: AttachmentRow[] },
): ProjectExpense {
  return {
    id: expense.id,
    category: expense.category as ProjectExpense["category"],
    vendor: expense.vendor,
    amount: Number(expense.amount),
    date: expense.expense_date,
    status: expense.status as ProjectExpense["status"],
    notes: expense.notes ?? "",
    attachments: expense.expense_attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.file_name,
      dataUrl: attachment.storage_path,
    })),
  };
}
