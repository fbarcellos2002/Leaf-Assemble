import { requireAdminProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

import { inviteUser, updateUser } from "./actions";

type Props = { searchParams: Promise<{ error?: string; notice?: string }> };

const errorMessages: Record<string, string> = {
  "invalid-input": "Confira o nome, o e-mail e o perfil selecionado.",
  "invite-failed": "Não foi possível enviar o convite. Verifique a configuração de e-mail do Supabase.",
  "profile-failed": "Não foi possível configurar o perfil do usuário. Verifique o estado da conta antes de reenviar o convite.",
  "update-failed": "Não foi possível salvar. Verifique se o administrador protegido continua ativo.",
};

export default async function UsersPage({ searchParams }: Props) {
  await requireAdminProfile();
  const { error, notice } = await searchParams;
  const supabase = await createClient();
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, auth_user_id, email, name, role, is_active, is_protected, created_at, last_login_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Administração</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a]">Usuários</h1>
      <p className="mt-2 max-w-2xl leading-7 text-[#607266]">
        Convide pessoas e gerencie papéis e acesso. O administrador principal protegido não pode ser desativado nem rebaixado.
      </p>

      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">{errorMessages[error] ?? "Ocorreu um erro ao processar a solicitação."}</p> : null}
      {notice ? <p role="status" className="mt-5 rounded-xl bg-[#eef5e9] px-4 py-3 text-sm text-[#315b3c]">{notice === "invited" ? "Convite enviado." : "Alterações salvas."}</p> : null}
      {profilesError ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível carregar os perfis.</p> : null}

      <section className="mt-8 rounded-3xl border border-[#dce6d8] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-[#153b2a]">Convidar usuário</h2>
        <form action={inviteUser} className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Nome
            <input className="h-11 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="name" required minLength={2} maxLength={80} />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            E-mail
            <input className="h-11 rounded-xl border border-[#d9e2d8] px-3 font-normal" name="email" type="email" required />
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#294333]">
            Perfil
            <select className="h-11 rounded-xl border border-[#d9e2d8] bg-white px-3 font-normal" name="role" defaultValue="VISITANTE">
              <option value="VISITANTE">Visitante</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          <button className="mt-auto h-11 rounded-xl bg-[#153b2a] px-4 font-semibold text-white hover:bg-[#205138]" type="submit">Enviar convite</button>
        </form>
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border border-[#dce6d8] bg-white shadow-sm">
        <div className="border-b border-[#e7ede4] px-6 py-5 sm:px-8">
          <h2 className="text-xl font-semibold text-[#153b2a]">Contas cadastradas</h2>
        </div>
        <div className="divide-y divide-[#edf1ea]">
          {(profiles ?? []).map((profile) => (
            <form action={updateUser} key={profile.id} className="grid gap-4 px-6 py-5 sm:px-8 lg:grid-cols-[1.2fr_1fr_0.8fr_0.7fr_auto] lg:items-end">
              <input type="hidden" name="authUserId" value={profile.auth_user_id} />
              <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">
                Nome
                <input className="h-10 rounded-lg border border-[#d9e2d8] px-3 text-sm font-normal normal-case tracking-normal text-[#16271e]" name="name" defaultValue={profile.name} required minLength={2} maxLength={80} />
              </label>
              <div className="text-sm">
                <p className="text-xs font-semibold tracking-wide text-[#718276] uppercase">E-mail</p>
                <p className="mt-2 break-all text-[#44594b]">{profile.email}</p>
              </div>
              {profile.is_protected ? (
                <>
                  <input type="hidden" name="role" value={profile.role} />
                  <input type="hidden" name="isActive" value={String(profile.is_active)} />
                  <div className="text-sm font-medium text-[#315b3c]">Administrador protegido · ativo</div>
                </>
              ) : (
                <>
                  <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">
                    Perfil
                    <select className="h-10 rounded-lg border border-[#d9e2d8] bg-white px-3 text-sm font-normal normal-case tracking-normal" name="role" defaultValue={profile.role}>
                      <option value="VISITANTE">Visitante</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold tracking-wide text-[#718276] uppercase">
                    Acesso
                    <select className="h-10 rounded-lg border border-[#d9e2d8] bg-white px-3 text-sm font-normal normal-case tracking-normal" name="isActive" defaultValue={String(profile.is_active)}>
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </label>
                </>
              )}
              <div className="flex items-center gap-3">
                <button className="h-10 rounded-lg border border-[#cdddc7] px-4 text-sm font-semibold text-[#315b3c] hover:bg-[#f5f7f2]" type="submit">Salvar</button>
                {profile.is_protected ? <span className="text-xs font-medium text-[#5b8c35]">Protegido</span> : null}
              </div>
            </form>
          ))}
          {profiles?.length === 0 ? <p className="px-6 py-8 text-sm text-[#718276] sm:px-8">Nenhum perfil cadastrado.</p> : null}
        </div>
      </section>
    </div>
  );
}
