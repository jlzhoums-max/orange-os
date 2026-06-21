"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Home,
  ImagePlus,
  Plus,
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

const STORAGE_KEY = "ju-os.real-estate-tracker.v1";
const LEGACY_STORAGE_KEY = "orange-os.real-estate-tracker.v1";

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
  "Buy, renovate, sell",
];

type ExpenseAttachmentDraft = ExpenseAttachment & {
  file?: File;
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

const emptyExpenseForm: ExpenseForm = {
  category: "Materials",
  vendor: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  status: "Paid",
  notes: "",
  attachments: [],
};

const emptyProjectForm: ProjectForm = {
  name: "",
  address: "",
  type: "Buy, renovate, sell",
  status: "Renovation",
  risk: "Low",
  estimatedValue: "",
  purchasePrice: "",
  targetBudget: "",
  progress: "0",
  due: "",
  nextAction: "",
  notes: "",
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function shortCurrency(value: number) {
  if (Math.abs(value) >= 1000) {
    const formatted = value / 1000;
    return `$${Number.isInteger(formatted) ? formatted.toFixed(0) : formatted.toFixed(1)}k`;
  }

  return currency(value);
}

function moneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole = "", decimal = ""] = cleaned.split(".");
  const formattedWhole = whole ? Number(whole).toLocaleString("en-US") : "";
  return cleaned.includes(".") ? `${formattedWhole}.${decimal.slice(0, 2)}` : formattedWhole;
}

function numberFromForm(value: string) {
  return Number(value.replace(/[^0-9.-]/g, "")) || 0;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
    due: project.due,
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

function expenseTotal(project: TrackerProject) {
  return project.expenses.reduce((total, expense) => total + expense.amount, 0);
}

function attachmentCount(project: TrackerProject) {
  return project.expenses.reduce((total, expense) => total + expense.attachments.length, 0);
}

function projectPhase(project: TrackerProject) {
  const labels = ["Demo", "Framing", "Electrical", "Tile", "Finish"];
  if (project.status === "Listed / leased" || project.status === "Complete") return { active: 4, labels: ["Demo", "Framing", "Electrical", "Paint", "List"] };
  if (project.progress >= 75) return { active: 3, labels };
  if (project.progress >= 50) return { active: 2, labels };
  if (project.progress >= 25) return { active: 1, labels };
  return { active: 0, labels };
}

function displayDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function projectState(project: TrackerProject) {
  const spent = expenseTotal(project);
  const remaining = project.targetBudget - spent;
  const percent = project.targetBudget ? Math.round((spent / project.targetBudget) * 100) : 0;
  const over = remaining < 0 || project.risk === "High";
  return { spent, remaining, percent, over };
}

export function RealEstateTracker() {
  const [projects, setProjects] = useState<TrackerProject[]>([]);
  const [storageMode, setStorageMode] = useState<"local" | "supabase">("local");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [expenseProjectId, setExpenseProjectId] = useState("");
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectForm>(emptyProjectForm);
  const [saveMessage, setSaveMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function loadLocalProjects() {
      const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!stored) {
        setProjects(realEstateProjects);
        setSelectedProjectId(realEstateProjects[0]?.id ?? "");
        setExpenseProjectId(realEstateProjects[0]?.id ?? "");
        return;
      }

      try {
        const parsed = JSON.parse(stored) as TrackerProject[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed);
          setSelectedProjectId(parsed[0].id);
          setExpenseProjectId(parsed[0].id);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        setProjects(realEstateProjects);
        setSelectedProjectId(realEstateProjects[0]?.id ?? "");
        setExpenseProjectId(realEstateProjects[0]?.id ?? "");
      }
    }

    const loadProjects = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/real-estate/projects");
        if (!response.ok) {
          loadLocalProjects();
          return;
        }

        const payload = (await response.json()) as { projects: TrackerProject[] };
        setStorageMode("supabase");
        setProjects(payload.projects);
        setSelectedProjectId(payload.projects[0]?.id ?? "");
        setExpenseProjectId(payload.projects[0]?.id ?? "");
      } catch {
        setStorageMode("local");
        loadLocalProjects();
      } finally {
        setLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(loadProjects);
  }, []);

  useEffect(() => {
    if (!loaded || storageMode !== "local") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [loaded, projects, storageMode]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const expenseProject = projects.find((project) => project.id === expenseProjectId) ?? selectedProject;

  const portfolio = useMemo(() => {
    const budget = projects.reduce((total, project) => total + project.targetBudget, 0);
    const spend = projects.reduce((total, project) => total + expenseTotal(project), 0);
    const remaining = budget - spend;
    const overProject = projects.find((project) => projectState(project).over);
    return { budget, spend, remaining, overProject };
  }, [projects]);

  function openExpense(project?: TrackerProject, expense?: ProjectExpense) {
    const nextProject = project ?? selectedProject ?? projects[0];
    if (!nextProject) return;

    setExpenseProjectId(nextProject.id);
    setEditingExpenseId(expense?.id ?? null);
    setExpenseForm(expense ? expenseToForm(expense) : { ...emptyExpenseForm, date: new Date().toISOString().slice(0, 10), attachments: [] });
    setQuickAddOpen(false);
    setExpenseOpen(true);
  }

  function openProject(project?: TrackerProject) {
    setEditingProjectId(project?.id ?? null);
    setProjectForm(project ? projectToForm(project) : emptyProjectForm);
    setQuickAddOpen(false);
    setProjectOpen(true);
  }

  async function saveExpense() {
    if (!expenseProject) return;

    const nextAttachments = expenseForm.attachments
      .filter((attachment) => storageMode !== "supabase" || !attachment.file)
      .map((attachment) => ({ id: attachment.id, name: attachment.name, dataUrl: attachment.dataUrl }));

    const nextExpense: ProjectExpense = {
      id: editingExpenseId ?? createId("expense"),
      category: expenseForm.category,
      vendor: expenseForm.vendor.trim() || "Unassigned vendor",
      amount: numberFromForm(expenseForm.amount),
      date: expenseForm.date || new Date().toISOString().slice(0, 10),
      status: expenseForm.status,
      notes: expenseForm.notes.trim(),
      attachments: nextAttachments,
    };

    setProjects((currentProjects) =>
      currentProjects.map((project) => {
        if (project.id !== expenseProject.id) return project;
        const expenses = editingExpenseId
          ? project.expenses.map((expense) => (expense.id === editingExpenseId ? nextExpense : expense))
          : [nextExpense, ...project.expenses];
        return { ...project, expenses };
      }),
    );

    const savedExpenseId = await persistExpense(expenseProject.id, nextExpense, Boolean(editingExpenseId));
    await uploadPendingAttachments(
      expenseProject.id,
      savedExpenseId ?? nextExpense.id,
      expenseForm.attachments.filter((attachment) => attachment.file),
    );

    setSaveMessage("Expense saved");
    setExpenseOpen(false);
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
      expenses: editingProjectId ? projects.find((project) => project.id === editingProjectId)?.expenses ?? [] : [],
    };

    setProjects((currentProjects) =>
      editingProjectId
        ? currentProjects.map((project) => (project.id === editingProjectId ? nextProject : project))
        : [nextProject, ...currentProjects],
    );
    setSelectedProjectId(nextProject.id);
    setExpenseProjectId(nextProject.id);
    setProjectOpen(false);
    void persistProject(nextProject, Boolean(editingProjectId));
  }

  function deleteProject(projectId: string) {
    setProjects((currentProjects) => {
      const nextProjects = currentProjects.filter((project) => project.id !== projectId);
      setSelectedProjectId(nextProjects[0]?.id ?? "");
      setExpenseProjectId(nextProjects[0]?.id ?? "");
      return nextProjects;
    });
    setProjectOpen(false);
    if (storageMode === "supabase") void fetch(`/api/real-estate/projects/${projectId}`, { method: "DELETE" });
  }

  function deleteExpense(projectId: string, expenseId: string) {
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === projectId ? { ...project, expenses: project.expenses.filter((expense) => expense.id !== expenseId) } : project,
      ),
    );
    if (storageMode === "supabase") void fetch(`/api/real-estate/expenses/${expenseId}`, { method: "DELETE" });
  }

  async function addAttachments(files: FileList | null) {
    if (!files?.length) return;

    const attachments = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<ExpenseAttachmentDraft>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ id: createId("attachment"), name: file.name, dataUrl: String(reader.result), file });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );

    setExpenseForm((currentForm) => ({ ...currentForm, attachments: [...currentForm.attachments, ...attachments] }));
  }

  function removeAttachment(attachmentId: string) {
    setExpenseForm((currentForm) => ({
      ...currentForm,
      attachments: currentForm.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  }

  async function persistProject(project: TrackerProject, isEditing: boolean) {
    if (storageMode !== "supabase") return;

    const response = await fetch(isEditing ? `/api/real-estate/projects/${project.id}` : "/api/real-estate/projects", {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    if (!response.ok) return;

    const payload = (await response.json()) as { project?: { id: string } };
    if (!isEditing && payload.project?.id) {
      setProjects((currentProjects) =>
        currentProjects.map((currentProject) => (currentProject.id === project.id ? { ...currentProject, id: payload.project!.id } : currentProject)),
      );
      setSelectedProjectId(payload.project.id);
      setExpenseProjectId(payload.project.id);
    }
  }

  async function persistExpense(projectId: string, expense: ProjectExpense, isEditing: boolean) {
    if (storageMode !== "supabase") return expense.id;

    const response = await fetch(isEditing ? `/api/real-estate/expenses/${expense.id}` : "/api/real-estate/expenses", {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...expense, projectId }),
    });
    if (!response.ok) return expense.id;

    const payload = (await response.json()) as { expense?: { id: string } };
    if (!isEditing && payload.expense?.id) {
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                expenses: project.expenses.map((currentExpense) =>
                  currentExpense.id === expense.id ? { ...currentExpense, id: payload.expense!.id } : currentExpense,
                ),
              }
            : project,
        ),
      );
    }

    return payload.expense?.id ?? expense.id;
  }

  async function uploadPendingAttachments(projectId: string, expenseId: string, attachments: ExpenseAttachmentDraft[]) {
    if (storageMode !== "supabase" || attachments.length === 0) return;

    const uploaded: ExpenseAttachment[] = [];
    for (const attachment of attachments) {
      if (!attachment.file) continue;
      const formData = new FormData();
      formData.set("file", attachment.file);
      const response = await fetch(`/api/real-estate/expenses/${expenseId}/attachments`, { method: "POST", body: formData });
      if (response.ok) {
        const payload = (await response.json()) as { attachment: { id: string; file_name: string; storage_path: string } };
        uploaded.push({ id: payload.attachment.id, name: payload.attachment.file_name, dataUrl: payload.attachment.storage_path });
      }
    }

    if (!uploaded.length) return;
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              expenses: project.expenses.map((expense) =>
                expense.id === expenseId ? { ...expense, attachments: [...expense.attachments, ...uploaded] } : expense,
              ),
            }
          : project,
      ),
    );
  }

  if (!loaded) {
    return (
      <section className="mx-auto max-w-[1158px] rounded-[22px] border border-[var(--line)] bg-white p-8 text-center">
        <h1 className="text-2xl font-extrabold">Real Estate</h1>
        <p className="mt-2 text-sm font-semibold text-[var(--muted)]">Loading projects...</p>
      </section>
    );
  }

  if (!projects.length) {
    return (
      <section className="mx-auto max-w-[1158px] rounded-[22px] border border-[var(--line)] bg-white p-8 text-center">
        <h1 className="text-2xl font-extrabold">Real Estate</h1>
        <p className="mt-2 text-sm font-semibold text-[var(--muted)]">No projects yet.</p>
        <button className="os-primary-button mt-5 inline-flex h-11 items-center gap-2 px-5 text-sm font-bold" onClick={() => openProject()} type="button">
          <Plus size={16} />
          New project
        </button>
        <ProjectSheet
          form={projectForm}
          isOpen={projectOpen}
          isEditing={Boolean(editingProjectId)}
          onClose={() => setProjectOpen(false)}
          onDelete={editingProjectId ? () => deleteProject(editingProjectId) : undefined}
          onFormChange={setProjectForm}
          onSave={saveProject}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1158px]">
      <header className="mb-[22px] flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[25px] font-extrabold tracking-normal text-[var(--foreground)]">Real Estate</h1>
          <p className="mt-[3px] text-[13.5px] font-semibold text-[var(--muted-soft)]">
            {projects.length} active project{projects.length === 1 ? "" : "s"} · {portfolio.overProject ? "1 needs attention" : "on track"}
          </p>
        </div>
        <div className="hidden gap-2.5 md:flex">
          <button className="os-secondary-button inline-flex h-11 items-center gap-2 px-[18px] text-sm font-bold text-[var(--muted)]" onClick={() => openExpense()} type="button">
            <Plus size={16} className="text-[var(--accent-hot)]" />
            Add expense
          </button>
          <button className="os-primary-button inline-flex h-11 items-center gap-2 px-[18px] text-sm font-bold" onClick={() => openProject()} type="button">
            <Plus size={16} />
            New project
          </button>
        </div>
      </header>

      <div className="mb-[22px] grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PortfolioCard label="Total budget" value={currency(portfolio.budget)} />
        <PortfolioCard label="Spent to date" value={currency(portfolio.spend)} progress={portfolio.budget ? Math.min(100, Math.round((portfolio.spend / portfolio.budget) * 100)) : 0} />
        <PortfolioCard green label="Remaining" value={currency(portfolio.remaining)} />
        <PortfolioHealth overProject={portfolio.overProject} />
      </div>

      <div className="hidden gap-5 md:grid">
        {projects.slice(0, Math.max(2, projects.length)).map((project) => (
          <ProjectCard
            key={project.id}
            onAddExpense={() => openExpense(project)}
            onEditExpense={(expense) => openExpense(project, expense)}
            onEditProject={() => openProject(project)}
            project={project}
          />
        ))}
      </div>

      <div className="grid gap-3.5 pb-44 md:hidden">
        {projects.map((project) => (
          <MobileProjectCard
            key={project.id}
            onClick={() => {
              setSelectedProjectId(project.id);
              openProject(project);
            }}
            project={project}
          />
        ))}
      </div>

      <button
        aria-label="Create"
        className="os-primary-button fixed bottom-28 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-[18px] p-0 shadow-[0_10px_24px_rgba(224,70,26,.4)] md:hidden"
        onClick={() => setQuickAddOpen(true)}
        type="button"
      >
        <Plus size={24} />
      </button>

      {saveMessage ? <span className="sr-only" aria-live="polite">{saveMessage}</span> : null}

      <QuickAddSheet
        isOpen={quickAddOpen}
        onAddExpense={() => openExpense(selectedProject ?? projects[0])}
        onAddProject={() => openProject()}
        onClose={() => setQuickAddOpen(false)}
      />
      <ExpenseSheet
        form={expenseForm}
        isOpen={expenseOpen}
        isEditing={Boolean(editingExpenseId)}
        onAddAttachments={addAttachments}
        onClose={() => setExpenseOpen(false)}
        onDelete={
          editingExpenseId
            ? () => {
                deleteExpense(expenseProjectId, editingExpenseId);
                setExpenseOpen(false);
              }
            : undefined
        }
        onFormChange={setExpenseForm}
        onRemoveAttachment={removeAttachment}
        onSave={() => {
          void saveExpense();
        }}
        projectId={expenseProjectId}
        projects={projects}
        setProjectId={setExpenseProjectId}
      />
      <ProjectSheet
        form={projectForm}
        isOpen={projectOpen}
        isEditing={Boolean(editingProjectId)}
        onClose={() => setProjectOpen(false)}
        onDelete={editingProjectId ? () => deleteProject(editingProjectId) : undefined}
        onFormChange={setProjectForm}
        onSave={saveProject}
      />
    </section>
  );
}

function PortfolioCard({ green, label, progress, value }: { green?: boolean; label: string; progress?: number; value: string }) {
  return (
    <section className="min-h-[118px] rounded-[20px] border border-[var(--line)] bg-white px-4 py-4 shadow-[0_8px_22px_rgba(90,55,20,.05)] md:px-5 md:py-[18px]">
      <p className="text-[12px] font-bold text-[var(--muted-soft)] md:text-[12.5px]">{label}</p>
      <p className={`mt-[7px] font-mono text-[22px] font-medium tracking-normal md:text-[26px] ${green ? "text-[#2E7D52]" : "text-[var(--foreground)]"}`}>{value}</p>
      {typeof progress === "number" ? (
        <div className="mt-[9px] h-1.5 overflow-hidden rounded bg-[#EDE3D0]">
          <div className="h-full rounded bg-[linear-gradient(90deg,#F47E16,#EC5C18)]" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </section>
  );
}

function PortfolioHealth({ overProject }: { overProject?: TrackerProject }) {
  return (
    <section className="min-h-[118px] rounded-[20px] border border-[#F4D9BE] bg-[linear-gradient(135deg,#FFF4E8,#FCEBDD)] px-4 py-4 shadow-[0_8px_22px_rgba(90,55,20,.05)] md:px-5 md:py-[18px]">
      <p className="text-[12px] font-bold text-[var(--muted-soft)] md:text-[12.5px]">Portfolio health</p>
      <div className="mt-[9px] flex items-center gap-2">
        <span className={`h-[10px] w-[10px] rounded-full md:h-[11px] md:w-[11px] ${overProject ? "bg-[#F0563B]" : "bg-[#3E9E66]"}`} />
        <span className={`text-[17px] font-extrabold md:text-[19px] ${overProject ? "text-[#C24A12]" : "text-[#256B43]"}`}>{overProject ? "Review" : "On track"}</span>
      </div>
      <p className="mt-[5px] text-[11px] font-semibold leading-snug text-[var(--muted-soft)] md:text-[11.5px]">{overProject ? `${overProject.name} trending over` : "No budget issues"}</p>
    </section>
  );
}

function ProjectCard({
  onAddExpense,
  onEditExpense,
  onEditProject,
  project,
}: {
  onAddExpense: () => void;
  onEditExpense: (expense: ProjectExpense) => void;
  onEditProject: () => void;
  project: TrackerProject;
}) {
  const state = projectState(project);
  const phase = projectPhase(project);
  const overLabel = state.remaining < 0 ? `${currency(Math.abs(state.remaining))} over budget` : `${currency(state.remaining)} under budget`;
  const recentExpenses = project.expenses.slice(0, 4);
  const receipts = attachmentCount(project);

  return (
    <article className={`rounded-[22px] border bg-white p-6 shadow-[0_1px_2px_rgba(60,40,20,.04),0_10px_26px_rgba(90,55,20,.05)] ${state.over ? "border-[#F4D9BE]" : "border-[var(--line)]"}`}>
      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-3">
            <button className="min-w-0 text-left" onClick={onEditProject} type="button">
              <h2 className="truncate text-lg font-extrabold text-[var(--foreground)]">{project.name}</h2>
              <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--muted-soft)]">{project.address} · {project.type}</p>
            </button>
            <StatusPill over={state.over} />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-bold text-[var(--muted)]">Actual vs budget</span>
              <span>
                <b className="font-mono text-lg font-medium text-[var(--foreground)]">{currency(state.spent)}</b>
                <span className="text-[13px] font-semibold text-[var(--muted-soft)]"> of {currency(project.targetBudget)}</span>
              </span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-lg bg-[#EDE3D0]">
              <div className={`h-full rounded-lg ${state.over ? "bg-[linear-gradient(90deg,#F0563B,#E0461A)]" : "bg-[linear-gradient(90deg,#F47E16,#EC5C18)]"}`} style={{ width: `${Math.min(100, Math.max(3, state.percent))}%` }} />
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span className={`text-[12.5px] font-extrabold ${state.over ? "text-[#C24A12]" : "text-[#2E7D52]"}`}>{overLabel}</span>
              <span className="text-[12.5px] font-semibold text-[var(--muted-soft)]">{state.percent}% spent</span>
            </div>
          </div>

          <div className="mt-[22px]">
            <p className="mb-3 text-[12.5px] font-bold text-[var(--muted)]">Phase progress</p>
            <PhaseLine active={phase.active} labels={phase.labels} over={state.over} />
          </div>
        </div>

        <aside className="w-[340px] shrink-0 rounded-2xl border border-[var(--line)] bg-[#FBF6EC] p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-extrabold text-[var(--foreground)]">Recent expenses</h3>
              <p className="mt-px text-[10.5px] font-bold text-[var(--muted-soft)]">{receipts} receipt{receipts === 1 ? "" : "s"} saved</p>
            </div>
            <button className="text-[11.5px] font-bold text-[var(--accent-ink)]" onClick={onAddExpense} type="button">View all</button>
          </div>
          <div className="grid gap-0.5">
            {recentExpenses.length ? recentExpenses.map((expense) => (
              <button className="flex items-center justify-between gap-3 rounded-[9px] px-[7px] py-[9px] text-left hover:bg-white/70" key={expense.id} onClick={() => onEditExpense(expense)} type="button">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-[var(--foreground)]">{expense.vendor}</span>
                  <span className="mt-px block truncate text-[11px] font-semibold text-[var(--muted-soft)]">{displayDate(expense.date)} · {expense.category}</span>
                </span>
                <span className={`shrink-0 font-mono text-[13px] ${state.over && expense.amount > 2000 ? "text-[#C24A12]" : "text-[#42392E]"}`}>{currency(expense.amount)}</span>
              </button>
            )) : (
              <p className="rounded-[10px] bg-white/65 p-3 text-xs font-semibold text-[var(--muted)]">No expenses yet.</p>
            )}
          </div>
          {state.over ? (
            <div className="mt-2.5 flex gap-2 rounded-[10px] bg-[#FCEBDD] p-2.5">
              <AlertTriangle className="mt-px shrink-0 text-[#E0461A]" size={14} />
              <p className="text-[11.5px] font-bold leading-snug text-[#9A3A0E]">Review contractor change order.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

function MobileProjectCard({ onClick, project }: { onClick: () => void; project: TrackerProject }) {
  const state = projectState(project);
  const phase = projectPhase(project);

  return (
    <button className={`rounded-[18px] border bg-white p-4 text-left shadow-[0_8px_20px_rgba(90,55,20,.05)] ${state.over ? "border-[#F4D9BE]" : "border-[var(--line)]"}`} onClick={onClick} type="button">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-extrabold text-[var(--foreground)]">{project.name}</span>
          <span className="mt-px block truncate text-[11.5px] font-semibold text-[var(--muted-soft)]">{project.address}</span>
        </span>
        <StatusPill compact over={state.over} />
      </div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[15px] text-[var(--foreground)]">{shortCurrency(state.spent)}</span>
        <span className="text-[11.5px] font-semibold text-[var(--muted-soft)]">of {shortCurrency(project.targetBudget)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-md bg-[#EDE3D0]">
        <div className={`h-full rounded-md ${state.over ? "bg-[linear-gradient(90deg,#F0563B,#E0461A)]" : "bg-[linear-gradient(90deg,#F47E16,#EC5C18)]"}`} style={{ width: `${Math.min(100, Math.max(3, state.percent))}%` }} />
      </div>
      <p className={`mt-2 text-xs font-extrabold ${state.over ? "text-[#C24A12]" : "text-[#2E7D52]"}`}>
        {state.remaining < 0 ? `${shortCurrency(Math.abs(state.remaining))} over budget` : `${shortCurrency(state.remaining)} under budget`} · {phase.labels[phase.active]} phase
      </p>
      {state.over ? (
        <div className="mt-[11px] flex gap-2 rounded-[11px] bg-[#FCEBDD] p-2.5">
          <AlertTriangle className="mt-px shrink-0 text-[#E0461A]" size={14} />
          <p className="text-[11.5px] font-bold leading-snug text-[#9A3A0E]">Review change order.</p>
        </div>
      ) : null}
    </button>
  );
}

function StatusPill({ compact, over }: { compact?: boolean; over: boolean }) {
  if (over) {
    return (
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FCEBDD] font-extrabold text-[#C24A12] ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12.5px]"}`}>
        <AlertTriangle size={compact ? 12 : 13} />
        Over budget
      </span>
    );
  }

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#E6F0E5] font-extrabold text-[#256B43] ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12.5px]"}`}>
      <span className="h-2 w-2 rounded-full bg-[#3E9E66]" />
      On track
    </span>
  );
}

function PhaseLine({ active, labels, over }: { active: number; labels: string[]; over: boolean }) {
  return (
    <div className="flex items-center">
      {labels.map((label, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <div className="contents" key={label}>
            <div className="flex flex-col items-center gap-1.5">
              <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-full ${done ? "bg-[#3E9E66]" : current ? "border-[3px] border-[#FCEBDD] bg-[#F47E16]" : "border-2 border-[#E1D6BF] bg-[#F1E8D8]"}`}>
                {done ? <CheckIcon /> : current ? <span className="text-[10px] font-extrabold text-white">●</span> : null}
              </span>
              <span className={`text-[11px] font-bold ${current ? "text-[#C24A12]" : done ? "text-[var(--muted)]" : "text-[var(--muted-soft)]"}`}>{label}</span>
            </div>
            {index < labels.length - 1 ? (
              <div className={`mx-1 mb-[18px] h-[3px] flex-1 ${index < active - 1 ? "bg-[#3E9E66]" : index === active - 1 ? over ? "bg-[linear-gradient(90deg,#3E9E66,#F47E16)]" : "bg-[linear-gradient(90deg,#3E9E66,#F47E16)]" : "bg-[#EDE3D0]"}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 6" />
    </svg>
  );
}

function QuickAddSheet({ isOpen, onAddExpense, onAddProject, onClose }: { isOpen: boolean; onAddExpense: () => void; onAddProject: () => void; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] md:hidden">
      <button aria-label="Close quick add" className="absolute inset-0 bg-[rgba(34,22,12,.5)]" onClick={onClose} type="button" />
      <button aria-label="Close quick add" className="os-secondary-button absolute bottom-[118px] right-6 z-[2] flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#42392E] p-0 text-white" onClick={onClose} type="button">
        <X size={22} />
      </button>
      <div className="absolute inset-x-0 bottom-0 z-[3] rounded-t-[28px] bg-[var(--background)] px-5 pb-7 pt-2.5 shadow-[0_-14px_44px_rgba(40,25,10,.32)]">
        <div className="mx-auto mb-4 h-[5px] w-[38px] rounded bg-[#E1D6BF]" />
        <p className="mx-1 mb-3 text-xs font-extrabold uppercase tracking-[0.05em] text-[var(--muted-soft)]">Create</p>
        <QuickAddRow icon="expense" title="Add expense" subtitle="Log a cost to a project" onClick={onAddExpense} />
        <QuickAddRow icon="project" title="Add project" subtitle="Start tracking a new property" onClick={onAddProject} />
        <button className="mt-1 w-full rounded-[13px] bg-[#F1E8D8] p-3 text-sm font-bold text-[#8B7A57]" onClick={onClose} type="button">Cancel</button>
      </div>
    </div>
  );
}

function QuickAddRow({ icon, onClick, subtitle, title }: { icon: "expense" | "project"; onClick: () => void; subtitle: string; title: string }) {
  return (
    <button className="mb-[11px] flex w-full items-center gap-3.5 rounded-2xl border border-[var(--line)] bg-white p-[15px] text-left" onClick={onClick} type="button">
      <span className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] ${icon === "expense" ? "bg-[#FCEBDD] text-[#E0461A]" : "bg-[#E6F0E5] text-[#2E7D52]"}`}>
        {icon === "expense" ? <Plus size={22} /> : <Home size={22} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-extrabold text-[var(--foreground)]">{title}</span>
        <span className="mt-px block text-[12.5px] font-semibold text-[var(--muted-soft)]">{subtitle}</span>
      </span>
      <ChevronRight className="text-[#C4B79C]" size={18} />
    </button>
  );
}

function ExpenseSheet({
  form,
  isEditing,
  isOpen,
  onAddAttachments,
  onClose,
  onDelete,
  onFormChange,
  onRemoveAttachment,
  onSave,
  projectId,
  projects,
  setProjectId,
}: {
  form: ExpenseForm;
  isEditing: boolean;
  isOpen: boolean;
  onAddAttachments: (files: FileList | null) => void;
  onClose: () => void;
  onDelete?: () => void;
  onFormChange: (form: ExpenseForm) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onSave: () => void;
  projectId: string;
  projects: TrackerProject[];
  setProjectId: (projectId: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div aria-modal="true" className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(40,28,16,.42)] p-0 md:items-center md:p-8" role="dialog">
      <button aria-label="Close expense modal" className="absolute inset-0" onClick={onClose} type="button" />
      <div className="relative z-[2] w-full max-w-[460px] overflow-hidden rounded-t-[26px] bg-[var(--background)] shadow-[0_30px_80px_rgba(40,25,10,.4)] md:rounded-[22px]">
        <div className="mx-auto mt-2.5 h-[5px] w-[38px] rounded bg-[#E1D6BF] md:hidden" />
        <div className="flex items-center gap-3 px-[22px] pb-4 pt-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#FCEBDD] text-[#E0461A]">
            <Plus size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-extrabold text-[var(--foreground)]">{isEditing ? "Edit expense" : "Add expense"}</h2>
            <p className="text-xs font-semibold text-[var(--muted-soft)]">Log a cost to a project</p>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#F1E8D8] text-[#8B7A57]" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <div className="grid max-h-[calc(100dvh-168px)] gap-[13px] overflow-y-auto px-[22px] pb-2">
          <FieldLabel label="Project">
            <SelectBox value={projectId} onChange={(value) => setProjectId(value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </SelectBox>
          </FieldLabel>
          <FieldLabel label="Vendor">
            <input className="re-input" onChange={(event) => onFormChange({ ...form, vendor: event.target.value })} placeholder="e.g. Dana Contracting" value={form.vendor} />
          </FieldLabel>
          <div className="grid grid-cols-[1.2fr_1fr] gap-3">
            <FieldLabel label="Category">
              <SelectBox value={form.category} onChange={(value) => onFormChange({ ...form, category: value as ExpenseCategory })}>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </SelectBox>
            </FieldLabel>
            <FieldLabel label="Amount">
              <div className="flex items-center rounded-[11px] border border-[#E7DBC4] bg-white px-3">
                <span className="text-sm font-bold text-[#8B7A57]">$</span>
                <input className="min-w-0 flex-1 bg-transparent px-2 py-[11px] text-sm font-bold outline-none" inputMode="decimal" onChange={(event) => onFormChange({ ...form, amount: moneyInput(event.target.value) })} placeholder="0.00" value={form.amount} />
              </div>
            </FieldLabel>
          </div>
          <FieldLabel label="Date">
            <input className="re-input" onChange={(event) => onFormChange({ ...form, date: event.target.value })} type="date" value={form.date} />
          </FieldLabel>
          <FieldLabel label="Receipts & photos">
            <div className="flex flex-wrap gap-2">
              {form.attachments.map((attachment) => (
                <AttachmentThumb attachment={attachment} key={attachment.id} onRemove={() => onRemoveAttachment(attachment.id)} />
              ))}
              <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-[11px] border-[1.5px] border-dashed border-[#D8CDB6] bg-white text-[#A99B82]">
                <ImagePlus size={18} />
                <span className="text-[9px] font-bold">Add</span>
                <input accept="image/*" className="sr-only" multiple onChange={(event) => { void onAddAttachments(event.target.files); event.currentTarget.value = ""; }} type="file" />
              </label>
            </div>
          </FieldLabel>
        </div>

        <div className="mt-2 flex gap-2.5 border-t border-[var(--line)] bg-[#FDFAF3] p-4 px-[22px]">
          {onDelete ? (
            <button className="hidden rounded-[12px] border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 md:block" onClick={onDelete} type="button">Delete</button>
          ) : (
            <button className="os-secondary-button hidden flex-1 p-3 text-sm font-bold text-[var(--muted)] md:block" onClick={onClose} type="button">Cancel</button>
          )}
          <button className="os-primary-button flex-1 p-3 text-sm font-bold" onClick={onSave} type="button">
            {isEditing ? "Save expense" : "Add expense"}
          </button>
          {onDelete ? (
            <button className="rounded-[12px] border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 md:hidden" onClick={onDelete} type="button">Delete</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProjectSheet({
  form,
  isEditing,
  isOpen,
  onClose,
  onDelete,
  onFormChange,
  onSave,
}: {
  form: ProjectForm;
  isEditing: boolean;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onFormChange: (form: ProjectForm) => void;
  onSave: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div aria-modal="true" className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(40,28,16,.42)] p-0 md:items-center md:p-8" role="dialog">
      <button aria-label="Close project modal" className="absolute inset-0" onClick={onClose} type="button" />
      <div className="relative z-[2] flex max-h-[100dvh] w-full max-w-[520px] flex-col overflow-hidden bg-[var(--background)] shadow-[0_30px_80px_rgba(40,25,10,.4)] md:max-h-[92dvh] md:rounded-[22px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-[18px] py-3.5">
          <button className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-[#F1E8D8] text-[#8B7A57]" onClick={onClose} type="button">
            <X size={16} />
          </button>
          <h2 className="text-base font-extrabold text-[var(--foreground)]">{isEditing ? "Edit project" : "New project"}</h2>
          <button className="os-primary-button px-4 py-2 text-sm font-extrabold" onClick={onSave} type="button">Save</button>
        </div>
        <div className="grid flex-1 gap-3.5 overflow-y-auto p-[18px]">
          <input className="border-0 border-b-2 border-[var(--line)] bg-transparent px-0 pb-2.5 pt-1 text-[22px] font-bold text-[var(--foreground)] outline-none placeholder:text-[#B8AB91]" onChange={(event) => onFormChange({ ...form, name: event.target.value })} placeholder="Project name" value={form.name} />
          <FieldLabel label="Address"><input className="re-input" onChange={(event) => onFormChange({ ...form, address: event.target.value })} placeholder="208 Oak Avenue" value={form.address} /></FieldLabel>
          <FieldLabel label="Type">
            <SelectBox value={form.type} onChange={(value) => onFormChange({ ...form, type: value })}>
              {projectTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </SelectBox>
          </FieldLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <FieldLabel label="Budget">
              <div className="flex items-center rounded-[11px] border border-[#E7DBC4] bg-white px-3">
                <span className="text-sm font-bold text-[#8B7A57]">$</span>
                <input className="min-w-0 flex-1 bg-transparent px-2 py-[11px] text-sm font-bold outline-none" inputMode="decimal" onChange={(event) => onFormChange({ ...form, targetBudget: moneyInput(event.target.value) })} placeholder="0" value={form.targetBudget} />
              </div>
            </FieldLabel>
            <FieldLabel label="Value">
              <div className="flex items-center rounded-[11px] border border-[#E7DBC4] bg-white px-3">
                <span className="text-sm font-bold text-[#8B7A57]">$</span>
                <input className="min-w-0 flex-1 bg-transparent px-2 py-[11px] text-sm font-bold outline-none" inputMode="decimal" onChange={(event) => onFormChange({ ...form, estimatedValue: moneyInput(event.target.value) })} placeholder="0" value={form.estimatedValue} />
              </div>
            </FieldLabel>
          </div>
          <FieldLabel label="Status">
            <SelectBox value={form.status} onChange={(value) => onFormChange({ ...form, status: value as ProjectStatus })}>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </SelectBox>
          </FieldLabel>
          <FieldLabel label="Risk">
            <SelectBox value={form.risk} onChange={(value) => onFormChange({ ...form, risk: value as TrackerProject["risk"] })}>
              {["Low", "Medium", "High"].map((risk) => <option key={risk} value={risk}>{risk}</option>)}
            </SelectBox>
          </FieldLabel>
          <FieldLabel label="Next action"><input className="re-input" onChange={(event) => onFormChange({ ...form, nextAction: event.target.value })} placeholder="Next decision or action" value={form.nextAction} /></FieldLabel>
          <label className="flex h-16 w-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[11px] border-[1.5px] border-dashed border-[#D8CDB6] bg-white text-[#A99B82]">
            <Plus size={18} />
            <span className="text-[9px] font-bold">Add</span>
          </label>
          {isEditing && onDelete ? (
            <button className="rounded-[12px] border border-red-200 bg-white p-3 text-sm font-bold text-red-700" onClick={onDelete} type="button">Delete project</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--muted-soft)]">{label}</span>
      {children}
    </label>
  );
}

function SelectBox({ children, onChange, value }: { children: ReactNode; onChange: (value: string) => void; value: string }) {
  return (
    <span className="relative block">
      <select className="re-input appearance-none pr-9" onChange={(event) => onChange(event.target.value)} value={value}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A99B82]" size={15} />
    </span>
  );
}

function AttachmentThumb({ attachment, onRemove }: { attachment: ExpenseAttachmentDraft; onRemove: () => void }) {
  const isPreview = attachment.dataUrl.startsWith("data:");

  return (
    <span className="relative h-16 w-16 overflow-hidden rounded-[11px] border border-[var(--line)] bg-[repeating-linear-gradient(45deg,#F1E8D8,#F1E8D8_6px,#EAE0CC_6px,#EAE0CC_12px)]">
      {isPreview ? <Image alt={attachment.name} className="h-full w-full object-cover" height={80} src={attachment.dataUrl} unoptimized width={80} /> : null}
      <span className="absolute bottom-1 left-1 max-w-[54px] truncate font-mono text-[7.5px] text-[#8B7A57]">{attachment.name}</span>
      <button aria-label={`Remove ${attachment.name}`} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[#8B7A57]" onClick={onRemove} type="button">
        <X size={11} />
      </button>
    </span>
  );
}
