import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(`${getAppOrigin(request)}/login`);
}

export async function GET(request: Request) {
  return NextResponse.redirect(`${getAppOrigin(request)}/login`);
}

export async function POST(request: Request) {
  return signOut(request);
}
