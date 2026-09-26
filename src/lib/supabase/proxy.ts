import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "./env";

const publicPaths = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/auth/signout",
]);

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicPath = publicPaths.has(pathname);

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const hasUser = Boolean(data?.claims?.sub);

  if (!hasUser && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasUser && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
