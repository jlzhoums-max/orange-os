import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ expenseId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { expenseId } = await context.params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const fileExt = file.name.split(".").pop() || "bin";
  const storagePath = `${claimsData.claims.sub}/${expenseId}/${crypto.randomUUID()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from("expense-attachments")
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("expense_attachments")
    .insert({
      user_id: claimsData.claims.sub,
      expense_id: expenseId,
      storage_path: storagePath,
      file_name: file.name,
      content_type: file.type || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attachment: data });
}
