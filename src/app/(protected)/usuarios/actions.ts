"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.enum(["ADMIN", "VISITANTE"]);
const createUserSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(2).max(80),
  role: roleSchema,
});
const updateUserSchema = z.object({
  authUserId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  role: roleSchema,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

function getInviteErrorCode(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
    return "email-exists";
  }
  if (
    normalized.includes("email address not authorized") ||
    normalized.includes("smtp") ||
    normalized.includes("rate limit") ||
    normalized.includes("email rate")
  ) {
    return "email-delivery";
  }
  return "invite-failed";
}

export async function inviteUser(formData: FormData) {
  await requireAdminProfile();
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/usuarios?error=invalid-input");

  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect("/usuarios?error=invite-key");
  }

  let failure: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { name: parsed.data.name },
      redirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    });

    if (error) {
      failure = getInviteErrorCode(error.message);
    } else if (!data.user) {
      failure = "invite-failed";
    } else {
      const supabase = await createClient();
      const { error: profileError } = await supabase.rpc("admin_update_profile", {
        p_auth_user_id: data.user.id,
        p_name: parsed.data.name,
        p_role: parsed.data.role,
        p_is_active: true,
        p_action: "user.created",
      });

      if (profileError) {
        failure = "profile-failed";
      }
    }
  } catch {
    failure = "invite-failed";
  }

  if (failure) redirect(`/usuarios?error=${failure}`);

  revalidatePath("/usuarios");
  redirect("/usuarios?notice=invited");
}

export async function updateUser(formData: FormData) {
  await requireAdminProfile();
  const parsed = updateUserSchema.safeParse({
    authUserId: formData.get("authUserId"),
    name: formData.get("name"),
    role: formData.get("role"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) redirect("/usuarios?error=invalid-input");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_profile", {
    p_auth_user_id: parsed.data.authUserId,
    p_name: parsed.data.name,
    p_role: parsed.data.role,
    p_is_active: parsed.data.isActive,
    p_action: "user.updated",
  });

  if (error) redirect("/usuarios?error=update-failed");
  revalidatePath("/usuarios");
  revalidatePath("/dashboard");
  redirect("/usuarios?notice=updated");
}
