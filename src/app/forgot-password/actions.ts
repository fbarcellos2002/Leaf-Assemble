"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.email();

export async function requestPasswordReset(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect("/forgot-password?error=invalid-input");

  try {
    const supabase = await createClient();
    const siteUrl = getSiteUrl();
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });
  } catch {
    redirect("/forgot-password?error=setup");
  }

  // Keep the response identical whether or not the address belongs to a user.
  redirect("/forgot-password?status=sent");
}
