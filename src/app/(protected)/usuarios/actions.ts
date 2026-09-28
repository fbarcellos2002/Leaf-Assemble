"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.enum(["ADMIN", "VISITANTE"]);
const createUserSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(2).max(80),
  password: z.string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
  role: roleSchema,
});
const updateUserSchema = z.object({
  authUserId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  role: roleSchema,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

function getCreateErrorCode(error: { message?: string; code?: string; status?: number }) {
  const normalized = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
    return "email-exists";
  }
  if (error.status === 401 || error.status === 403 || normalized.includes("invalid_api_key")) {
    return "admin-key";
  }
  if (error.status === 429) return "auth-rate-limit";
  if (normalized.includes("database error") || normalized.includes("unexpected_failure")) {
    return "auth-database";
  }
  return "create-failed";
}

export async function createUser(formData: FormData) {
  await requireAdminProfile();
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/usuarios?error=invalid-input");

  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect("/usuarios?error=admin-key");
  }

  let failure: string | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { name: parsed.data.name },
    });

    if (error) {
      console.error("Supabase Auth user creation failed", {
        code: error.code,
        status: error.status,
        name: error.name,
      });
      failure = getCreateErrorCode(error);
    } else if (!data.user) {
      failure = "create-failed";
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
        console.error("Supabase profile setup after user creation failed", {
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint,
        });
        failure = "profile-failed";
        try {
          await admin.auth.admin.deleteUser(data.user.id);
        } catch {
          // Keep the original profile error visible; a leftover account has no elevated role.
        }
      }
    }
  } catch (error) {
    console.error("Unexpected error while creating a user", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    failure = "create-failed";
  }

  if (failure) redirect(`/usuarios?error=${failure}`);

  revalidatePath("/usuarios");
  redirect("/usuarios?notice=created");
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

function getDeleteErrorCode(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("própria conta")) return "delete-self";
  if (normalized.includes("protegido")) return "delete-protected";
  if (normalized.includes("ao menos um administrador ativo")) return "delete-last-admin";
  if (normalized.includes("não encontrado")) return "delete-not-found";
  return "delete-failed";
}

export async function deleteUser(formData: FormData) {
  await requireAdminProfile();
  const parsed = z.uuid().safeParse(formData.get("authUserId"));
  if (!parsed.success) redirect("/usuarios?error=invalid-input");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_user", {
    p_auth_user_id: parsed.data,
  });

  if (error) redirect(`/usuarios?error=${getDeleteErrorCode(error.message)}`);
  revalidatePath("/usuarios");
  revalidatePath("/auditoria");
  redirect("/usuarios?notice=deleted");
}
