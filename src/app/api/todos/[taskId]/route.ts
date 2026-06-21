import { NextResponse } from "next/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { dbTodoTask, todoTaskUpdate } from "@/lib/todos/mapper";
import type { TodoTaskPayload } from "@/lib/todos/types";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ taskId: string }>;
};

export async function PUT(request: Request, { params }: Params) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { taskId } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as TodoTaskPayload;
  const { data, error } = await supabase
    .from("todo_tasks")
    .update(todoTaskUpdate(body))
    .eq("id", taskId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ task: dbTodoTask(data) });
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.json({ error: "Supabase env is not configured" }, { status: 503 });
  }

  const { taskId } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("todo_tasks").delete().eq("id", taskId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
