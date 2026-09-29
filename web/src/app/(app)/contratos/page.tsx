import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NATUREZA, STATUS, cpf, data } from "@/lib/format";
import type { ContratoPrazo, KpisGerais, Perfil, TipoProcesso } from "@/lib/types";
import { Badge, Button, Card, Input, PrazoBadge, Select } from "@/components/ui";

type Filtros = {
  q?: string;
  status?: string;
  natureza?: string;
  tipo?: string;
  responsavel?: string;
  situacao?: string;
};

export default async function ContratosPage(props: PageProps<"/contratos">) {
  const f = (await props.searchParams) as Filtros;
  const { supabase } = await requireUser();

  const status = f.status ?? "em_andamento";
  let query = supabase.from("contratos_prazos").select("*").limit(500);
  if (status !== "todos") query = query.eq("status", status);
  if (f.natureza) query = query.eq("natureza", f.natureza);
  if (f.tipo) query = query.eq("tipo_id", Number(f.tipo));
  if (f.responsavel === "nenhum") query = query.is("responsavel_id", null);
  else if (f.responsavel) query = query.eq("responsavel_id", f.responsavel);
  if (f.situacao === "atrasados") query = query.gt("dias_atraso", 0);
  if (f.situacao === "vencendo") query = query.gte("dias_restantes", 0).lte("dias_restantes", 3);
  if (f.situacao === "sem_numero") query = query.is("numero", null);
  if (f.situacao === "pendencia") query = query.eq("tem_pendencia", true);
  if (f.q?.trim()) {
    // Keep only characters that are safe inside a PostgREST or() filter.
    const q = f.q.trim().replace(/[^\p{L}\p{N} ./-]/gu, "");
    const digits = q.replace(/\D/g, "");
    const partes = [`numero.ilike.*${q}*`, `cliente_nome.ilike.*${q}*`];
    if (digits.length >= 3) partes.push(`cliente_cpf.ilike.*${digits}*`);
    query = query.or(partes.join(","));
  }
  query = query.order("data_prazo", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });

  const [{ data: contratos, error }, { data: kpis }, { data: tipos }, { data: perfis }] = await Promise.all([
    query.returns<ContratoPrazo[]>(),
    supabase.from("kpis_gerais").select("*").single<KpisGerais>(),
    supabase.from("tipos_processo").select("*").order("natureza").order("nome").returns<TipoProcesso[]>(),
    supabase.from("perfis").select("*").eq("ativo", true).order("nome").returns<Perfil[]>(),
  ]);

  const contadores = [
    { label: "Em andamento", valor: kpis?.em_andamento ?? 0, href: "/contratos?status=em_andamento" },
    { label: "Atrasados", valor: kpis?.atrasados ?? 0, href: "/contratos?situacao=atrasados", tone: "text-red-700" },
    { label: "Vencendo em até 3 dias", valor: kpis?.vencendo_3_dias ?? 0, href: "/contratos?situacao=vencendo", tone: "text-amber-700" },
    { label: "Distribuídos", valor: kpis?.distribuidos ?? 0, href: "/contratos?status=distribuido" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contratos</h1>
        <Link href="/contratos/novo">
          <Button>Novo contrato</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {contadores.map((c) => (
          <Link key={c.label} href={c.href} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`text-2xl font-semibold ${c.tone ?? ""}`}>{c.valor}</p>
          </Link>
        ))}
      </div>

      <Card>
        <form className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <Input name="q" defaultValue={f.q} placeholder="Nº, cliente ou CPF" className="md:col-span-2" />
          <Select name="status" defaultValue={status}>
            <option value="em_andamento">Em andamento</option>
            <option value="distribuido">Distribuídos</option>
            <option value="cancelado">Cancelados</option>
            <option value="todos">Todos os status</option>
          </Select>
          <Select name="natureza" defaultValue={f.natureza ?? ""}>
            <option value="">Todas as naturezas</option>
            {Object.entries(NATUREZA).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
          <Select name="tipo" defaultValue={f.tipo ?? ""}>
            <option value="">Todos os tipos</option>
            {tipos?.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </Select>
          <Select name="responsavel" defaultValue={f.responsavel ?? ""}>
            <option value="">Todos os responsáveis</option>
            <option value="nenhum">Sem responsável</option>
            {perfis?.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </Select>
          <Select name="situacao" defaultValue={f.situacao ?? ""}>
            <option value="">Qualquer situação</option>
            <option value="atrasados">Atrasados</option>
            <option value="vencendo">Vencendo em até 3 dias</option>
            <option value="pendencia">Com pendência</option>
            <option value="sem_numero">Sem nº de contrato</option>
          </Select>
          <div className="flex gap-2 md:col-span-4 xl:col-span-7">
            <Button type="submit">Filtrar</Button>
            <Link href="/contratos">
              <Button type="button" variant="secondary">Limpar</Button>
            </Link>
          </div>
        </form>
      </Card>

      {error && <p className="text-sm text-red-700">Erro ao carregar: {error.message}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2">Nº contrato</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Natureza / tipo</th>
              <th className="px-3 py-2">Responsável</th>
              <th className="px-3 py-2">Entrega docs</th>
              <th className="px-3 py-2">Prazo</th>
              <th className="px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contratos?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Nenhum contrato encontrado.</td>
              </tr>
            )}
            {contratos?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link href={`/contratos/${c.id}`} className="font-medium text-blue-700 hover:underline">
                    {c.numero ?? <span className="text-amber-700">(sem nº)</span>}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <div>{c.cliente_nome}</div>
                  {c.cliente_cpf && <div className="text-xs text-slate-500">{cpf(c.cliente_cpf)}</div>}
                </td>
                <td className="px-3 py-2">
                  <div>{NATUREZA[c.natureza]}</div>
                  <div className="text-xs text-slate-500">{c.tipo_nome ?? "-"}</div>
                </td>
                <td className="px-3 py-2">{c.responsavel_nome ?? <span className="text-slate-400">-</span>}</td>
                <td className="px-3 py-2">{data(c.data_entrega_docs)}</td>
                <td className="px-3 py-2">{data(c.data_prazo)}</td>
                <td className="space-x-1 px-3 py-2">
                  <PrazoBadge {...c} />
                  {c.tem_pendencia && <Badge tone="amber">Pendência</Badge>}
                  {status === "todos" && c.status === "distribuido" && <Badge>{STATUS[c.status]}</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {contratos && contratos.length >= 500 && <p className="text-xs text-slate-500">Mostrando os primeiros 500. Use os filtros.</p>}
    </div>
  );
}
