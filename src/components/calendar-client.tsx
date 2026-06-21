"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, RefreshCcw, X } from "lucide-react";
import { AppChrome } from "@/components/app-chrome";

type SyncedEvent = {
  google_event_id?: string | null;
  calendar_id?: string | null;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
};

type CalendarKind = "realestate" | "finance" | "personal";

type CalendarEvent = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  context: string;
  kind: CalendarKind;
  notes?: string;
};

type EventForm = {
  title: string;
  kind: CalendarKind;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  notes: string;
};

type EnabledCalendars = Record<CalendarKind, boolean>;

const calendarLabels: Record<CalendarKind, string> = {
  realestate: "Real Estate",
  finance: "Finance",
  personal: "Personal",
};

const calendarColors: Record<CalendarKind, { block: string; dot: string; text: string; muted: string; border: string }> = {
  realestate: {
    block: "bg-[#FCEBDD] border-l-[#E0461A]",
    dot: "#E0461A",
    text: "text-[#9A3A0E]",
    muted: "text-[#C24A12]",
    border: "border-[#F4D9BE]",
  },
  finance: {
    block: "bg-[#E6F0E5] border-l-[#3E9E66]",
    dot: "#3E9E66",
    text: "text-[#256B43]",
    muted: "text-[#3E9E66]",
    border: "border-[#D7E6D5]",
  },
  personal: {
    block: "bg-[#F1E8D8] border-l-[#B8A77F]",
    dot: "#B8A77F",
    text: "text-[#6E6456]",
    muted: "text-[#9A8E78]",
    border: "border-[#E1D6BF]",
  },
};

const hourLabels = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM"];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dateFromInput(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function dayNumber(date: Date) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date);
}

function weekday(date: Date, narrow = false) {
  return new Intl.DateTimeFormat("en-US", { weekday: narrow ? "narrow" : "short" }).format(date);
}

function longDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric" }).format(date);
}

function eventTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

function inferKind(event: SyncedEvent | { title: string; context: string }): CalendarKind {
  const text = `${event.title ?? ""} ${"context" in event ? event.context : ""}`.toLowerCase();
  if (/ledger|lender|investor|bookkeeper|finance|capital|bank/.test(text)) return "finance";
  if (/site|contractor|renovation|property|maple|oak|inspection|title|permit|real estate/.test(text)) return "realestate";
  return "personal";
}

function seedEvent(day: Date, hour: number, minute: number, durationMinutes: number, title: string, context: string, kind: CalendarKind): CalendarEvent {
  const startsAt = new Date(day);
  startsAt.setHours(hour, minute, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + durationMinutes);
  return { id: `seed-${title}-${localDateInput(day)}`, title, startsAt, endsAt, context, kind };
}

function seededWeekEvents(selectedDate: Date): CalendarEvent[] {
  const weekStart = startOfWeek(selectedDate);
  return [
    seedEvent(addDays(weekStart, 0), 10, 0, 60, "Farmers market", "Personal", "personal"),
    seedEvent(addDays(weekStart, 1), 9, 0, 30, "Standup", "Personal", "personal"),
    seedEvent(addDays(weekStart, 1), 13, 0, 60, "Lender call", "Finance", "finance"),
    seedEvent(addDays(weekStart, 2), 10, 0, 90, "Site visit · Oak Ave", "Real Estate", "realestate"),
    seedEvent(addDays(weekStart, 2), 15, 0, 60, "Dentist", "Personal", "personal"),
    seedEvent(addDays(weekStart, 3), 9, 0, 60, "Bookkeeper sync", "Finance", "finance"),
    seedEvent(addDays(weekStart, 3), 14, 0, 90, "Tile selection", "Real Estate", "realestate"),
    seedEvent(addDays(weekStart, 4), 11, 0, 60, "HOA meeting", "Real Estate", "realestate"),
    seedEvent(addDays(weekStart, 4), 17, 0, 60, "Gym", "Personal", "personal"),
    seedEvent(addDays(weekStart, 5), 9, 0, 60, "Weekly planning", "Personal", "personal"),
    seedEvent(addDays(weekStart, 5), 12, 0, 60, "Lunch w/ Sam", "Personal", "personal"),
    seedEvent(selectedDate, 9, 0, 30, "Morning planning + coffee", "Personal · 30 min", "personal"),
    seedEvent(selectedDate, 11, 0, 90, "Renovation walkthrough", "Maple St · with contractor · 90 min", "realestate"),
    seedEvent(selectedDate, 14, 0, 120, "Ledger review — month-end", "Finance · focus block · 2 hrs", "finance"),
    seedEvent(selectedDate, 18, 30, 90, "Dinner with Sam", "Personal · Bartaco", "personal"),
  ];
}

function formForDate(date: Date): EventForm {
  const startsAt = new Date(date);
  startsAt.setHours(11, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + 90);
  return {
    title: "",
    kind: "personal",
    date: localDateInput(date),
    startTime: timeInput(startsAt),
    endTime: timeInput(endsAt),
    allDay: false,
    location: "",
    notes: "",
  };
}

export function CalendarClient() {
  const [events, setEvents] = useState<SyncedEvent[]>([]);
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [savingEvent, setSavingEvent] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [desktopView, setDesktopView] = useState<"Day" | "Week" | "Month">("Week");
  const [mobileMode, setMobileMode] = useState<"relaxed" | "hourly">("relaxed");
  const [enabled, setEnabled] = useState<EnabledCalendars>({ realestate: true, finance: true, personal: true });
  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState<EventForm>(() => formForDate(new Date()));

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/data", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as { events?: SyncedEvent[] };
        setEvents(payload.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  async function syncCalendar() {
    setSyncing(true);
    setStatus("Syncing Calendar");
    try {
      const response = await fetch("/api/integrations/google/calendar/sync", { method: "POST" });
      const payload = (await response.json()) as { synced?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Calendar sync failed.");
      setStatus(`Synced ${payload.synced ?? 0} events`);
      await loadEvents();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Calendar sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  function openNewEvent(date = selectedDate) {
    setEventForm(formForDate(date));
    setEventOpen(true);
  }

  function localEventFromForm() {
    const startsAt = dateFromInput(eventForm.date, eventForm.startTime);
    const endsAt = eventForm.allDay ? null : dateFromInput(eventForm.date, eventForm.endTime);
    return {
      id: createId("event"),
      title: eventForm.title.trim() || "New event",
      startsAt,
      endsAt,
      context: eventForm.location.trim() || calendarLabels[eventForm.kind],
      kind: eventForm.kind,
      notes: eventForm.notes.trim(),
    };
  }

  async function saveNewEvent() {
    const nextEvent = localEventFromForm();
    setSavingEvent(true);
    setStatus("Creating event");

    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventForm),
      });
      const payload = (await response.json()) as { event?: SyncedEvent; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Calendar event could not be created.");
      }

      await loadEvents();
      setSelectedDate(nextEvent.startsAt);
      setEventOpen(false);
      setStatus("Added to Google Calendar");
    } catch (error) {
      setLocalEvents((current) => [nextEvent, ...current]);
      setSelectedDate(nextEvent.startsAt);
      setEventOpen(false);
      setStatus(error instanceof Error ? `Saved locally - ${error.message}` : "Saved locally");
    } finally {
      setSavingEvent(false);
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadEvents();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [loadEvents]);

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate), index)), [selectedDate]);

  const allEvents = useMemo(() => {
    const syncedEvents = events
      .filter((event) => event.starts_at)
      .map((event, index): CalendarEvent => {
        const startsAt = new Date(event.starts_at!);
        return {
          id: event.google_event_id ?? `synced-${index}-${event.starts_at}`,
          title: event.title ?? "Untitled event",
          startsAt,
          endsAt: event.ends_at ? new Date(event.ends_at) : null,
          context: event.location ?? "Google Calendar",
          kind: inferKind(event),
        };
      });

    const seeds = events.length ? [] : seededWeekEvents(selectedDate);
    return [...localEvents, ...syncedEvents, ...seeds].sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  }, [events, localEvents, selectedDate]);

  const filteredEvents = allEvents.filter((event) => enabled[event.kind]);
  const selectedDayEvents = filteredEvents.filter((event) => isSameDay(event.startsAt, selectedDate));
  const today = new Date();

  return (
    <AppChrome active="life">
      <div className="mx-auto max-w-[1158px]">
        <DesktopCalendar
          enabled={enabled}
          events={filteredEvents}
          loading={loading}
          onNewEvent={() => openNewEvent()}
          onNext={() => setSelectedDate((date) => addDays(date, 7))}
          onPrevious={() => setSelectedDate((date) => addDays(date, -7))}
          onSync={() => {
            void syncCalendar();
          }}
          onToday={() => setSelectedDate(new Date())}
          onToggleCalendar={(kind) => setEnabled((current) => ({ ...current, [kind]: !current[kind] }))}
          selectedDate={selectedDate}
          setDesktopView={setDesktopView}
          syncing={syncing}
          today={today}
          view={desktopView}
          week={week}
        />
        <MobileCalendar
          enabled={enabled}
          events={selectedDayEvents}
          mode={mobileMode}
          onModeChange={setMobileMode}
          onNewEvent={() => openNewEvent(selectedDate)}
          onSelectDate={setSelectedDate}
          onToggleCalendar={(kind) => setEnabled((current) => ({ ...current, [kind]: !current[kind] }))}
          selectedDate={selectedDate}
          status={loading ? "Refreshing" : status}
          today={today}
          week={week}
        />
        <EventSheet
          form={eventForm}
          isOpen={eventOpen}
          onClose={() => setEventOpen(false)}
          onFormChange={setEventForm}
          onSave={saveNewEvent}
          saving={savingEvent}
        />
      </div>
    </AppChrome>
  );
}

function DesktopCalendar({
  enabled,
  events,
  loading,
  onNewEvent,
  onNext,
  onPrevious,
  onSync,
  onToday,
  onToggleCalendar,
  selectedDate,
  setDesktopView,
  syncing,
  today,
  view,
  week,
}: {
  enabled: EnabledCalendars;
  events: CalendarEvent[];
  loading: boolean;
  onNewEvent: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSync: () => void;
  onToday: () => void;
  onToggleCalendar: (kind: CalendarKind) => void;
  selectedDate: Date;
  setDesktopView: (view: "Day" | "Week" | "Month") => void;
  syncing: boolean;
  today: Date;
  view: "Day" | "Week" | "Month";
  week: Date[];
}) {
  return (
    <section className="hidden overflow-hidden rounded-[22px] border border-[var(--line-strong)] bg-[var(--background)] shadow-[0_2px_6px_rgba(80,50,20,.06),0_18px_46px_rgba(80,50,20,.09)] md:block">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-7 py-[18px]">
        <div className="flex items-center gap-4">
          <h1 className="text-[22px] font-extrabold tracking-normal text-[var(--foreground)]">{monthTitle(selectedDate)}</h1>
          <div className="flex items-center gap-1">
            <IconButton ariaLabel="Previous week" onClick={onPrevious}><ChevronLeft size={16} /></IconButton>
            <IconButton ariaLabel="Next week" onClick={onNext}><ChevronRight size={16} /></IconButton>
          </div>
          <button className="rounded-[10px] bg-[#FCEBDD] px-3.5 py-[7px] text-[13px] font-bold text-[var(--accent-ink)]" onClick={onToday} type="button">
            Today
          </button>
          <span className="text-xs font-bold text-[var(--muted-soft)]">{loading ? "Refreshing" : longDay(today)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-[11px] bg-[#F1E8D8] p-[3px]">
            {(["Day", "Week", "Month"] as const).map((option) => (
              <button
                className={`rounded-lg px-[13px] py-1.5 text-[13px] font-bold ${view === option ? "bg-white text-[var(--foreground)] shadow-[0_1px_3px_rgba(0,0,0,.06)]" : "text-[#8B8173]"}`}
                key={option}
                onClick={() => setDesktopView(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
          <IconButton ariaLabel="Sync Calendar" onClick={onSync}>
            <RefreshCcw className={syncing ? "animate-spin text-[var(--accent-hot)]" : "text-[var(--accent-hot)]"} size={16} />
          </IconButton>
          <button className="os-primary-button flex h-10 items-center gap-2 px-4 text-sm font-bold" onClick={onNewEvent} type="button">
            <Plus size={16} />
            New event
          </button>
        </div>
      </header>

      <div className="flex items-center gap-[9px] border-b border-[var(--line)] px-7 py-[11px]">
        <span className="mr-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--muted-faint)]">Calendars</span>
        {(["realestate", "finance", "personal"] as const).map((kind) => (
          <CalendarChip enabled={enabled[kind]} kind={kind} key={kind} onClick={() => onToggleCalendar(kind)} />
        ))}
      </div>

      <div className="flex border-b border-[var(--line)] px-6">
        <div className="w-14 shrink-0" />
        {week.map((date) => {
          const active = isSameDay(date, selectedDate) || isSameDay(date, today);
          return (
            <button className="flex flex-1 flex-col items-center py-[11px]" key={date.toISOString()} type="button">
              <span className={`text-[11.5px] font-bold uppercase tracking-[0.04em] ${active ? "text-[var(--accent-hot)]" : "text-[var(--muted-soft)]"}`}>{weekday(date)}</span>
              <span className={`mt-[3px] flex h-[34px] min-w-[34px] items-center justify-center rounded-full text-lg font-extrabold ${active ? "bg-[linear-gradient(135deg,#F47E16,#E84B1B)] text-white shadow-[0_6px_14px_rgba(224,70,26,.3)]" : "text-[var(--muted)]"}`}>
                {dayNumber(date)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="max-h-[690px] overflow-y-auto px-6 pb-6 pt-1">
        <div className="flex">
          <div className="w-14 shrink-0">
            {hourLabels.map((label) => (
              <div className="relative h-14" key={label}>
                <span className="absolute -top-[7px] right-2.5 text-[11px] font-semibold text-[var(--muted-faint)]">{label}</span>
              </div>
            ))}
          </div>
          {week.map((date) => (
            <DayColumn events={events.filter((event) => isSameDay(event.startsAt, date))} isToday={isSameDay(date, today)} key={date.toISOString()} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MobileCalendar({
  enabled,
  events,
  mode,
  onModeChange,
  onNewEvent,
  onSelectDate,
  onToggleCalendar,
  selectedDate,
  status,
  today,
  week,
}: {
  enabled: EnabledCalendars;
  events: CalendarEvent[];
  mode: "relaxed" | "hourly";
  onModeChange: (mode: "relaxed" | "hourly") => void;
  onNewEvent: () => void;
  onSelectDate: (date: Date) => void;
  onToggleCalendar: (kind: CalendarKind) => void;
  selectedDate: Date;
  status: string;
  today: Date;
  week: Date[];
}) {
  return (
    <section className="pb-36 md:hidden">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[25px] font-extrabold tracking-normal text-[var(--foreground)]">{monthTitle(selectedDate)}</h1>
          <p className="mt-1 text-[12.5px] font-bold text-[var(--muted-soft)]">
            {new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric" }).format(selectedDate)}
            {isSameDay(selectedDate, today) ? " · Today" : ""}
          </p>
        </div>
        <button
          aria-label="New event"
          className="os-primary-button flex h-[42px] w-[42px] items-center justify-center rounded-[13px] p-0 shadow-[0_6px_16px_rgba(224,70,26,.3)]"
          onClick={onNewEvent}
          type="button"
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="mb-3 flex gap-1.5">
        {week.map((date) => {
          const active = isSameDay(date, selectedDate);
          return (
            <button
              className={`flex flex-1 flex-col items-center gap-1 rounded-[13px] py-2 ${active ? "bg-[linear-gradient(135deg,#F47E16,#E84B1B)] text-white shadow-[0_6px_14px_rgba(224,70,26,.3)]" : "text-[var(--muted)]"}`}
              key={date.toISOString()}
              onClick={() => onSelectDate(date)}
              type="button"
            >
              <span className={`text-[10.5px] font-bold ${active ? "text-[#FFE3CC]" : "text-[var(--muted-soft)]"}`}>{weekday(date, true)}</span>
              <span className="text-[15px] font-extrabold">{dayNumber(date)}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="flex rounded-[11px] bg-[#F1E8D8] p-[3px]">
          <button className={`rounded-[9px] px-[18px] py-[7px] text-[12.5px] font-bold ${mode === "relaxed" ? "bg-white text-[var(--accent-ink)] shadow-[0_1px_3px_rgba(120,70,20,.1)]" : "text-[#8B8173]"}`} onClick={() => onModeChange("relaxed")} type="button">
            Relaxed
          </button>
          <button className={`rounded-[9px] px-[18px] py-[7px] text-[12.5px] font-bold ${mode === "hourly" ? "bg-white text-[var(--accent-ink)] shadow-[0_1px_3px_rgba(120,70,20,.1)]" : "text-[#8B8173]"}`} onClick={() => onModeChange("hourly")} type="button">
            Hourly
          </button>
        </div>
        <span className="min-w-0 truncate text-[11px] font-bold text-[var(--muted-soft)]">{status}</span>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {(["realestate", "finance", "personal"] as const).map((kind) => (
          <CalendarChip enabled={enabled[kind]} kind={kind} key={kind} onClick={() => onToggleCalendar(kind)} />
        ))}
      </div>

      {mode === "relaxed" ? <MobileRelaxedEvents events={events} /> : <MobileHourlyEvents events={events} />}
    </section>
  );
}

function DayColumn({ events, isToday }: { events: CalendarEvent[]; isToday: boolean }) {
  return (
    <div
      className={`relative h-[672px] flex-1 border-l border-[var(--line)] ${
        isToday
          ? "bg-[repeating-linear-gradient(#FFF8EE_0_55px,#F6E9D2_55px_56px)]"
          : "bg-[repeating-linear-gradient(#FBF5EA_0_55px,#EDE3D0_55px_56px)]"
      }`}
    >
      {events.map((event) => (
        <DesktopEventBlock event={event} key={event.id} />
      ))}
    </div>
  );
}

function DesktopEventBlock({ event }: { event: CalendarEvent }) {
  const startHour = event.startsAt.getHours() + event.startsAt.getMinutes() / 60;
  const endHour = event.endsAt ? event.endsAt.getHours() + event.endsAt.getMinutes() / 60 : startHour + 0.75;
  const top = Math.max(0, (startHour - 8) * 56);
  const height = Math.max(24, (endHour - startHour) * 56);
  const color = calendarColors[event.kind];
  const todayFeature = event.kind === "realestate" && /renovation|walkthrough/i.test(event.title);

  if (todayFeature) {
    return (
      <article className="absolute left-[5px] right-[5px] overflow-hidden rounded-[9px] bg-[linear-gradient(135deg,#F47E16,#E84B1B)] p-[7px_9px] shadow-[0_6px_16px_rgba(224,70,26,.3)]" style={{ top, height }}>
        <p className="line-clamp-2 text-[11.5px] font-extrabold text-white">{event.title}</p>
        <p className="mt-0.5 text-[10.5px] font-semibold text-[#FFE3CC]">{eventTime(event.startsAt)} · {event.context.replace(/^.*?·\s*/, "")}</p>
      </article>
    );
  }

  return (
    <article className={`absolute left-[5px] right-[5px] overflow-hidden rounded-lg border-l-[3px] p-[6px_8px] ${color.block}`} style={{ top, height }}>
      <p className={`line-clamp-2 text-[11.5px] font-extrabold ${color.text}`}>{event.title}</p>
      <p className={`mt-0.5 text-[10.5px] font-semibold ${color.muted}`}>{eventTime(event.startsAt)}</p>
    </article>
  );
}

function MobileRelaxedEvents({ events }: { events: CalendarEvent[] }) {
  if (!events.length) {
    return (
      <div className="rounded-[18px] border border-[var(--line)] bg-white p-5 text-center">
        <p className="text-sm font-extrabold text-[var(--foreground)]">No events scheduled</p>
        <p className="mt-1 text-xs font-semibold text-[var(--muted-soft)]">A quiet block is protected here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {events.map((event) => {
        const color = calendarColors[event.kind];
        const feature = event.kind === "realestate" && /renovation|walkthrough/i.test(event.title);
        return (
          <div className="flex gap-3" key={event.id}>
            <div className="w-[50px] shrink-0 pt-[9px] text-right">
              <div className={`text-[13px] font-extrabold ${feature ? "text-[var(--accent-hot)]" : "text-[var(--foreground)]"}`}>{eventTime(event.startsAt).replace(":00", "")}</div>
              <div className={`text-[10px] font-semibold ${feature ? "text-[#E08A4E]" : "text-[var(--muted-faint)]"}`}>
                {event.startsAt.getHours() < 12 ? "AM" : "PM"}
              </div>
            </div>
            <article className={`flex-1 rounded-[11px] border-l-[3px] p-[11px_13px] ${feature ? "border-l-transparent bg-[linear-gradient(135deg,#F47E16,#E84B1B)] shadow-[0_8px_20px_rgba(224,70,26,.3)]" : color.block}`}>
              <p className={`text-[13.5px] font-bold ${feature ? "text-white" : color.text}`}>{event.title}</p>
              <p className={`mt-0.5 text-xs font-medium ${feature ? "text-[#FFE3CC]" : color.muted}`}>{event.context}</p>
            </article>
          </div>
        );
      })}
    </div>
  );
}

function MobileHourlyEvents({ events }: { events: CalendarEvent[] }) {
  return (
    <div>
      <div className="flex pt-0.5">
        <div className="w-11 shrink-0">
          {hourLabels.map((label) => (
            <div className="h-[52px] pr-[7px] text-right" key={label}>
              <span className="relative -top-[5px] text-[9.5px] font-semibold text-[var(--muted-faint)]">{label}</span>
            </div>
          ))}
        </div>
        <div className="relative h-[624px] flex-1 border-l border-[var(--line)] bg-[repeating-linear-gradient(#FBF5EA_0_51px,#EDE3D0_51px_52px)]">
          {events.map((event) => {
            const color = calendarColors[event.kind];
            const startHour = event.startsAt.getHours() + event.startsAt.getMinutes() / 60;
            const endHour = event.endsAt ? event.endsAt.getHours() + event.endsAt.getMinutes() / 60 : startHour + 0.75;
            const top = Math.max(0, (startHour - 8) * 52);
            const height = Math.max(26, (endHour - startHour) * 52);
            const feature = event.kind === "realestate" && /renovation|walkthrough/i.test(event.title);
            return (
              <article className={`absolute left-1.5 right-1.5 overflow-hidden rounded-lg border-l-[3px] p-[6px_10px] ${feature ? "border-l-transparent bg-[linear-gradient(135deg,#F47E16,#E84B1B)] shadow-[0_6px_14px_rgba(224,70,26,.3)]" : color.block}`} key={event.id} style={{ top, height }}>
                <p className={`line-clamp-2 text-[11.5px] font-extrabold ${feature ? "text-white" : color.text}`}>{event.title}</p>
                <p className={`text-[10px] font-semibold ${feature ? "text-[#FFE3CC]" : color.muted}`}>{eventTime(event.startsAt)}</p>
              </article>
            );
          })}
        </div>
      </div>
      <p className="pb-2 pt-3 text-center text-[11.5px] font-bold text-[var(--muted-soft)]">Tap New event to add a block</p>
    </div>
  );
}

function CalendarChip({ enabled, kind, onClick }: { enabled: boolean; kind: CalendarKind; onClick: () => void }) {
  const color = calendarColors[kind];
  return (
    <button
      className={`flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 py-1.5 text-[12px] font-bold transition md:gap-2 md:px-3 md:text-[12.5px] ${enabled ? "bg-white text-[#42392E]" : "bg-transparent text-[var(--muted-faint)] opacity-70"}`}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] md:h-[15px] md:w-[15px]" style={{ background: enabled ? color.dot : "transparent", border: enabled ? "0" : "1.5px solid #D8CDB6" }}>
        {enabled ? <CheckMark /> : null}
      </span>
      {calendarLabels[kind]}
    </button>
  );
}

function EventSheet({
  form,
  isOpen,
  onClose,
  onFormChange,
  onSave,
  saving,
}: {
  form: EventForm;
  isOpen: boolean;
  onClose: () => void;
  onFormChange: (form: EventForm) => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div aria-modal="true" className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(40,28,16,.42)] p-0 md:items-center md:p-8" role="dialog">
      <button aria-label="Close new event" className="absolute inset-0" onClick={onClose} type="button" />
      <div className="relative z-[2] flex max-h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-[var(--background)] shadow-[0_30px_80px_rgba(40,25,10,.4)] md:max-h-[92dvh] md:rounded-[22px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-[18px] py-3.5">
          <button className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-[#F1E8D8] text-[#8B7A57]" onClick={onClose} type="button">
            <X size={16} />
          </button>
          <h2 className="text-base font-extrabold text-[var(--foreground)]">New event</h2>
          <button className="os-primary-button px-4 py-2 text-sm font-extrabold disabled:cursor-wait disabled:opacity-70" disabled={saving} onClick={onSave} type="button">
            {saving ? "Saving" : "Save"}
          </button>
        </div>

        <div className="grid flex-1 gap-3.5 overflow-y-auto p-[18px]">
          <input
            className="border-0 border-b-2 border-[var(--line)] bg-transparent px-0 pb-2.5 pt-1 text-[22px] font-bold text-[var(--foreground)] outline-none placeholder:text-[#B8AB91]"
            onChange={(event) => onFormChange({ ...form, title: event.target.value })}
            placeholder="Add title"
            value={form.title}
          />
          <FieldRow icon={<CalendarDot color={calendarColors[form.kind].dot} />}>
            <select className="w-full appearance-none bg-transparent text-[14px] font-bold text-[var(--foreground)] outline-none" onChange={(event) => onFormChange({ ...form, kind: event.target.value as CalendarKind })} value={form.kind}>
              {(["personal", "realestate", "finance"] as const).map((kind) => <option key={kind} value={kind}>{calendarLabels[kind]}</option>)}
            </select>
            <ChevronDown className="text-[#A99B82]" size={15} />
          </FieldRow>
          <div className="overflow-hidden rounded-[13px] border border-[var(--line)] bg-white">
            <DateTimeRow label="Starts">
              <input className="w-[128px] shrink-0 bg-transparent text-right text-[13px] font-bold text-[var(--muted)] outline-none" onChange={(event) => onFormChange({ ...form, date: event.target.value })} type="date" value={form.date} />
              <input className="w-[116px] shrink-0 bg-transparent text-right text-[13px] font-bold text-[var(--muted)] outline-none" onChange={(event) => onFormChange({ ...form, startTime: event.target.value })} type="time" value={form.startTime} />
            </DateTimeRow>
            <DateTimeRow label="Ends">
              <input className="w-[128px] shrink-0 bg-transparent text-right text-[13px] font-bold text-[var(--muted)] outline-none" onChange={(event) => onFormChange({ ...form, date: event.target.value })} type="date" value={form.date} />
              <input className="w-[116px] shrink-0 bg-transparent text-right text-[13px] font-bold text-[var(--muted)] outline-none" disabled={form.allDay} onChange={(event) => onFormChange({ ...form, endTime: event.target.value })} type="time" value={form.endTime} />
            </DateTimeRow>
          </div>
          <FieldRow icon={<CalendarDays size={18} />}>
            <span className="flex-1 text-[13.5px] font-bold text-[#42392E]">All-day</span>
            <button className={`relative h-6 w-[42px] rounded-full ${form.allDay ? "bg-[var(--accent)]" : "bg-[#E1D6BF]"}`} onClick={() => onFormChange({ ...form, allDay: !form.allDay })} type="button">
              <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition ${form.allDay ? "left-[21px]" : "left-[3px]"}`} />
            </button>
          </FieldRow>
          <FieldRow icon={<MapPin size={18} />}>
            <input className="min-w-0 flex-1 bg-transparent text-[13.5px] font-semibold text-[var(--foreground)] outline-none placeholder:text-[#A99B82]" onChange={(event) => onFormChange({ ...form, location: event.target.value })} placeholder="Add location" value={form.location} />
          </FieldRow>
          <FieldRow icon={<Clock3 size={18} />}>
            <textarea className="min-h-16 min-w-0 flex-1 resize-none bg-transparent text-[13.5px] font-semibold text-[var(--foreground)] outline-none placeholder:text-[#A99B82]" onChange={(event) => onFormChange({ ...form, notes: event.target.value })} placeholder="Add notes" value={form.notes} />
          </FieldRow>
        </div>
      </div>
    </div>
  );
}

function IconButton({ ariaLabel, children, onClick }: { ariaLabel: string; children: ReactNode; onClick: () => void }) {
  return (
    <button aria-label={ariaLabel} className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[var(--line)] bg-white text-[var(--muted)]" onClick={onClick} type="button">
      {children}
    </button>
  );
}

function FieldRow({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-[11px] rounded-[13px] border border-[var(--line)] bg-white p-[13px] text-[#8B7A57]">
      {icon}
      {children}
    </div>
  );
}

function DateTimeRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-[11px] border-b border-[#F1E8D8] p-[13px] last:border-b-0">
      <Clock3 className="shrink-0 text-[#8B7A57]" size={18} />
      <span className="flex-1 text-[13.5px] font-bold text-[#42392E]">{label}</span>
      {children}
    </div>
  );
}

function CalendarDot({ color }: { color: string }) {
  return <span className="h-[13px] w-[13px] shrink-0 rounded-[4px]" style={{ background: color }} />;
}

function CheckMark() {
  return (
    <svg fill="none" height="11" viewBox="0 0 24 24" width="11" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5">
      <path d="M5 12l5 5L20 6" />
    </svg>
  );
}
