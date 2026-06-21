import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ attachmentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { attachmentId } = await context.params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: attachment, error } = await supabase
    .from("expense_attachments")
    .select("storage_path, file_name")
    .eq("id", attachmentId)
    .eq("user_id", claimsData.claims.sub)
    .single();

  if (error || !attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const { data, error: signedError } = await supabase.storage
    .from("expense-attachments")
    .createSignedUrl(attachment.storage_path, 60 * 10);

  if (signedError) {
    return NextResponse.json({ error: signedError.message }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, fileName: attachment.file_name });
}
