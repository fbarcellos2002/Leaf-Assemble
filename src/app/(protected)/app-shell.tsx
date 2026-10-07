"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { signOut } from "@/app/login/actions";
import { DatabaseLatency } from "./database-latency";

type Props = {
  authUserId: string;
  name: string;
  role: string;
  children: React.ReactNode;
};

const navigation = [
  { href: "/dashboard", label: "Visão geral", icon: "◫" },
  { href: "/estoque", label: "Estoque", icon: "▦" },
  { href: "/builds", label: "Montar", icon: "▣" },
  { href: "/usuarios", label: "Usuários", icon: "♙" },
];

const preferencesChangedEvent = "leaf-preferences-change";

function subscribeToPreferences(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(preferencesChangedEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(preferencesChangedEvent, callback);
  };
}

function getSidebarSnapshot() {
  return window.localStorage.getItem("leaf-sidebar-collapsed") === "true";
}

function getThemeSnapshot(): "light" | "dark" {
  return window.localStorage.getItem("leaf-theme") === "dark" ? "dark" : "light";
}

export function AppShell({ authUserId, name, role, children }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeToPreferences, getSidebarSnapshot, () => false);
  const theme = useSyncExternalStore(subscribeToPreferences, getThemeSnapshot, () => "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleCollapsed() {
    window.localStorage.setItem("leaf-sidebar-collapsed", String(!collapsed));
    window.dispatchEvent(new Event(preferencesChangedEvent));
  }

  function toggleTheme() {
    window.localStorage.setItem("leaf-theme", theme === "dark" ? "light" : "dark");
    window.dispatchEvent(new Event(preferencesChangedEvent));
  }

  const sidebarWidth = collapsed ? "lg:w-[76px]" : "lg:w-64";

  return (
    <div data-theme={theme} className="min-h-screen bg-[#f5f7f2] text-[#16271e] lg:flex">
      {mobileOpen ? <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} type="button" /> : null}
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-[#31583f] bg-[#153b2a] text-[#e8f0e8] transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${sidebarWidth} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className={`flex h-16 shrink-0 items-center border-b border-[#31583f] px-4 ${collapsed ? "lg:justify-center lg:px-2" : "justify-between"}`}>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3" aria-label="Leaf Assemble — Visão geral" onClick={() => setMobileOpen(false)}>
            <span className="size-10 shrink-0 overflow-hidden rounded-xl bg-[#315b3c]">
              <Image src="/brand/leaf-assemble-icon.jpg" alt="" width={40} height={40} className="size-full object-cover" />
            </span>
            <span className={`${collapsed ? "lg:hidden" : ""} truncate font-semibold tracking-tight text-[#f0f7ed]`}>Leaf Assemble</span>
          </Link>
          <button aria-label="Fechar menu" className="rounded-lg p-2 text-[#d4e5d0] hover:bg-[#214a33] lg:hidden" onClick={() => setMobileOpen(false)} type="button">✕</button>
          <button aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} className="hidden rounded-lg p-2 text-[#d4e5d0] hover:bg-[#214a33] lg:block" onClick={toggleCollapsed} type="button">{collapsed ? "»" : "«"}</button>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {[
            ...navigation,
            ...(role === "ADMIN" ? [{ href: "/auditoria", label: "Auditoria", icon: "≡" }] : []),
          ].map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? "bg-[#315b3c] text-[#f0f7ed]" : "text-[#d4e5d0] hover:bg-[#214a33] hover:text-white"} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
              >
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-lg">{item.icon}</span>
                <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={`space-y-3 border-t border-[#31583f] p-3 ${collapsed ? "lg:px-2" : ""}`}>
          <div className={collapsed ? "lg:flex lg:justify-center" : ""}>
            <DatabaseLatency authUserId={authUserId} compact={collapsed} />
          </div>
          <button aria-label={collapsed ? (theme === "dark" ? "Usar tema claro" : "Usar tema escuro") : undefined} title={collapsed ? (theme === "dark" ? "Tema claro" : "Tema escuro") : undefined} className={`app-sidebar-control flex h-10 w-full items-center gap-2 rounded-lg border border-[#52715b] px-3 text-sm font-medium text-[#e0ebe0] hover:bg-[#214a33] ${collapsed ? "lg:justify-center lg:px-0" : ""}`} onClick={toggleTheme} type="button">
            <span aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span>
            <span className={collapsed ? "lg:hidden" : ""}>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
          </button>
          <div className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}>
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#315b3c] text-sm font-semibold text-[#f0f7ed]">{name.slice(0, 1).toUpperCase()}</span>
            <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-sm font-semibold text-[#e8f0e8]">{name}</p>
              <p className="text-xs text-[#b8cbb8]">{role === "ADMIN" ? "Administrador" : "Usuário"}</p>
            </div>
            <form action={signOut} className={collapsed ? "lg:hidden" : ""}>
              <button className="rounded-lg px-2 py-2 text-xs font-semibold text-[#ffc4b8] hover:bg-[#512f2a]" type="submit">Sair</button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="app-mobile-toolbar flex h-14 shrink-0 items-center border-b border-[#31583f] bg-[#153b2a] px-4 lg:hidden">
          <button aria-label="Abrir menu" className="rounded-lg border border-[#52715b] px-3 py-2 text-sm font-semibold text-[#e8f0e8] hover:bg-[#214a33]" onClick={() => setMobileOpen(true)} type="button">☰ Menu</button>
        </div>
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
