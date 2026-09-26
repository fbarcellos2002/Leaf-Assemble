"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const passwordSchema = z.string().min(12, "A senha precisa ter pelo menos 12 caracteres.");

export async function updatePassword(formData: FormData) {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) redirect("/reset-password?error=invalid-password");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) redirect("/reset-password?error=update-failed");
  redirect("/dashboard?notice=password-updated");
}
