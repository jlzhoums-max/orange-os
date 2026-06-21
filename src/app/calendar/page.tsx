import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppChrome } from "@/components/app-chrome";
import { CalendarTool } from "@/components/calendar-tool";

type CalendarPageProps = {
  searchParams?: Promise<{ google?: string; sync?: string }>;
};

function calendarStatusMessage(params?: { google?: string; sync?: string }) {
  if (params?.google === "connected" && params.sync === "failed") {
    return "Google account connected. Calendar sync needs a manual retry.";
  }

  if (params?.google === "connected") {
    return "Google account connected.";
  }

  if (params?.google) {
    return `Google connection returned: ${params.google}`;
  }

  return null;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;

  return (
    <AppChrome active="Calendar">
      <section className="mx-auto mb-4 max-w-[1440px]">
        <Link className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]" href="/">
          <ArrowLeft size={16} />
          Back to Today
        </Link>
      </section>
      <CalendarTool initialMessage={calendarStatusMessage(params)} />
    </AppChrome>
  );
}
