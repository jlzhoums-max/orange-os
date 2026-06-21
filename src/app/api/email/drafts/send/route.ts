import { NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabasePublicEnv } from "@/lib/env";
import { sendGmailDraft } from "@/lib/google/gmail";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const sendDraftSchema = z.object({
  draftId: z.string().trim().min(1),
  connectedAccountId: z.string().uuid().nullable().optional(),
  confirm: z.literal(true),
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

  const parsed = sendDraftSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Explicit send confirmation is required." }, { status: 400 });
  }

  const sent = await sendGmailDraft(user.id, parsed.data.draftId, parsed.data.connectedAccountId);

  return NextResponse.json({
    labels: sent.labelIds ?? [],
    messageId: sent.id,
    threadId: sent.threadId,
  });
}
