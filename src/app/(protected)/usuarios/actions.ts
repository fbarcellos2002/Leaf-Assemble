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

export async function inviteUser(formData: FormData) {
  await requireAdminProfile();
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/usuarios?error=invalid-input");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { name: parsed.data.name },
    redirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
  });
  if (error || !data.user) redirect("/usuarios?error=invite-failed");

  const supabase = await createClient();
  const { error: profileError } = await supabase.rpc("admin_update_profile", {
    p_auth_user_id: data.user.id,
    p_name: parsed.data.name,
    p_role: parsed.data.role,
    p_is_active: true,
    p_action: "user.created",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirect("/usuarios?error=profile-failed");
  }

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
