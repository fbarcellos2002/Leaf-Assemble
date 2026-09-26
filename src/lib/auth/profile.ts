import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ActiveProfile = {
  auth_user_id: string;
  name: string;
  role: "ADMIN" | "VISITANTE";
};

export const requireActiveProfile = cache(async function requireActiveProfile(): Promise<ActiveProfile> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login?error=setup");
  }

  const { data: claims } = await supabase.auth.getClaims();
  const authUserId = claims?.claims?.sub;
  if (typeof authUserId !== "string") redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("auth_user_id, name, role, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !profile || !profile.is_active) {
    redirect("/auth/signout?reason=inactive");
  }

  return {
    auth_user_id: profile.auth_user_id,
    name: profile.name,
    role: profile.role,
  };
});

export const requireAdminProfile = cache(async function requireAdminProfile() {
  const profile = await requireActiveProfile();
  if (profile.role !== "ADMIN") redirect("/dashboard?error=forbidden");
  return profile;
});
