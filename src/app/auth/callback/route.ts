import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedPath = request.nextUrl.searchParams.get("next") ?? "/reset-password";
  const candidateUrl = new URL(requestedPath, request.url);
  const nextUrl = candidateUrl.origin === request.nextUrl.origin
    ? candidateUrl
    : new URL("/reset-password", request.url);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(nextUrl);
  }

  return NextResponse.redirect(new URL("/login?error=credentials", request.url));
}
