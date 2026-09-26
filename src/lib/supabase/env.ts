import { z } from "zod";

const supabaseEnvSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

const siteUrlSchema = z.url();

export function getSupabaseEnv() {
  return supabaseEnvSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getSiteUrl() {
  return siteUrlSchema.parse(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
}
