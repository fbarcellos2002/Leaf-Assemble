import { requireActiveProfile } from "@/lib/auth/profile";
import { AppShell } from "./app-shell";
import { SessionInactivityTimeout } from "./session-inactivity-timeout";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireActiveProfile();

  return (
    <>
      <SessionInactivityTimeout authUserId={profile.auth_user_id} />
      <AppShell authUserId={profile.auth_user_id} name={profile.name} role={profile.role}>
        {children}
      </AppShell>
    </>
  );
}
