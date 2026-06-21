"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Banknote,
  Camera,
  ClipboardList,
  Edit3,
  Home,
  ImagePlus,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  realEstateProjects,
  type ExpenseAttachment,
  type ExpenseCategory,
  type ProjectExpense,
  type ProjectStatus,
  type TrackerProject,
} from "@/lib/dashboard-data";
import type { LucideIcon } from "lucide-react";

const STORAGE_KEY = "orange-os.real-estate-tracker.v1";

const categories: ExpenseCategory[] = [
  "Materials",
  "Labor",
  "Permits",
  "Inspection",
  "Financing",
  "Legal",
  "Utilities",
  "Insurance",
  "Other",
];

const statuses: ProjectStatus[] = [
  "Lead",
  "Under review",
  "Offer submitted",
  "Under contract",
  "Due diligence",
  "Financing",
  "Closing",
  "Renovation",
  "Listed / leased",
  "Complete",
];

const projectTypes = [
  "Single family rehab",
  "Duplex",
  "Small multifamily",
  "Commercial",
  "Land",
  "Rental",
  "Flip",
];

type ProjectForm = {
  name: string;
  address: string;
  type: string;
  status: ProjectStatus;
  risk: "Low" | "Medium" | "High";
  estimatedValue: string;
  purchasePrice: string;
  targetBudget: string;
  progress: string;
  due: string;
  nextAction: string;
  notes: string;
};

type ExpenseForm = {
  category: ExpenseCategory;
  vendor: string;
  amount: string;
  date: string;
  status: "Paid" | "Unpaid";
  notes: string;
  attachments: ExpenseAttachmentDraft[];
};

type ExpenseAttachmentDraft = ExpenseAttachment & {
  file?: File;
};

const emptyProjectForm: ProjectForm = {
  name: "",
  address: "",
  type: projectTypes[0],
  status: "Lead",
  risk: "Low",
  estimatedValue: "",
  purchasePrice: "",
  targetBudget: "",
  progress: "0",
  due: "",
  nextAction: "",
  notes: "",
};

const emptyExpenseForm: ExpenseForm = {
  category: "Materials",
  vendor: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  status: "Paid",
  notes: "",
  attachments: [],
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function shortCurrency(value: number) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  }

  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }

  return currency(value);
}

function numberFromForm(value: string) {
  return Number(value.replace(/[^0-9.-]/g, "")) || 0;
}

function formatMoneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole = "", decimal = ""] = cleaned.split(".");
  const formattedWhole = whole ? Number(whole).toLocaleString("en-US") : "";

  if (cleaned.includes(".")) {
    return `${formattedWhole}.${decimal.slice(0, 2)}`;
  }

  return formattedWhole;
}

function normalizeMonthValue(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 7);
}

function formatMonthYear(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  const [year, month] = value.split("-");
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

function riskClass(risk: string) {
  if (risk === "High") {
    return "rounded-full bg-red-100 px-2 py-1 text-xs text-red-800";
  }

  if (risk === "Medium") {
    return "rounded-full bg-[#fff0db] px-3 py-1 text-xs text-[#633b00]";
  }

  return "rounded-full bg-[#f3ffd7] px-3 py-1 text-xs text-[#364e00]";
}

function projectToForm(project: TrackerProject): ProjectForm {
  return {
    name: project.name,
    address: project.address,
    type: project.type,
    status: project.status,
    risk: project.risk,
    estimatedValue: String(project.estimatedValue),
    purchasePrice: String(project.purchasePrice),
    targetBudget: String(project.targetBudget),
    progress: String(project.progress),
    due: normalizeMonthValue(project.due),
    nextAction: project.nextAction,
    notes: project.notes,
  };
}

function expenseToForm(expense: ProjectExpense): ExpenseForm {
  return {
    category: expense.category,
    vendor: expense.vendor,
    amount: String(expense.amount),
    date: expense.date,
    status: expense.status,
    notes: expense.notes,
    attachments: expense.attachments,
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function expenseTotal(project: TrackerProject) {
  return project.expenses.reduce((total, expense) => total + expense.amount, 0);
}

function totalAttachments(project: TrackerProject) {
  return project.expenses.reduce((total, expense) => total + expense.attachments.length, 0);
}

export function RealEstateTracker() {
  const initialProject = realEstateProjects[0];
  const [projects, setProjects] = useState<TrackerProject[]>(realEstateProjects);
  const [storageMode, setStorageMode] = useState<"local" | "supabase">("local");
  const [selectedProjectId, setSelectedProjectId] = useState(initialProject?.id ?? "");
  const [projectForm, setProjectForm] = useState<ProjectForm>(
    initialProject ? projectToForm(initialProject) : emptyProjectForm,
  );
  const [editingProjectId, setEditingProjectId] = useState<string | null>(initialProject?.id ?? null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectModalStep, setProjectModalStep] = useState(0);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseSaveMessage, setExpenseSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadStoredProjects = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return;
      }

      try {
        const parsedProjects = JSON.parse(stored) as TrackerProject[];
        if (Array.isArray(parsedProjects) && parsedProjects.length > 0) {
          setProjects(parsedProjects);
          setSelectedProjectId(parsedProjects[0].id);
          setEditingProjectId(parsedProjects[0].id);
          setProjectForm(projectToForm(parsedProjects[0]));
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);

    return () => window.clearTimeout(loadStoredProjects);
  }, []);

  useEffect(() => {
    const loadRemoteProjects = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/real-estate/projects");

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { projects: TrackerProject[] };
        setStorageMode("supabase");
        setProjects(payload.projects);
        setSelectedProjectId(payload.projects[0]?.id ?? "");
        setEditingProjectId(payload.projects[0]?.id ?? null);
        setProjectForm(payload.projects[0] ? projectToForm(payload.projects[0]) : emptyProjectForm);
      } catch {
        setStorageMode("local");
      }
    }, 0);

    return () => window.clearTimeout(loadRemoteProjects);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId],
  );

  const portfolio = useMemo(() => {
    const estimatedValue = projects.reduce((total, project) => total + project.estimatedValue, 0);
    const budget = projects.reduce((total, project) => total + project.targetBudget, 0);
    const spend = projects.reduce((total, project) => total + expenseTotal(project), 0);
    const receipts = projects.reduce((total, project) => total + totalAttachments(project), 0);

    return { estimatedValue, budget, spend, receipts };
  }, [projects]);

  function startAddProject() {
    setEditingProjectId(null);
    setProjectForm(emptyProjectForm);
    setProjectModalStep(0);
    setIsProjectModalOpen(true);
  }

  function startEditProject(project: TrackerProject) {
    setEditingProjectId(project.id);
    setProjectForm(projectToForm(project));
    setProjectModalStep(0);
    setIsProjectModalOpen(true);
  }

  function saveProject() {
    const nextProject: TrackerProject = {
      id: editingProjectId ?? createId("project"),
      name: projectForm.name.trim() || "Untitled project",
      address: projectForm.address.trim(),
      type: projectForm.type,
      status: projectForm.status,
      risk: projectForm.risk,
      estimatedValue: numberFromForm(projectForm.estimatedValue),
      purchasePrice: numberFromForm(projectForm.purchasePrice),
      targetBudget: numberFromForm(projectForm.targetBudget),
      progress: Math.min(100, Math.max(0, numberFromForm(projectForm.progress))),
      due: projectForm.due.trim(),
      nextAction: projectForm.nextAction.trim(),
      notes: projectForm.notes.trim(),
      expenses: editingProjectId
        ? projects.find((project) => project.id === editingProjectId)?.expenses ?? []
        : [],
    };

    setProjects((currentProjects) => {
      if (!editingProjectId) {
        return [nextProject, ...currentProjects];
      }

      return currentProjects.map((project) => (project.id === editingProjectId ? nextProject : project));
    });

    setSelectedProjectId(nextProject.id);
    setEditingProjectId(nextProject.id);
    setIsProjectModalOpen(false);

    void persistProject(nextProject, Boolean(editingProjectId));
  }

  function deleteProject(projectId: string) {
    setProjects((currentProjects) => {
      const nextProjects = currentProjects.filter((project) => project.id !== projectId);
      setSelectedProjectId(nextProjects[0]?.id ?? "");
      return nextProjects;
    });
    setIsProjectModalOpen(false);
    setEditingProjectId(null);

    if (storageMode === "supabase") {
      void fetch(`/api/real-estate/projects/${projectId}`, { method: "DELETE" });
    }
  }

  function startAddExpense() {
    setEditingExpenseId(null);
    setExpenseForm({
      ...emptyExpenseForm,
      date: new Date().toISOString().slice(0, 10),
      attachments: [],
    });
  }

  function startEditExpense(expense: ProjectExpense) {
    setEditingExpenseId(expense.id);
    setExpenseForm(expenseToForm(expense));
  }

  async function saveExpense() {
    if (!selectedProject) {
      return;
    }

    const nextAttachments = expenseForm.attachments
      .filter((attachment) => storageMode !== "supabase" || !attachment.file)
      .map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        dataUrl: attachment.dataUrl,
      }));
    const nextExpense: ProjectExpense = {
      id: editingExpenseId ?? createId("expense"),
      category: expenseForm.category,
      vendor: expenseForm.vendor.trim() || "Unassigned vendor",
      amount: numberFromForm(expenseForm.amount),
      date: expenseForm.date,
      status: expenseForm.status,
      notes: expenseForm.notes.trim(),
      attachments: nextAttachments,
    };

    setProjects((currentProjects) =>
      currentProjects.map((project) => {
        if (project.id !== selectedProject.id) {
          return project;
        }

        const expenses = editingExpenseId
          ? project.expenses.map((expense) => (expense.id === editingExpenseId ? nextExpense : expense))
          : [nextExpense, ...project.expenses];

        return { ...project, expenses };
      }),
    );

    setEditingExpenseId(nextExpense.id);

    const savedExpenseId = await persistExpense(selectedProject.id, nextExpense, Boolean(editingExpenseId));
    await uploadPendingAttachments(
      selectedProject.id,
      savedExpenseId ?? nextExpense.id,
      expenseForm.attachments.filter((attachment) => attachment.file),
    );
  }

  function deleteExpense(expenseId: string) {
    if (!selectedProject) {
      return;
    }

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === selectedProject.id
          ? { ...project, expenses: project.expenses.filter((expense) => expense.id !== expenseId) }
          : project,
      ),
    );

    if (editingExpenseId === expenseId) {
      startAddExpense();
    }

    if (storageMode === "supabase") {
      void fetch(`/api/real-estate/expenses/${expenseId}`, { method: "DELETE" });
    }
  }

  async function persistProject(project: TrackerProject, isEditing: boolean) {
    if (storageMode !== "supabase") {
      return;
    }

    const response = await fetch(
      isEditing ? `/api/real-estate/projects/${project.id}` : "/api/real-estate/projects",
      {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      },
    );

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { project?: { id: string } };
    if (!isEditing && payload.project?.id) {
      setProjects((currentProjects) =>
        currentProjects.map((currentProject) =>
          currentProject.id === project.id
            ? { ...currentProject, id: payload.project!.id }
            : currentProject,
        ),
      );
      setSelectedProjectId(payload.project.id);
      setEditingProjectId(payload.project.id);
    }
  }

  async function persistExpense(projectId: string, expense: ProjectExpense, isEditing: boolean) {
    if (storageMode !== "supabase") {
      return expense.id;
    }

    const response = await fetch(
      isEditing ? `/api/real-estate/expenses/${expense.id}` : "/api/real-estate/expenses",
      {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...expense, projectId }),
      },
    );

    if (!response.ok) {
      return expense.id;
    }

    const payload = (await response.json()) as { expense?: { id: string } };
    if (!isEditing && payload.expense?.id) {
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                expenses: project.expenses.map((currentExpense) =>
                  currentExpense.id === expense.id
                    ? { ...currentExpense, id: payload.expense!.id }
                    : currentExpense,
                ),
              }
            : project,
        ),
      );
      setEditingExpenseId(payload.expense.id);
    }

    return payload.expense?.id ?? expense.id;
  }

  async function uploadPendingAttachments(
    projectId: string,
    expenseId: string,
    attachments: ExpenseAttachmentDraft[],
  ) {
    if (storageMode !== "supabase" || attachments.length === 0) {
      return;
    }

    setExpenseSaveMessage("Uploading private image details...");

    const uploaded: ExpenseAttachment[] = [];
    for (const attachment of attachments) {
      if (!attachment.file) {
        continue;
      }

      const formData = new FormData();
      formData.set("file", attachment.file);
      const response = await fetch(`/api/real-estate/expenses/${expenseId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          attachment: { id: string; file_name: string; storage_path: string };
        };
        uploaded.push({
          id: payload.attachment.id,
          name: payload.attachment.file_name,
          dataUrl: payload.attachment.storage_path,
        });
      }
    }

    if (uploaded.length > 0) {
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                expenses: project.expenses.map((expense) =>
                  expense.id === expenseId
                    ? { ...expense, attachments: [...expense.attachments, ...uploaded] }
                    : expense,
                ),
              }
            : project,
        ),
      );
      setExpenseForm((currentForm) => ({
        ...currentForm,
        attachments: [...currentForm.attachments.filter((attachment) => !attachment.file), ...uploaded],
      }));
      setExpenseSaveMessage(`Saved ${uploaded.length} private image detail${uploaded.length === 1 ? "" : "s"}.`);
    } else {
      setExpenseSaveMessage(null);
    }
  }

  async function addAttachments(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const attachments = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<ExpenseAttachmentDraft>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: createId("attachment"),
                name: file.name,
                dataUrl: String(reader.result),
                file,
              });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );

    setExpenseForm((currentForm) => ({
      ...currentForm,
      attachments: [...currentForm.attachments, ...attachments],
    }));
  }

  function removeAttachment(attachmentId: string) {
    setExpenseForm((currentForm) => ({
      ...currentForm,
      attachments: currentForm.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  }

  if (!selectedProject) {
    return (
      <section className="os-card p-6">
        <TrackerHeader onAddProject={startAddProject} />
        <StorageModeBadge mode={storageMode} />
        <div className="os-card-soft mt-5 p-6 text-sm text-[var(--muted)]">
          No projects yet. Add your first project to start tracking value, expenses, receipts, and next actions.
        </div>
        <ProjectModal
          editingProjectId={editingProjectId}
          form={projectForm}
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
          onDelete={editingProjectId ? () => deleteProject(editingProjectId) : undefined}
          onFormChange={setProjectForm}
          onSave={saveProject}
          onStepChange={setProjectModalStep}
          step={projectModalStep}
        />
      </section>
    );
  }

  const selectedSpend = expenseTotal(selectedProject);
  const remainingBudget = selectedProject.targetBudget - selectedSpend;
  const projectedEquity = selectedProject.estimatedValue - selectedProject.purchasePrice - selectedSpend;

  return (
    <section className="os-card p-6">
      <TrackerHeader onAddProject={startAddProject} />
      <StorageModeBadge mode={storageMode} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Home} label="Estimated value" value={currency(portfolio.estimatedValue)} />
        <MetricCard icon={Banknote} label="Actual spend" value={currency(portfolio.spend)} />
        <MetricCard icon={ClipboardList} label="Target budget" value={currency(portfolio.budget)} />
        <MetricCard icon={Camera} label="Saved images" value={String(portfolio.receipts)} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-4">
          <div className="os-card-soft p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Projects</h3>
              <button
                className="os-primary-button inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold hover:opacity-90"
                onClick={startAddProject}
                type="button"
              >
                <Plus size={15} />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {projects.map((project) => {
                const isSelected = project.id === selectedProject.id;
                return (
                  <button
                    key={project.id}
                    className={`w-full rounded-[1.25rem] border p-3 text-left transition ${
                      isSelected
                        ? "border-[var(--secondary)] bg-[#f3ffd7]"
                        : "border-[var(--line)] bg-white hover:bg-[var(--panel-deep)]"
                    }`}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      startAddExpense();
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{project.status}</p>
                      </div>
                      <span className={riskClass(project.risk)}>{project.risk}</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-stone-200">
                      <div
                        className="h-2 rounded-full bg-[var(--accent)]"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-[var(--muted)]">{shortCurrency(project.estimatedValue)}</span>
                      <span className="font-medium">{currency(expenseTotal(project))} spent</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="os-card-soft p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Project details</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Edit core information in a focused pop-up so this tracker stays easy to scan.
                </p>
              </div>
              <button
                className="os-primary-button inline-flex h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-semibold hover:opacity-90"
                onClick={() => startEditProject(selectedProject)}
                type="button"
              >
                <Edit3 size={16} />
                Edit
              </button>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <DetailItem label="Type" value={selectedProject.type} />
              <DetailItem label="Status" value={selectedProject.status} />
              <DetailItem label="Purchase price" value={currency(selectedProject.purchasePrice)} />
              <DetailItem label="Target budget" value={currency(selectedProject.targetBudget)} />
              <DetailItem label="Progress" value={`${selectedProject.progress}%`} />
              <DetailItem label="Due" value={selectedProject.due ? formatMonthYear(selectedProject.due) : "Not set"} />
            </dl>
          </div>
        </div>

        <div className="space-y-4">
          <div className="os-card-soft p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold">{selectedProject.name}</h3>
                  <span className={riskClass(selectedProject.risk)}>{selectedProject.risk}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{selectedProject.address || "No address yet"}</p>
              </div>
            <button
              className="os-secondary-button inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-semibold transition hover:bg-[var(--panel-deep)]"
              onClick={() => startEditProject(selectedProject)}
                type="button"
              >
                <Edit3 size={16} />
                Edit project
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Insight label="Remaining budget" value={currency(remainingBudget)} isWarning={remainingBudget < 0} />
              <Insight label="Projected equity" value={currency(projectedEquity)} isWarning={projectedEquity < 0} />
              <Insight label="Receipts/images" value={String(totalAttachments(selectedProject))} />
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-[var(--line)] bg-white p-4">
              <p className="text-sm text-[var(--muted)]">Next action</p>
              <p className="mt-1 font-medium">{selectedProject.nextAction || "No next action set."}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="os-card-soft p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-semibold">{editingExpenseId ? "Expense details" : "New expense"}</h3>
                <button
                  className="os-secondary-button inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold transition hover:bg-[var(--panel-deep)]"
                  onClick={startAddExpense}
                  type="button"
                >
                  <Plus size={15} />
                  New
                </button>
              </div>

              <div className="grid gap-3">
                <SelectField
                  label="Category"
                  value={expenseForm.category}
                  options={categories}
                  onChange={(category) => setExpenseForm({ ...expenseForm, category: category as ExpenseCategory })}
                />
                <TextField label="Vendor" value={expenseForm.vendor} onChange={(vendor) => setExpenseForm({ ...expenseForm, vendor })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Amount"
                    inputMode="decimal"
                    value={expenseForm.amount}
                    onChange={(amount) => setExpenseForm({ ...expenseForm, amount: formatMoneyInput(amount) })}
                  />
                  <TextField
                    label="Date"
                    type="date"
                    value={expenseForm.date}
                    onChange={(date) => setExpenseForm({ ...expenseForm, date })}
                  />
                </div>
                <SelectField
                  label="Status"
                  value={expenseForm.status}
                  options={["Paid", "Unpaid"]}
                  onChange={(status) => setExpenseForm({ ...expenseForm, status: status as ProjectExpense["status"] })}
                />
                <TextArea
                  label="Expense notes"
                  value={expenseForm.notes}
                  onChange={(notes) => setExpenseForm({ ...expenseForm, notes })}
                />

                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white p-4 text-center transition hover:border-[var(--primary-container)]">
                  <ImagePlus size={24} className="text-[var(--accent)]" />
                  <span className="mt-2 text-sm font-medium">Add receipt or expense image</span>
                  <span className="mt-1 text-xs text-[var(--muted)]">
                    Images are private supporting details after save
                  </span>
                  <input
                    accept="image/*"
                    className="sr-only"
                    multiple
                    onChange={(event) => {
                      void addAttachments(event.target.files);
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                </label>

                {expenseForm.attachments.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {expenseForm.attachments.map((attachment) => (
                      <div key={attachment.id} className="relative overflow-hidden rounded-[1.25rem] border border-[var(--line)]">
                        <Image
                          alt={attachment.name}
                          className="aspect-[4/3] w-full object-cover"
                          height={180}
                          src={attachment.dataUrl}
                          unoptimized
                          width={240}
                        />
                        <button
                          aria-label={`Remove ${attachment.name}`}
                          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-red-700 shadow-sm"
                          onClick={() => removeAttachment(attachment.id)}
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <button
                  className="os-primary-button inline-flex h-12 items-center justify-center gap-2 px-5 text-sm font-semibold hover:opacity-90"
                  onClick={() => {
                    void saveExpense();
                  }}
                  type="button"
                >
                  <ReceiptText size={16} />
                  Save expense
                </button>
                {expenseSaveMessage ? (
                  <p className="text-sm leading-6 text-[var(--muted)]">{expenseSaveMessage}</p>
                ) : null}
              </div>
            </div>

            <div className="os-card-soft p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-semibold">Expenses</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs text-[var(--muted)]">
                  {selectedProject.expenses.length} items
                </span>
              </div>

              <div className="space-y-3">
                {selectedProject.expenses.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
                    No expenses yet. Add labor, materials, permits, receipts, or invoices here.
                  </div>
                ) : (
                  selectedProject.expenses.map((expense) => (
                    <article key={expense.id} className="rounded-[1.25rem] border border-[var(--line)] bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{expense.vendor}</p>
                            <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs text-[var(--muted)]">
                              {expense.category}
                            </span>
                            <span
                              className={
                                expense.status === "Paid"
                                  ? "rounded-full bg-[#f3ffd7] px-3 py-1 text-xs text-[#364e00]"
                                  : "rounded-full bg-[#fff0db] px-3 py-1 text-xs text-[#633b00]"
                              }
                            >
                              {expense.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[var(--muted)]">{expense.date}</p>
                        </div>
                        <p className="font-mono font-semibold">{currency(expense.amount)}</p>
                      </div>
                      {expense.notes ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{expense.notes}</p> : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                        <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1">
                          {expense.attachments.length} image detail{expense.attachments.length === 1 ? "" : "s"}
                        </span>
                        {expense.attachments.length > 0 ? (
                          <button
                            className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-sm font-medium text-[var(--accent)]"
                            onClick={() => {
                              void openAttachment(expense.attachments[0]);
                            }}
                            type="button"
                          >
                            Preview first
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-sm font-medium transition hover:bg-[var(--panel-strong)]"
                          onClick={() => startEditExpense(expense)}
                          type="button"
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>
                        <button
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 text-sm font-medium text-red-700 transition hover:bg-red-50"
                          onClick={() => deleteExpense(expense.id)}
                          type="button"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ProjectModal
        editingProjectId={editingProjectId}
        form={projectForm}
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onDelete={editingProjectId ? () => deleteProject(editingProjectId) : undefined}
        onFormChange={setProjectForm}
        onSave={saveProject}
        onStepChange={setProjectModalStep}
        step={projectModalStep}
      />
    </section>
  );
}

async function openAttachment(attachment: ExpenseAttachment) {
  if (attachment.dataUrl.startsWith("data:")) {
    window.open(attachment.dataUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const response = await fetch(`/api/real-estate/attachments/${attachment.id}/signed-url`);
  if (!response.ok) {
    return;
  }

  const payload = (await response.json()) as { signedUrl: string };
  window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
}

type TrackerHeaderProps = {
  onAddProject: () => void;
};

function TrackerHeader({ onAddProject }: TrackerHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent-ink)]">
          <ReceiptText size={18} />
          Real estate project tracker
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Projects, expenses, values, and receipts</h2>
      </div>
      <button
        className="os-primary-button inline-flex h-12 items-center justify-center gap-2 px-5 text-sm font-semibold hover:opacity-90"
        onClick={onAddProject}
        type="button"
      >
        <Plus size={16} />
        Add project
      </button>
    </div>
  );
}

type StorageModeBadgeProps = {
  mode: "local" | "supabase";
};

function StorageModeBadge({ mode }: StorageModeBadgeProps) {
  return (
    <div className="mt-4 inline-flex rounded-full bg-[var(--panel-strong)] px-4 py-2 text-xs font-semibold text-[var(--muted)]">
      {mode === "supabase"
        ? "Saving to Supabase"
        : "Saving locally until you sign in"}
    </div>
  );
}

type ProjectModalProps = {
  editingProjectId: string | null;
  form: ProjectForm;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onFormChange: (form: ProjectForm) => void;
  onSave: () => void;
  onStepChange: (step: number) => void;
  step: number;
};

const projectModalSteps = ["Basics", "Numbers", "Plan"];

function ProjectModal({
  editingProjectId,
  form,
  isOpen,
  onClose,
  onDelete,
  onFormChange,
  onSave,
  onStepChange,
  step,
}: ProjectModalProps) {
  if (!isOpen) {
    return null;
  }

  const isLastStep = step === projectModalSteps.length - 1;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#1a1d13]/35 p-3 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
    >
      <div className="os-card max-h-[92dvh] w-full max-w-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Real estate project</p>
            <h3 className="mt-1 text-2xl font-bold">{editingProjectId ? "Edit project" : "Add project"}</h3>
          </div>
          <button
            aria-label="Close project pop-up"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--panel-strong)] text-[var(--muted)] hover:bg-[var(--panel-deep)]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(92dvh-156px)] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-5 grid grid-cols-3 gap-2">
            {projectModalSteps.map((label, index) => (
              <button
                key={label}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${
                  index === step
                    ? "bg-[var(--secondary-container)] text-[var(--secondary)]"
                    : "bg-[var(--panel-strong)] text-[var(--muted)]"
                }`}
                onClick={() => onStepChange(index)}
                type="button"
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>

          {step === 0 ? (
            <div className="grid gap-4">
              <TextField label="Project name" value={form.name} onChange={(name) => onFormChange({ ...form, name })} />
              <TextField
                autoComplete="street-address"
                label="Address"
                value={form.address}
                onChange={(address) => onFormChange({ ...form, address })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Type"
                  value={form.type}
                  options={projectTypes}
                  onChange={(type) => onFormChange({ ...form, type })}
                />
                <SelectField
                  label="Status"
                  value={form.status}
                  options={statuses}
                  onChange={(status) => onFormChange({ ...form, status: status as ProjectStatus })}
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Estimated value"
                  inputMode="decimal"
                  value={form.estimatedValue}
                  onChange={(estimatedValue) =>
                    onFormChange({ ...form, estimatedValue: formatMoneyInput(estimatedValue) })
                  }
                />
                <TextField
                  label="Purchase price"
                  inputMode="decimal"
                  value={form.purchasePrice}
                  onChange={(purchasePrice) =>
                    onFormChange({ ...form, purchasePrice: formatMoneyInput(purchasePrice) })
                  }
                />
                <TextField
                  label="Target budget"
                  inputMode="decimal"
                  value={form.targetBudget}
                  onChange={(targetBudget) =>
                    onFormChange({ ...form, targetBudget: formatMoneyInput(targetBudget) })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  label="Risk"
                  value={form.risk}
                  options={["Low", "Medium", "High"]}
                  onChange={(risk) => onFormChange({ ...form, risk: risk as TrackerProject["risk"] })}
                />
                <TextField
                  label="Progress"
                  inputMode="numeric"
                  value={form.progress}
                  onChange={(progress) => onFormChange({ ...form, progress })}
                />
                <TextField
                  label="Due"
                  type="month"
                  value={form.due}
                  onChange={(due) => onFormChange({ ...form, due })}
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4">
              <TextField
                label="Next action"
                value={form.nextAction}
                onChange={(nextAction) => onFormChange({ ...form, nextAction })}
              />
              <TextArea label="Project notes" value={form.notes} onChange={(notes) => onFormChange({ ...form, notes })} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            {editingProjectId && onDelete ? (
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                onClick={onDelete}
                type="button"
              >
                <Trash2 size={15} />
                Delete project
              </button>
            ) : null}
          </div>
          <div className="flex gap-3">
            <button
              className="os-secondary-button h-11 px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              disabled={step === 0}
              onClick={() => onStepChange(Math.max(0, step - 1))}
              type="button"
            >
              Back
            </button>
            {isLastStep ? (
              <button
                className="os-primary-button inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-semibold"
                onClick={onSave}
                type="button"
              >
                <Save size={16} />
                Save project
              </button>
            ) : (
              <button
                className="os-primary-button h-11 px-5 text-sm font-semibold"
                onClick={() => onStepChange(Math.min(projectModalSteps.length - 1, step + 1))}
                type="button"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type DetailItemProps = {
  label: string;
  value: string;
};

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--line)] bg-white p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-strong)] p-4">
      <Icon size={18} className="text-[var(--accent)]" />
      <p className="mt-3 text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

type InsightProps = {
  label: string;
  value: string;
  isWarning?: boolean;
};

function Insight({ label, value, isWarning = false }: InsightProps) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--line)] bg-white p-3">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={isWarning ? "mt-1 font-semibold text-red-700" : "mt-1 font-semibold"}>{value}</p>
    </div>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  list?: string;
  spellCheck?: boolean;
  type?: string;
};

function TextField({
  label,
  value,
  onChange,
  autoComplete,
  inputMode,
  list,
  spellCheck,
  type = "text",
}: TextFieldProps) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <input
        autoComplete={autoComplete}
        className="os-input h-11 px-4 text-sm transition"
        inputMode={inputMode}
        list={list}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={spellCheck ?? type === "text"}
        type={type}
        value={value}
      />
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <select
        className="os-input h-11 px-4 text-sm transition"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

type TextAreaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function TextArea({ label, value, onChange }: TextAreaProps) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <textarea
        className="os-input min-h-24 resize-y px-4 py-3 text-sm transition"
        onChange={(event) => onChange(event.target.value)}
        spellCheck
        value={value}
      />
    </label>
  );
}
