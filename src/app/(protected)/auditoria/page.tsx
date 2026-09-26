import { requireAdminProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ action?: string; entity?: string }> };

const actionLabels: Record<string, string> = {
  "auth.login": "Login",
  "user.created": "Usuário convidado",
  "user.updated": "Usuário atualizado",
  "user.activated": "Usuário ativado",
  "user.deactivated": "Usuário desativado",
  "user.role_changed": "Perfil alterado",
  "component.created": "Componente cadastrado",
  "inventory.received": "Entrada de estoque",
  "inventory.reserved": "Estoque reservado",
  "inventory.released": "Reserva liberada",
  "build.created": "Build criado",
  "build.cancelled": "Build cancelado",
  "build.completed": "Build concluído",
};

function summarize(value: unknown) {
  if (!value) return "—";
  const json = JSON.stringify(value);
  return json.length > 180 ? `${json.slice(0, 177)}…` : json;
}

export default async function AuditPage({ searchParams }: Props) {
  await requireAdminProfile();
  const params = await searchParams;
  const action = params.action?.slice(0, 80) ?? "";
  const entity = params.entity?.slice(0, 40) ?? "";
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, user_id, action, entity_type, entity_id, old_data, new_data, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (action) query = query.eq("action", action);
  if (entity) query = query.eq("entity_type", entity);
  const { data: logs, error } = await query;

  const actorIds = [...new Set((logs ?? []).flatMap((log) => log.user_id ? [log.user_id] : []))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, name, email").in("id", actorIds)
    : { data: [] };
  const actorById = new Map((actors ?? []).map((actor) => [actor.id, actor]));

  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] text-[#5da52f] uppercase">Administração</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#153b2a] sm:text-4xl">Auditoria</h1>
      <p className="mt-2 leading-7 text-[#607266]">Ações administrativas, mudanças de estoque e eventos dos builds. Exibindo até 100 eventos mais recentes.</p>

      <form className="mt-7 flex flex-col gap-3 rounded-2xl border border-[#dce6d8] bg-white p-4 sm:flex-row">
        <select className="h-11 rounded-xl border border-[#d9e2d8] bg-white px-3" name="entity" defaultValue={entity}>
          <option value="">Todas as entidades</option>
          <option value="profile">Usuários</option>
          <option value="component">Componentes</option>
          <option value="component_lot">Lotes</option>
          <option value="build">Builds</option>
          <option value="build_component">Reservas</option>
        </select>
        <input className="h-11 min-w-0 flex-1 rounded-xl border border-[#d9e2d8] px-3" name="action" defaultValue={action} placeholder="Ação exata (ex.: inventory.received)" />
        <button className="h-11 rounded-xl border border-[#cdddc7] px-5 font-semibold text-[#315b3c] hover:bg-[#f5f7f2]" type="submit">Filtrar</button>
      </form>

      {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f3] px-4 py-3 text-sm text-[#8d3c32]">Não foi possível consultar a auditoria.</p> : null}
      <section className="mt-6 overflow-hidden rounded-3xl border border-[#dce6d8] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[#e7ede4] bg-[#fbfcfa] text-xs tracking-wide text-[#718276] uppercase">
              <tr><th className="px-5 py-4">Data</th><th className="px-5 py-4">Usuário</th><th className="px-5 py-4">Ação</th><th className="px-5 py-4">Entidade</th><th className="px-5 py-4">Identificador</th><th className="px-5 py-4">Dados registrados</th></tr>
            </thead>
            <tbody className="divide-y divide-[#edf1ea]">
              {(logs ?? []).map((log) => {
                const actor = log.user_id ? actorById.get(log.user_id) : undefined;
                return <tr key={log.id}>
                  <td className="whitespace-nowrap px-5 py-4 text-[#607266]">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-5 py-4 text-[#44594b]">{actor?.name ?? "Usuário removido"}<span className="mt-1 block text-xs text-[#89958d]">{actor?.email ?? "—"}</span></td>
                  <td className="px-5 py-4 font-medium text-[#294333]">{actionLabels[log.action] ?? log.action}</td>
                  <td className="px-5 py-4 text-[#607266]">{log.entity_type}</td>
                  <td className="px-5 py-4 font-mono text-xs text-[#718276]">{log.entity_id ?? "—"}</td>
                  <td className="max-w-xs px-5 py-4 text-xs text-[#718276]" title={summarize(log.new_data ?? log.old_data)}>{summarize(log.new_data ?? log.old_data)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {!error && logs?.length === 0 ? <p className="px-6 py-10 text-center text-sm text-[#718276]">Nenhum evento registrado.</p> : null}
      </section>
    </div>
  );
}
