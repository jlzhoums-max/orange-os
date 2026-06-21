import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createGmailReplyDraft, getGmailMessageDetail } from "@/lib/google/gmail";
import { getConnectedAccountIdForMessage } from "@/lib/google/message-account";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const draftSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
  messageId: z.string().trim().min(1),
});

export async function POST(request: Request) {
  if (!hasSupabasePublicEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = draftSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Draft body and message are required." }, { status: 400 });
  }

  const connectedAccountId = await getConnectedAccountIdForMessage(user.id, parsed.data.messageId);
  const original = await getGmailMessageDetail(user.id, parsed.data.messageId, connectedAccountId);
  const draft = await createGmailReplyDraft({
    body: parsed.data.body,
    connectedAccountId,
    original,
    userEmail: user.email,
    userId: user.id,
  });

  return NextResponse.json({
    draftId: draft.id,
    connectedAccountId,
    gmailMessageId: draft.message?.id ?? null,
    threadId: draft.message?.threadId ?? original.threadId,
  });
}
