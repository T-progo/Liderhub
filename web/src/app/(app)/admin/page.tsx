import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NATUREZA } from "@/lib/format";
import type { Configuracoes, Perfil, TipoProcesso } from "@/lib/types";
import { Button, Card, Input, Select } from "@/components/ui";
import { adicionarTipo, alternarTipo } from "./actions";
import { ConfiguracoesForm, NovoUsuarioForm, UsuarioForm } from "./forms";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();

  const [{ data: perfis }, { data: tipos }, { data: cfg }, usuarios] = await Promise.all([
    supabase.from("perfis").select("*").order("ativo", { ascending: false }).order("nome").returns<Perfil[]>(),
    supabase.from("tipos_processo").select("*").order("natureza").order("nome").returns<TipoProcesso[]>(),
    supabase.from("configuracoes").select("*").single<Configuracoes>(),
    createAdminClient().auth.admin.listUsers({ perPage: 200 }),
  ]);
  const emails = new Map(usuarios.data?.users.map((u) => [u.id, u.email ?? ""]) ?? []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Administração</h1>
        <p className="mt-1 text-sm text-stone-500">Equipe, tipos de processo e regras de prazo do escritório.</p>
      </div>

      <Card title="Novo usuário">
        <NovoUsuarioForm />
      </Card>

      <Card title={`Usuários (${perfis?.filter((p) => p.ativo).length ?? 0} ativos)`}>
        <p className="-mt-2 mb-4 text-sm text-stone-500">
          O WhatsApp (com DDD, ex.: 24999998888) é usado para os avisos de prazo dos contratos em que a pessoa é responsável.
        </p>
        <div className="space-y-3">
          {perfis?.map((p) => (
            <UsuarioForm key={p.id} perfil={p} email={emails.get(p.id) ?? ""} />
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card title="Tipos de processo">
          <ul className="mb-3 divide-y divide-stone-100 text-sm">
            {tipos?.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span className={t.ativo ? "" : "text-stone-400 line-through"}>
                  {t.nome} <span className="text-xs text-stone-500">· {NATUREZA[t.natureza]}</span>
                </span>
                <form action={alternarTipo}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="ativo" value={String(t.ativo)} />
                  <button className="rounded-md px-2 py-0.5 text-xs text-stone-500 transition-colors hover:bg-brand-50 hover:text-brand-700">{t.ativo ? "desativar" : "reativar"}</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={adicionarTipo} className="flex flex-col gap-2 border-t border-stone-100 pt-4 sm:flex-row">
            <Select name="natureza" defaultValue="civel" className="sm:w-44">
              {Object.entries(NATUREZA).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
            <Input name="nome" placeholder="Novo tipo" required />
            <Button type="submit" variant="secondary">Adicionar</Button>
          </form>
        </Card>

        {cfg && (
          <Card title="Configurações">
            <ConfiguracoesForm cfg={cfg} />
          </Card>
        )}
      </div>
    </div>
  );
}
