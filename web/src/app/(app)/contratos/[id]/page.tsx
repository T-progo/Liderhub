import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { MOTIVO, NATUREZA, STATUS, cpf, data, hojeISO } from "@/lib/format";
import type { Cliente, ContratoPrazo, Pendencia, Perfil, TipoProcesso } from "@/lib/types";
import { Badge, Button, Card, Input, PrazoBadge } from "@/components/ui";
import { ContratoForm } from "../contrato-form";
import { adicionarPendencia, atualizarPendencia, reabrirContrato, reabrirPendencia } from "../actions";
import { CancelarForm, ClienteForm, DistribuirForm } from "./acoes";

const ORIGEM = { manual: "Cadastro manual", liderhub: "Liderhub (automático)", importacao: "Importação da planilha" };

export default async function ContratoPage(props: PageProps<"/contratos/[id]">) {
  const { id } = await props.params;
  const { supabase, perfil } = await requireUser();

  const { data: c } = await supabase.from("contratos_prazos").select("*").eq("id", id).maybeSingle<ContratoPrazo>();
  if (!c) notFound();

  const [{ data: cliente }, { data: outros }, { data: pendencias }, { data: tipos }, { data: perfis }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", c.cliente_id).single<Cliente>(),
    supabase
      .from("contratos_prazos")
      .select("id, numero, status, tipo_nome, natureza")
      .eq("cliente_id", c.cliente_id)
      .neq("id", c.id)
      .returns<Pick<ContratoPrazo, "id" | "numero" | "status" | "tipo_nome" | "natureza">[]>(),
    supabase.from("pendencias").select("*").eq("contrato_id", id).order("created_at").returns<Pendencia[]>(),
    supabase.from("tipos_processo").select("*").order("nome").returns<TipoProcesso[]>(),
    supabase.from("perfis").select("*").order("nome").returns<Perfil[]>(),
  ]);

  const abertas = pendencias?.filter((p) => !p.resolvida_em) ?? [];
  const resolvidas = pendencias?.filter((p) => p.resolvida_em) ?? [];

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <Link href="/contratos" className="text-sm text-blue-700 hover:underline">← Contratos</Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">Contrato {c.numero ?? "(sem nº)"}</h1>
          <PrazoBadge {...c} />
          {c.status !== "em_andamento" && <Badge>{STATUS[c.status]}</Badge>}
          {abertas.length > 0 && <Badge tone="amber">{abertas.length} pendência(s)</Badge>}
        </div>
        <p className="text-sm text-slate-600">
          {c.cliente_nome} · {NATUREZA[c.natureza]}
          {c.tipo_nome && ` · ${c.tipo_nome}`} · {ORIGEM[c.origem]}
        </p>
        {c.descricao && <p className="text-sm text-slate-500">{c.descricao}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Assinatura", data(c.data_assinatura)],
          ["Entrega dos documentos", data(c.data_entrega_docs)],
          ["Prazo final", data(c.data_prazo)],
          ["Distribuição", data(c.data_distribuicao)],
          ["Tempo de distribuição", c.tempo_distribuicao === null ? "-" : `${c.tempo_distribuicao} dias`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="font-semibold">{v}</p>
          </div>
        ))}
      </div>

      {c.status === "cancelado" && (
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          Cancelado: <strong>{c.motivo_cancelamento ? MOTIVO[c.motivo_cancelamento] : "-"}</strong>
          {c.obs_cancelamento && ` - ${c.obs_cancelamento}`}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Dados do contrato">
            <ContratoForm contrato={c} cliente={cliente ?? undefined} tipos={tipos ?? []} perfis={perfis ?? []} />
            {c.onedrive_url && (
              <a href={c.onedrive_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-blue-700 hover:underline">
                Abrir pasta no OneDrive ↗
              </a>
            )}
          </Card>

          <Card title="Pendências">
            <div className="space-y-3">
              {abertas.length === 0 && <p className="text-sm text-slate-500">Nenhuma pendência em aberto.</p>}
              {abertas.map((p) => (
                <form key={p.id} action={atualizarPendencia} className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <input type="hidden" name="id" value={p.id} />
                  <p className="text-sm font-medium">{p.descricao}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input name="providencia" defaultValue={p.providencia ?? ""} placeholder="Providência adotada" />
                    <Input name="acao" defaultValue={p.acao ?? ""} placeholder="Ação realizada" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" variant="secondary">Salvar</Button>
                    <span className="text-xs text-slate-500">ou resolver em</span>
                    <Input type="date" name="resolvida_em" defaultValue={hojeISO()} className="w-40" />
                    <Button type="submit" name="resolver" value="1">Marcar resolvida</Button>
                  </div>
                </form>
              ))}

              <form action={adicionarPendencia} className="space-y-2 rounded-md border border-slate-200 p-3">
                <input type="hidden" name="contrato_id" value={c.id} />
                <p className="text-sm font-medium">Nova pendência</p>
                <Input name="descricao" placeholder="Ex.: falta laudo médico atualizado" required />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input name="providencia" placeholder="Providência adotada (opcional)" />
                  <Input name="acao" placeholder="Ação realizada (opcional)" />
                </div>
                <Button type="submit" variant="secondary">Adicionar pendência</Button>
              </form>

              {resolvidas.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-slate-600">{resolvidas.length} pendência(s) resolvida(s)</summary>
                  <ul className="mt-2 space-y-1">
                    {resolvidas.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-100 p-2">
                        <span className="font-medium">{p.descricao}</span>
                        <span className="text-slate-500">
                          resolvida em {data(p.resolvida_em)}
                          {p.providencia && ` · ${p.providencia}`}
                          {p.acao && ` · ${p.acao}`}
                        </span>
                        <form action={reabrirPendencia}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="text-xs text-blue-700 hover:underline">reabrir</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {c.status === "em_andamento" ? (
            <>
              <Card title="Finalizar">
                <DistribuirForm id={c.id} />
              </Card>
              <Card title="Cancelar">
                <CancelarForm id={c.id} />
              </Card>
            </>
          ) : (
            perfil.papel === "admin" && (
              <Card title="Reabrir">
                <p className="mb-2 text-sm text-slate-600">Volta o contrato para &quot;Em andamento&quot;.</p>
                <form action={reabrirContrato}>
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="secondary">Reabrir contrato</Button>
                </form>
              </Card>
            )
          )}

          {cliente && (
            <Card title="Cliente">
              <ClienteForm cliente={cliente} />
              {cliente.cpf && <p className="mt-2 text-xs text-slate-500">CPF {cpf(cliente.cpf)}</p>}
              <div className="mt-4 space-y-1 text-sm">
                <p className="font-medium">Outros contratos deste cliente</p>
                {outros?.length === 0 && <p className="text-slate-500">Nenhum.</p>}
                {outros?.map((o) => (
                  <Link key={o.id} href={`/contratos/${o.id}`} className="block text-blue-700 hover:underline">
                    {o.numero ?? "(sem nº)"} · {o.tipo_nome ?? NATUREZA[o.natureza]} · {STATUS[o.status]}
                  </Link>
                ))}
                <Link href={`/contratos/novo?cliente=${cliente.id}`} className="mt-2 inline-block text-blue-700 hover:underline">
                  + Novo contrato para este cliente
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
