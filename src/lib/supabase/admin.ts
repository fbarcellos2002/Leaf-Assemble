import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getSupabaseEnv } from "./env";

const serviceRoleKeySchema = z.string().min(1);

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = serviceRoleKeySchema.parse(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
