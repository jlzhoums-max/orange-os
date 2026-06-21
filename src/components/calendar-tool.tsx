"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCcw,
  UserPlus,
} from "lucide-react";

type CalendarAccount = {
  id: string;
  account_email: string | null;
  avatar_url?: string | null;
  display_name: string | null;
  is_primary: boolean;
};

type SyncedCalendar = {
  id: string;
  connected_account_id: string;
  google_calendar_id: string;
  summary: string | null;
  description: string | null;
  time_zone: string | null;
  background_color: string | null;
  foreground_color: string | null;
  access_role: string | null;
  is_primary: boolean;
  selected: boolean;
  updated_at: string;
};

type CalendarEvent = {
  id: string;
  connected_account_id: string | null;
  calendar_id: string;
  google_event_id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  attendees: unknown;
  status: string | null;
  html_link: string | null;
  all_day: boolean;
  time_zone: string | null;
};

type CreateEventForm = {
  attendees: string;
  calendarKey: string;
  description: string;
  endsAt: string;
  location: string;
  startsAt: string;
  title: string;
};

const writableRoles = new Set(["writer", "owner"]);

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDatetimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function defaultForm(calendarKey = ""): CreateEventForm {
  const startsAt = new Date();
  startsAt.setMinutes(0, 0, 0);
  startsAt.setHours(startsAt.getHours() + 1);
  const endsAt = new Date(startsAt);
  endsAt.setHours(startsAt.getHours() + 1);

  return {
    attendees: "",
    calendarKey,
    description: "",
    endsAt: toDatetimeLocal(endsAt),
    location: "",
    startsAt: toDatetimeLocal(startsAt),
    title: "",
  };
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(date);
}

function formatTime(value: string | null, allDay?: boolean) {
  if (!value) {
    return "TBD";
  }

  if (allDay) {
    return "All day";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function calendarKey(calendar: SyncedCalendar) {
  return `${calendar.connected_account_id}::${calendar.google_calendar_id}`;
}

function eventCalendarKey(event: CalendarEvent) {
  return `${event.connected_account_id ?? ""}::${event.calendar_id}`;
}

function calendarColor(calendar?: SyncedCalendar) {
  return calendar?.background_color || "#f47e16";
}

function canWrite(calendar: SyncedCalendar) {
  return writableRoles.has(calendar.access_role ?? "");
}

export function CalendarTool({ initialMessage = null }: { initialMessage?: string | null }) {
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [calendars, setCalendars] = useState<SyncedCalendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage);

  const writableCalendars = useMemo(() => calendars.filter(canWrite), [calendars]);
  const [form, setForm] = useState<CreateEventForm>(() => defaultForm());

  const calendarsByKey = useMemo(() => {
    return new Map(calendars.map((calendar) => [calendarKey(calendar), calendar]));
  }, [calendars]);

  const calendarsByEventKey = useMemo(() => {
    return new Map(calendars.map((calendar) => [calendarKey(calendar), calendar]));
  }, [calendars]);

  const loadCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsResponse, calendarsResponse] = await Promise.all([
        fetch("/api/calendar/accounts"),
        fetch("/api/calendar/calendars"),
      ]);

      if (!accountsResponse.ok || !calendarsResponse.ok) {
        throw new Error("Calendar data could not load.");
      }

      const accountsData = (await accountsResponse.json()) as { accounts: CalendarAccount[] };
      const calendarsData = (await calendarsResponse.json()) as { calendars: SyncedCalendar[] };
      const nextCalendars = calendarsData.calendars ?? [];
      const defaultSelected = new Set(nextCalendars.filter((calendar) => calendar.selected).map(calendarKey));
      const eventsUrl = new URL("/api/calendar/events", window.location.origin);
      const eventsResponse = await fetch(eventsUrl);

      if (!eventsResponse.ok) {
        throw new Error("Calendar events could not load.");
      }

      const eventsData = (await eventsResponse.json()) as { events: CalendarEvent[] };
      setAccounts(accountsData.accounts ?? []);
      setCalendars(nextCalendars);
      setSelectedKeys(defaultSelected);
      setEvents(eventsData.events ?? []);

      const firstWritable = nextCalendars.find(canWrite);
      setForm((current) => ({
        ...current,
        calendarKey: current.calendarKey || (firstWritable ? calendarKey(firstWritable) : ""),
      }));
    } catch (error) {
      setMessage((current) => current ?? (error instanceof Error ? error.message : "Calendar data could not load."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCalendarData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadCalendarData]);

  const visibleEvents = useMemo(() => {
    if (!selectedKeys.size) {
      return events;
    }

    return events.filter((event) => selectedKeys.has(eventCalendarKey(event)));
  }, [events, selectedKeys]);

  const weekDays = useMemo(() => {
    const start = startOfToday();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const day of weekDays) {
      map.set(day.toISOString().slice(0, 10), []);
    }

    for (const event of visibleEvents) {
      if (!event.starts_at) {
        continue;
      }

      const key = new Date(event.starts_at).toISOString().slice(0, 10);
      const list = map.get(key);

      if (list) {
        list.push(event);
      }
    }

    return map;
  }, [visibleEvents, weekDays]);

  async function syncCalendars() {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/google/calendar/sync", { method: "POST" });
      const payload = (await response.json()) as { synced?: number; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Calendar sync failed.");
      }

      setMessage(`Synced ${payload.synced ?? 0} events from Google Calendar.`);
      await loadCalendarData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Calendar sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function toggleCalendar(calendar: SyncedCalendar) {
    const key = calendarKey(calendar);
    const nextSelected = !selectedKeys.has(key);

    setSelectedKeys((current) => {
      const next = new Set(current);
      if (nextSelected) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
    setCalendars((current) =>
      current.map((item) =>
        calendarKey(item) === key ? { ...item, selected: nextSelected } : item,
      ),
    );

    try {
      const response = await fetch("/api/calendar/calendars", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectedAccountId: calendar.connected_account_id,
          googleCalendarId: calendar.google_calendar_id,
          selected: nextSelected,
        }),
      });

      if (!response.ok) {
        throw new Error("Calendar visibility could not be saved.");
      }
    } catch (error) {
      setSelectedKeys((current) => {
        const next = new Set(current);
        if (nextSelected) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      setCalendars((current) =>
        current.map((item) =>
          calendarKey(item) === key ? { ...item, selected: !nextSelected } : item,
        ),
      );
      setMessage(error instanceof Error ? error.message : "Calendar visibility could not be saved.");
    }
  }

  async function createEvent() {
    const selectedCalendar = calendarsByKey.get(form.calendarKey);

    if (!selectedCalendar) {
      setMessage("Choose a writable calendar first.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendees: form.attendees.split(",").map((email) => email.trim()).filter(Boolean),
          calendarId: selectedCalendar.google_calendar_id,
          connectedAccountId: selectedCalendar.connected_account_id,
          description: form.description || undefined,
          endsAt: new Date(form.endsAt).toISOString(),
          location: form.location || undefined,
          startsAt: new Date(form.startsAt).toISOString(),
          timeZone: selectedCalendar.time_zone || undefined,
          title: form.title,
        }),
      });
      const payload = (await response.json()) as { event?: CalendarEvent; error?: string };

      if (!response.ok || !payload.event) {
        throw new Error(payload.error ?? "Event could not be created.");
      }

      setEvents((current) => [...current, payload.event as CalendarEvent].sort((a, b) =>
        new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime(),
      ));
      setForm(defaultForm(form.calendarKey));
      setMessage("Event created in Google Calendar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Event could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="grid content-start gap-4">
        <section className="os-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="os-label">Google accounts</p>
              <h2 className="mt-1 text-xl font-bold">Calendars</h2>
            </div>
            <a
              className="os-secondary-button flex h-10 w-10 items-center justify-center"
              href="/api/integrations/google/connect?next=/calendar"
              title="Connect Google account"
            >
              <UserPlus size={17} />
            </a>
          </div>

          <div className="mt-4 grid gap-2">
            {accounts.length ? accounts.map((account) => (
              <div className="rounded-lg border border-[var(--line)] bg-white/54 p-3" key={account.id}>
                <p className="truncate text-sm font-semibold">{account.display_name ?? account.account_email ?? "Google account"}</p>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">{account.account_email}</p>
                {account.is_primary ? <p className="mt-2 text-xs font-semibold text-[var(--accent)]">Primary</p> : null}
              </div>
            )) : (
              <p className="rounded-lg border border-dashed border-[var(--line-strong)] p-3 text-sm leading-6 text-[var(--muted)]">
                Connect Google, then sync to discover calendars shared with you.
              </p>
            )}
          </div>
        </section>

        <section className="os-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="os-label">Visible calendars</p>
            <button
              className="os-secondary-button flex h-9 w-9 items-center justify-center"
              disabled={syncing}
              onClick={syncCalendars}
              title="Sync calendars"
              type="button"
            >
              {syncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
            </button>
          </div>

          <div className="mt-4 grid gap-2">
            {calendars.map((calendar) => {
              const key = calendarKey(calendar);
              const selected = selectedKeys.has(key);

              return (
                <button
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                    selected ? "border-[var(--accent)] bg-white/76" : "border-[var(--line)] bg-white/42"
                  }`}
                  key={key}
                  onClick={() => void toggleCalendar(calendar)}
                  type="button"
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: calendarColor(calendar) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{calendar.summary ?? calendar.google_calendar_id}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">{calendar.access_role ?? "unknown"} access</span>
                  </span>
                  {selected ? <Check size={15} className="text-[var(--accent)]" /> : null}
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      <main className="grid min-w-0 gap-4">
        <section className="os-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-normal">Calendar</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {visibleEvents.length} events loaded.
              </p>
            </div>
            <button
              className="os-primary-button flex h-11 items-center justify-center gap-2 px-4 text-sm font-semibold"
              disabled={syncing}
              onClick={syncCalendars}
              type="button"
            >
              {syncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
              Sync
            </button>
          </div>

          {message ? (
            <p className="mt-4 rounded-lg border border-[var(--line)] bg-white/62 px-3 py-2 text-sm text-[var(--muted)]">
              {message}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="os-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
              <CalendarDays size={18} className="text-[var(--accent)]" />
              <h2 className="font-bold">Next 7 days</h2>
            </div>

            {loading ? (
              <div className="flex min-h-80 items-center justify-center text-[var(--muted)]">
                <Loader2 className="mr-2 animate-spin" size={18} /> Loading calendar
              </div>
            ) : (
              <div className="grid min-h-80 divide-y divide-[var(--line)] lg:grid-cols-7 lg:divide-x lg:divide-y-0">
                {weekDays.map((day) => {
                  const key = day.toISOString().slice(0, 10);
                  const dayEvents = eventsByDay.get(key) ?? [];

                  return (
                    <div className="min-h-48 p-3" key={key}>
                      <p className="text-sm font-bold">{formatDay(day)}</p>
                      <div className="mt-3 grid gap-2">
                        {dayEvents.length ? dayEvents.map((event) => {
                          const calendar = calendarsByEventKey.get(eventCalendarKey(event));

                          return (
                            <article className="rounded-lg border border-[var(--line)] bg-white/62 p-2.5" key={event.id}>
                              <div className="flex items-start gap-2">
                                <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: calendarColor(calendar) }} />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">{event.title ?? "Untitled event"}</p>
                                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]">
                                    <Clock size={12} /> {formatTime(event.starts_at, event.all_day)}
                                  </p>
                                  {event.location ? <p className="mt-1 truncate text-xs text-[var(--muted)]">{event.location}</p> : null}
                                  {event.html_link ? (
                                    <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]" href={event.html_link} rel="noreferrer" target="_blank">
                                      Open <ExternalLink size={12} />
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            </article>
                          );
                        }) : (
                          <p className="rounded-lg border border-dashed border-[var(--line)] p-3 text-xs leading-5 text-[var(--muted)]">
                            No events.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <section className="os-card p-4">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-[var(--accent)]" />
              <h2 className="font-bold">Create event</h2>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                className="os-input h-11 px-3 text-sm"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Title"
                value={form.title}
              />
              <select
                className="os-input h-11 px-3 text-sm"
                onChange={(event) => setForm({ ...form, calendarKey: event.target.value })}
                value={form.calendarKey}
              >
                <option value="">Choose calendar</option>
                {writableCalendars.map((calendar) => (
                  <option key={calendarKey(calendar)} value={calendarKey(calendar)}>
                    {calendar.summary ?? calendar.google_calendar_id}
                  </option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
                  Starts
                  <input className="os-input h-11 px-3 text-sm" onChange={(event) => setForm({ ...form, startsAt: event.target.value })} type="datetime-local" value={form.startsAt} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
                  Ends
                  <input className="os-input h-11 px-3 text-sm" onChange={(event) => setForm({ ...form, endsAt: event.target.value })} type="datetime-local" value={form.endsAt} />
                </label>
              </div>
              <input
                className="os-input h-11 px-3 text-sm"
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="Location"
                value={form.location}
              />
              <input
                className="os-input h-11 px-3 text-sm"
                onChange={(event) => setForm({ ...form, attendees: event.target.value })}
                placeholder="Attendees, comma separated"
                value={form.attendees}
              />
              <textarea
                className="os-input min-h-24 px-3 py-3 text-sm"
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Description"
                value={form.description}
              />
              <button
                className="os-primary-button flex h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-55"
                disabled={saving || !form.title || !form.calendarKey}
                onClick={createEvent}
                type="button"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                Create in Google
              </button>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
