import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { extractGmailText, getGmailMessageDetail, gmailHeader } from "@/lib/google/gmail";
import { getConnectedAccountIdForMessage } from "@/lib/google/message-account";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messageId } = await context.params;
  const connectedAccountId = await getConnectedAccountIdForMessage(user.id, messageId);
  const message = await getGmailMessageDetail(user.id, messageId, connectedAccountId);
  const headers = message.payload?.headers ?? [];
  const body = extractGmailText(message);

  return NextResponse.json({
    id: message.id,
    connectedAccountId,
    threadId: message.threadId,
    body,
    snippet: message.snippet ?? null,
    labels: message.labelIds ?? [],
    headers: {
      from: gmailHeader(headers, "From"),
      to: gmailHeader(headers, "To"),
      subject: gmailHeader(headers, "Subject"),
      date: gmailHeader(headers, "Date"),
      messageId: gmailHeader(headers, "Message-ID"),
    },
  });
}
