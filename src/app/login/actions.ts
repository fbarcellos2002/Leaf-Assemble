"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function signIn(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/login?error=invalid-input");

  let hasInvalidCredentials = false;
  let hasInactiveProfile = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    hasInvalidCredentials = Boolean(error);
    if (!error) {
      const { error: auditError } = await supabase.rpc("record_auth_login");
      hasInactiveProfile = Boolean(auditError);
      if (auditError) await supabase.auth.signOut();
    }
  } catch {
    redirect("/login?error=setup");
  }

  if (hasInvalidCredentials) redirect("/login?error=credentials");
  if (hasInactiveProfile) redirect("/login?error=inactive");
  redirect("/dashboard");
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } finally {
    redirect("/login");
  }
}
