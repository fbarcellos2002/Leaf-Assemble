import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const reason = request.nextUrl.searchParams.get("reason");
  const destination = new URL("/login", request.url);
  if (reason === "inactive") destination.searchParams.set("error", "inactive");
  if (reason === "idle") destination.searchParams.set("error", "session-timeout");
  if (reason === "closed") destination.searchParams.set("error", "session-closed");
  return NextResponse.redirect(destination);
}
