import Image from "next/image";
import Link from "next/link";

import { requireActiveProfile } from "@/lib/auth/profile";
import { signOut } from "@/app/login/actions";
import { DatabaseLatency } from "./database-latency";
import { SessionInactivityTimeout } from "./session-inactivity-timeout";

const navigation = [
  { href: "/dashboard", label: "Visão geral" },
  { href: "/estoque", label: "Estoque" },
  { href: "/builds", label: "Builds" },
  { href: "/what-can-i-build", label: "O que posso montar?" },
];

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireActiveProfile();

  return (
    <div className="min-h-screen bg-[#f5f7f2] text-[#16271e]">
      <SessionInactivityTimeout authUserId={profile.auth_user_id} />
      <header className="border-b border-[#dfe7dc] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 md:px-8 xl:flex-row xl:items-center xl:justify-between xl:gap-5 xl:py-4">
          <Link href="/dashboard" className="flex w-fit items-center gap-3">
            <span className="size-10 overflow-hidden rounded-xl bg-[#f5f7f2]">
              <Image
                src="/brand/leaf-assemble-icon.jpg"
                alt=""
                width={40}
                height={40}
                className="size-full object-cover"
              />
            </span>
            <span className="font-semibold tracking-tight text-[#153b2a]">
              Leaf Assemble
            </span>
          </Link>

          <nav aria-label="Navegação principal" className="flex max-w-full flex-wrap gap-1 sm:gap-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-[#53675a] transition hover:bg-[#eff4eb] hover:text-[#153b2a] sm:px-3"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/usuarios"
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-[#53675a] transition hover:bg-[#eff4eb] hover:text-[#153b2a] sm:px-3"
            >
              Usuários
            </Link>
            {profile.role === "ADMIN" ? (
              <>
                <Link
                  href="/auditoria"
                  className="rounded-lg px-2.5 py-2 text-sm font-medium text-[#53675a] transition hover:bg-[#eff4eb] hover:text-[#153b2a] sm:px-3"
                >
                  Auditoria
                </Link>
              </>
            ) : null}
          </nav>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <DatabaseLatency authUserId={profile.auth_user_id} />
            <span className="hidden text-sm text-[#607266] sm:block">
              {profile.name}
            </span>
            <form action={signOut}>
              <button className="rounded-lg border border-[#d9e2d8] px-3 py-2 text-sm font-semibold text-[#315b3c] transition hover:bg-[#f5f7f2]">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
