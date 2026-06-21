import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Inbox,
  Landmark,
  MailWarning,
  MessageSquareText,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DayPart = "morning" | "midday" | "evening" | "night";

export type BriefItem = {
  label: string;
  value: string;
  tone: "neutral" | "good" | "warning" | "danger";
};

export type DashboardMetric = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export type InboxItem = {
  from: string;
  subject: string;
  urgency: "High" | "Medium" | "Low";
  summary: string;
};

export type CalendarItem = {
  time: string;
  title: string;
  context: string;
};

export type MarketItem = {
  symbol: string;
  name: string;
  price: string;
  change: string;
  direction: "up" | "down";
};

export type ExpenseCategory =
  | "Materials"
  | "Labor"
  | "Permits"
  | "Inspection"
  | "Financing"
  | "Legal"
  | "Utilities"
  | "Insurance"
  | "Other";

export type ExpenseAttachment = {
  id: string;
  name: string;
  dataUrl: string;
};

export type ProjectExpense = {
  id: string;
  category: ExpenseCategory;
  vendor: string;
  amount: number;
  date: string;
  status: "Paid" | "Unpaid";
  notes: string;
  attachments: ExpenseAttachment[];
};

export type ProjectStatus =
  | "Lead"
  | "Under review"
  | "Offer submitted"
  | "Under contract"
  | "Due diligence"
  | "Financing"
  | "Closing"
  | "Renovation"
  | "Listed / leased"
  | "Complete";

export type TrackerProject = {
  id: string;
  name: string;
  address: string;
  type: string;
  status: ProjectStatus;
  nextAction: string;
  due: string;
  risk: "Low" | "Medium" | "High";
  estimatedValue: number;
  purchasePrice: number;
  targetBudget: number;
  progress: number;
  notes: string;
  expenses: ProjectExpense[];
};

export const dayPartBriefs: Record<DayPart, string> = {
  morning:
    "Start with schedule shape, urgent messages, market movement, and the single most important project decision.",
  midday:
    "Refocus on what changed since morning, which meetings need prep, and which threads need replies before close of business.",
  evening:
    "Wrap open loops, surface tomorrow's first commitments, and identify any project risk that should not wait overnight.",
  night:
    "Keep it quiet: completion check, tomorrow preview, and anything that needs to be parked so the morning starts clean.",
};

export const briefItems: BriefItem[] = [
  {
    label: "Remaining focus block",
    value: "2h 20m open before 5 PM",
    tone: "good",
  },
  {
    label: "Needs response",
    value: "3 email threads",
    tone: "warning",
  },
  {
    label: "Project risk",
    value: "Oak Ridge inspection docs",
    tone: "danger",
  },
];

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: "Meetings left",
    value: "4",
    detail: "Next starts at 1:30 PM",
    icon: CalendarClock,
  },
  {
    label: "Inbox pressure",
    value: "7",
    detail: "3 likely need action",
    icon: Inbox,
  },
  {
    label: "Tracked projects",
    value: "5",
    detail: "2 need movement today",
    icon: Landmark,
  },
  {
    label: "Market pulse",
    value: "+0.42%",
    detail: "Watchlist weighted move",
    icon: TrendingUp,
  },
];

export const inboxItems: InboxItem[] = [
  {
    from: "Northline Lending",
    subject: "Updated term sheet for Maple Ave",
    urgency: "High",
    summary: "Rate lock expires tomorrow. Assistant should compare terms against last version.",
  },
  {
    from: "City Permits",
    subject: "Oak Ridge inspection window",
    urgency: "High",
    summary: "Requires confirmation by 3 PM or the slot moves to next week.",
  },
  {
    from: "Cedar Title",
    subject: "Closing package received",
    urgency: "Medium",
    summary: "Documents are ready for review; no blocker detected yet.",
  },
];

export const calendarItems: CalendarItem[] = [
  {
    time: "1:30 PM",
    title: "Contractor check-in",
    context: "Prep: punch list, roof quote, inspection photos.",
  },
  {
    time: "3:00 PM",
    title: "Investor call",
    context: "AI should summarize current capital stack and open asks.",
  },
  {
    time: "4:15 PM",
    title: "Site review notes",
    context: "Convert notes into tracker updates afterward.",
  },
];

export const marketItems: MarketItem[] = [
  {
    symbol: "SPY",
    name: "S&P 500 ETF",
    price: "642.18",
    change: "+0.38%",
    direction: "up",
  },
  {
    symbol: "QQQ",
    name: "Nasdaq 100 ETF",
    price: "512.04",
    change: "+0.56%",
    direction: "up",
  },
  {
    symbol: "VNQ",
    name: "Real Estate ETF",
    price: "91.22",
    change: "-0.14%",
    direction: "down",
  },
];

export const realEstateProjects: TrackerProject[] = [
  {
    id: "project-maple-ave",
    name: "Maple Ave Duplex",
    address: "1420 Maple Ave",
    type: "Duplex",
    status: "Financing",
    nextAction: "Review lender term sheet and confirm rate lock.",
    due: "Tomorrow",
    risk: "Medium",
    estimatedValue: 740000,
    purchasePrice: 560000,
    targetBudget: 82000,
    progress: 62,
    notes: "Confirm whether the updated lender terms still support the original cash-on-cash target.",
    expenses: [
      {
        id: "expense-maple-inspection",
        category: "Inspection",
        vendor: "Northline Property Review",
        amount: 850,
        date: "2026-06-16",
        status: "Paid",
        notes: "General inspection and sewer scope.",
        attachments: [],
      },
      {
        id: "expense-maple-legal",
        category: "Legal",
        vendor: "Cedar Title",
        amount: 1250,
        date: "2026-06-18",
        status: "Unpaid",
        notes: "Initial closing package review.",
        attachments: [],
      },
    ],
  },
  {
    id: "project-oak-ridge",
    name: "Oak Ridge Rehab",
    address: "88 Oak Ridge Ct",
    type: "Single family rehab",
    status: "Due diligence",
    nextAction: "Confirm inspection slot and upload city forms.",
    due: "Today, 3 PM",
    risk: "High",
    estimatedValue: 415000,
    purchasePrice: 286000,
    targetBudget: 64000,
    progress: 38,
    notes: "Main uncertainty is permit timing. Keep inspection and city paperwork visible.",
    expenses: [
      {
        id: "expense-oak-permit",
        category: "Permits",
        vendor: "City Permits Office",
        amount: 620,
        date: "2026-06-17",
        status: "Paid",
        notes: "Renovation permit filing.",
        attachments: [],
      },
      {
        id: "expense-oak-demo",
        category: "Labor",
        vendor: "Horizon Demo Crew",
        amount: 4800,
        date: "2026-06-19",
        status: "Unpaid",
        notes: "Deposit for phase-one demolition.",
        attachments: [],
      },
    ],
  },
  {
    id: "project-cedar-close",
    name: "Cedar Title Close",
    address: "301 Cedar St",
    type: "Small multifamily",
    status: "Closing",
    nextAction: "Scan closing package for signature gaps.",
    due: "Friday",
    risk: "Low",
    estimatedValue: 1100000,
    purchasePrice: 910000,
    targetBudget: 35000,
    progress: 84,
    notes: "Most items are complete. Watch final title and insurance confirmations.",
    expenses: [
      {
        id: "expense-cedar-title",
        category: "Legal",
        vendor: "Cedar Title",
        amount: 3200,
        date: "2026-06-14",
        status: "Paid",
        notes: "Title and closing services.",
        attachments: [],
      },
    ],
  },
];

export const roadmap = [
  {
    title: "Foundation",
    status: "In progress",
    detail: "Dashboard shell, AI brief patterns, project tracker, mock data contracts.",
    icon: ShieldCheck,
  },
  {
    title: "Google integrations",
    status: "Next",
    detail: "OAuth, Gmail read-only sync, Calendar read/write, source citations for AI.",
    icon: MailWarning,
  },
  {
    title: "Market data",
    status: "Next",
    detail: "Watchlists, public quote APIs, open/close awareness, price alerts.",
    icon: CircleDollarSign,
  },
  {
    title: "Project intelligence",
    status: "Soon",
    detail: "Risk detection, task extraction, document checklist, deal-memory feedback.",
    icon: BadgeDollarSign,
  },
  {
    title: "Address autocomplete",
    status: "Parked",
    detail: "Revisit Google Places address suggestions after the core real estate workflow is stable.",
    icon: Landmark,
  },
  {
    title: "Assistant memory",
    status: "Controlled",
    detail: "Explicit preferences, approved memories, behavior feedback, audit trail.",
    icon: MessageSquareText,
  },
];

export const assistantPrinciples = [
  {
    icon: FileText,
    title: "Traceable",
    text: "Every recommendation should link back to the email, event, project, or market source that caused it.",
  },
  {
    icon: AlertTriangle,
    title: "Permissioned",
    text: "The assistant can suggest memory updates, but important long-term assumptions need approval.",
  },
  {
    icon: Clock3,
    title: "Time-aware",
    text: "Morning, midday, evening, and night briefs should use different priorities and levels of detail.",
  },
  {
    icon: CheckCircle2,
    title: "Action-first",
    text: "The brief should always end with the next best action, not a pile of raw information.",
  },
  {
    icon: ArrowUpRight,
    title: "Expandable",
    text: "Each dashboard panel should graduate into a deeper tool without changing the main app shell.",
  },
];
