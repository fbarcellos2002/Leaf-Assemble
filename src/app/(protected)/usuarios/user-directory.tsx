"use client";

import { useEffect, useState } from "react";

import { deleteUser, updateOwnPassword, updateUser } from "./actions";
import { RemoveUserButton } from "./remove-user-button";

export type UserRecord = {
  id: string;
  authUserId: string | null;
  email: string | null;
  name: string;
  role: "ADMIN" | "VISITANTE";
  isActive: boolean | null;
  isProtected: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
};

type Props = {
  users: UserRecord[];
  currentUserId: string;
  isAdmin: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Nunca acessou";
}

function roleLabel(role: UserRecord["role"]) {
  return role === "ADMIN" ? "Administrador" : "Visitante";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-[#718276] uppercase">{label}</dt>
      <dd className="mt-1 break-words text-sm text-[#243b2c]">{value}</dd>
    </div>
  );
}

export function UserDirectory({ users, currentUserId, isAdmin }: Props) {
  const [viewing, setViewing] = useState<UserRecord | null>(null);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const isModalOpen = Boolean(viewing || editing);

  useEffect(() => {
    if (!isModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewing(null);
        setEditing(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isModalOpen]);

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-[#dce6d8] bg-white">
      <div className="border-b border-[#e7ede4] px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold text-[#153b2a]">Contas cadastradas</h2>
      </div>
      <ul className="divide-y divide-[#edf1ea]">
        {users.map((user) => {
          const isSelf = user.authUserId === currentUserId;
          const canView = isAdmin || isSelf;

          return (
            <li key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <p className="break-words font-semibold text-[#203b2b]">{user.name}{isSelf ? <span className="ml-2 text-xs font-medium text-[#718276]">Você</span> : null}</p>
                <p className="mt-1 text-sm text-[#607266]">{roleLabel(user.role)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {canView ? (
                  <button className="h-9 rounded-lg border border-[#cdddc7] px-3 text-sm font-semibold text-[#315b3c] transition hover:bg-[#f5f7f2]" type="button" onClick={() => { setEditing(null); setViewing(user); }}>
                    Visualizar
                  </button>
                ) : <span className="px-2 text-xs text-[#718276]">Dados privados</span>}
                {isAdmin ? (
                  <button className="h-9 rounded-lg bg-[#153b2a] px-3 text-sm font-semibold text-white transition hover:bg-[#205138]" type="button" onClick={() => { setViewing(null); setEditing(user); }}>
                    Editar
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
        {users.length === 0 ? <li className="px-5 py-8 text-sm text-[#718276] sm:px-6">Nenhuma conta cadastrada.</li> : null}
      </ul>

      {viewing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/45 p-0 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewing(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-details-title" className="my-auto max-h-[min(90vh,50rem)] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#5da52f] uppercase">Dados da conta</p>
                <h2 id="user-details-title" className="mt-1 break-words text-xl font-semibold text-[#153b2a]">{viewing.name}</h2>
              </div>
              <button className="size-9 shrink-0 rounded-lg border border-[#d9e2d8] text-xl leading-none text-[#53675a] hover:bg-[#f5f7f2]" type="button" aria-label="Fechar" onClick={() => setViewing(null)}>×</button>
            </div>
            <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <Field label="Perfil" value={roleLabel(viewing.role)} />
              {viewing.email ? <Field label="E-mail de login" value={viewing.email} /> : null}
              {viewing.isActive !== null ? <Field label="Acesso" value={viewing.isActive ? "Ativo" : "Inativo"} /> : null}
              {viewing.isProtected ? <Field label="Proteção" value="Administrador protegido" /> : null}
              {viewing.createdAt ? <Field label="Cadastrado em" value={dateFormatter.format(new Date(viewing.createdAt))} /> : null}
              {viewing.authUserId ? <Field label="Último acesso" value={formatDate(viewing.lastLoginAt)} /> : null}
            </dl>

            {viewing.authUserId === currentUserId ? (
              <form action={updateOwnPassword} className="mt-7 border-t border-[#e7ede4] pt-6">
                <h3 className="font-semibold text-[#153b2a]">Alterar minha senha</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-[#294333]">
                    Nova senha
                    <input className="h-10 min-w-0 rounded-lg border border-[#d9e2d8] px-3 font-normal" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} pattern="(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}" title="Use no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial." required />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[#294333]">
                    Confirmar senha
                    <input className="h-10 min-w-0 rounded-lg border border-[#d9e2d8] px-3 font-normal" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
                  </label>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#718276]">Mínimo de 8 caracteres, com uma letra maiúscula, um número e um caractere especial.</p>
                <button className="mt-4 h-10 rounded-lg bg-[#153b2a] px-4 text-sm font-semibold text-white transition hover:bg-[#205138]" type="submit">Salvar nova senha</button>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/45 p-0 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-user-title" className="my-auto max-h-[min(90vh,50rem)] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#5da52f] uppercase">Gerenciar conta</p>
                <h2 id="edit-user-title" className="mt-1 break-words text-xl font-semibold text-[#153b2a]">{editing.name}</h2>
              </div>
              <button className="size-9 shrink-0 rounded-lg border border-[#d9e2d8] text-xl leading-none text-[#53675a] hover:bg-[#f5f7f2]" type="button" aria-label="Fechar" onClick={() => setEditing(null)}>×</button>
            </div>
            <form action={updateUser} className="mt-6 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="authUserId" value={editing.authUserId ?? ""} />
              <label className="grid gap-2 text-sm font-medium text-[#294333]">
                Nome
                <input className="h-10 min-w-0 rounded-lg border border-[#d9e2d8] px-3 font-normal" name="name" defaultValue={editing.name} required minLength={2} maxLength={80} />
              </label>
              <div className="grid gap-2 text-sm font-medium text-[#294333]">
                E-mail de login
                <p className="flex min-h-10 min-w-0 items-center break-all rounded-lg bg-[#f5f7f2] px-3 font-normal text-[#53675a]">{editing.email}</p>
              </div>
              {editing.isProtected ? (
                <>
                  <input type="hidden" name="role" value={editing.role} />
                  <input type="hidden" name="isActive" value={String(editing.isActive)} />
                  <p className="self-end pb-2 text-sm font-medium text-[#315b3c]">Administrador protegido</p>
                </>
              ) : (
                <>
                  <label className="grid gap-2 text-sm font-medium text-[#294333]">
                    Perfil
                    <select className="h-10 rounded-lg border border-[#d9e2d8] bg-white px-3 font-normal" name="role" defaultValue={editing.role}>
                      <option value="VISITANTE">Visitante</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[#294333]">
                    Acesso
                    <select className="h-10 rounded-lg border border-[#d9e2d8] bg-white px-3 font-normal" name="isActive" defaultValue={String(editing.isActive)}>
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </label>
                </>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ede4] pt-4 sm:col-span-2">
                <p className="text-xs text-[#718276]">Último acesso: {formatDate(editing.lastLoginAt)}</p>
                <button className="h-10 rounded-lg bg-[#153b2a] px-4 text-sm font-semibold text-white transition hover:bg-[#205138]" type="submit">Salvar alterações</button>
              </div>
            </form>
            {!editing.isProtected ? (
              <form action={deleteUser} className="mt-3 flex justify-end">
                <input type="hidden" name="authUserId" value={editing.authUserId ?? ""} />
                <RemoveUserButton name={editing.name} />
              </form>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
