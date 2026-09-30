import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NATUREZA, num } from "@/lib/format";
import type { Configuracoes, ContratoPrazo } from "@/lib/types";
import { Button, Card, Field, Input } from "@/components/ui";

type Linha = Pick<
  ContratoPrazo,
  "status" | "natureza" | "tipo_nome" | "responsavel_nome" | "tempo_distribuicao" | "no_prazo" | "dias_atraso" | "dias_restantes" | "data_distribuicao"
>;

type Grupo = { nome: string; distribuidos: number; noPrazo: number; somaDias: number; abertos: number; atrasados: number };

function agrupar(linhas: Linha[], chave: (l: Linha) => string) {
  const m = new Map<string, Grupo>();
  for (const l of linhas) {
    const k = chave(l);
    const g = m.get(k) ?? { nome: k, distribuidos: 0, noPrazo: 0, somaDias: 0, abertos: 0, atrasados: 0 };
    if (l.status === "distribuido" && l.tempo_distribuicao !== null) {
      g.distribuidos++;
      g.somaDias += l.tempo_distribuicao;
      if (l.no_prazo) g.noPrazo++;
    }
    if (l.status === "em_andamento") {
      g.abertos++;
      if ((l.dias_atraso ?? 0) > 0) g.atrasados++;
    }
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.distribuidos + b.abertos - (a.distribuidos + a.abertos));
}

const pct = (g: Grupo) => (g.distribuidos ? (100 * g.noPrazo) / g.distribuidos : null);
const media = (g: Grupo) => (g.distribuidos ? g.somaDias / g.distribuidos : null);

function BarraMeta({ valor, meta }: { valor: number | null; meta: number }) {
  if (valor === null) return <span className="text-stone-400">-</span>;
  const ok = valor >= meta;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-28 rounded bg-stone-100">
        <div className={`h-2 rounded ${ok ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(valor, 100)}%` }} />
        <div className="absolute top-[-3px] h-3.5 w-px bg-stone-700" style={{ left: `${meta}%` }} title={`Meta ${meta}%`} />
      </div>
      <span className={ok ? "text-emerald-700" : "text-red-700"}>{num(valor)}%</span>
    </div>
  );
}

function Tabela({ titulo, grupos, meta }: { titulo: string; grupos: Grupo[]; meta: number }) {
  return (
    <Card title={titulo}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-stone-500 uppercase">
            <tr>
              <th className="py-1 pr-3">Nome</th>
              <th className="py-1 pr-3">Distribuídos</th>
              <th className="py-1 pr-3">Tempo médio</th>
              <th className="py-1 pr-3">% no prazo</th>
              <th className="py-1 pr-3">Em andamento</th>
              <th className="py-1">Atrasados</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {grupos.map((g) => (
              <tr key={g.nome}>
                <td className="py-1.5 pr-3">{g.nome}</td>
                <td className="py-1.5 pr-3">{g.distribuidos}</td>
                <td className="py-1.5 pr-3">{media(g) === null ? "-" : `${num(media(g))} d`}</td>
                <td className="py-1.5 pr-3"><BarraMeta valor={pct(g)} meta={meta} /></td>
                <td className="py-1.5 pr-3">{g.abertos}</td>
                <td className={`py-1.5 ${g.atrasados ? "font-semibold text-red-700" : ""}`}>{g.atrasados}</td>
              </tr>
            ))}
            {grupos.length === 0 && (
              <tr><td colSpan={6} className="py-3 text-stone-500">Sem dados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default async function PainelPage(props: PageProps<"/painel">) {
  const { de, ate } = (await props.searchParams) as { de?: string; ate?: string };
  const { supabase } = await requireUser();

  // Supabase caps each response at 1000 rows: read in pages.
  const rows: Linha[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page } = await supabase
      .from("contratos_prazos")
      .select("status, natureza, tipo_nome, responsavel_nome, tempo_distribuicao, no_prazo, dias_atraso, dias_restantes, data_distribuicao")
      .neq("status", "cancelado")
      .order("id")
      .range(from, from + 999)
      .returns<Linha[]>();
    rows.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  const { data: cfg } = await supabase.from("configuracoes").select("*").single<Configuracoes>();
  const meta = Number(cfg?.meta_no_prazo ?? 80);

  // The period filters distributed contracts by distribution date; open contracts are always "today".
  const linhas = rows.filter(
    (l) =>
      l.status === "em_andamento" ||
      ((!de || (l.data_distribuicao ?? "") >= de) && (!ate || (l.data_distribuicao ?? "") <= ate)),
  );

  const [geral] = agrupar(linhas, () => "Escritório");
  const g = geral ?? { nome: "", distribuidos: 0, noPrazo: 0, somaDias: 0, abertos: 0, atrasados: 0 };
  const vencendo = linhas.filter((l) => l.status === "em_andamento" && (l.dias_restantes ?? -1) >= 0 && (l.dias_restantes ?? 99) <= 3).length;
  const pctGeral = pct(g);
  const atingiu = pctGeral !== null && pctGeral >= meta;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Painel de indicadores</h1>
        <form className="flex flex-wrap items-end gap-2">
          <Field label="Distribuídos de">
            <Input type="date" name="de" defaultValue={de} />
          </Field>
          <Field label="até">
            <Input type="date" name="ate" defaultValue={ate} />
          </Field>
          <Button type="submit" variant="secondary">Aplicar</Button>
          {(de || ate) && (
            <Link href="/painel" className="pb-2 text-sm text-brand-700 hover:underline">limpar</Link>
          )}
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className={`rounded-2xl border p-5 shadow-[0_1px_3px_rgba(68,40,24,0.06)] ${pctGeral === null ? "border-stone-200 bg-white" : atingiu ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <p className="text-xs text-stone-600">Distribuídos dentro do prazo</p>
          <p className="text-3xl font-semibold">{pctGeral === null ? "-" : `${num(pctGeral)}%`}</p>
          <p className="text-xs text-stone-600">
            Meta: {num(meta, 0)}% · {pctGeral === null ? "sem distribuições no período" : atingiu ? "meta atingida" : "abaixo da meta"}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(68,40,24,0.06)]">
          <p className="text-xs text-stone-600">Tempo médio de distribuição</p>
          <p className="text-3xl font-semibold">{media(g) === null ? "-" : `${num(media(g))} dias`}</p>
          <p className="text-xs text-stone-600">Prazo: {cfg?.prazo_dias ?? 10} dias corridos · {g.distribuidos} distribuídos</p>
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(68,40,24,0.06)]">
          <p className="text-xs text-stone-600">Em andamento hoje</p>
          <p className="text-3xl font-semibold">{g.abertos}</p>
          <p className="text-xs">
            <Link href="/contratos?situacao=atrasados" className="text-red-700 hover:underline">{g.atrasados} atrasados</Link>
            {" · "}
            <Link href="/contratos?situacao=vencendo" className="text-amber-700 hover:underline">{vencendo} vencendo em até 3 dias</Link>
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Tabela titulo="Por responsável" grupos={agrupar(linhas, (l) => l.responsavel_nome ?? "(sem responsável)")} meta={meta} />
        <Tabela
          titulo="Por tipo de processo"
          grupos={agrupar(linhas, (l) => `${NATUREZA[l.natureza]} · ${l.tipo_nome ?? "(sem tipo)"}`)}
          meta={meta}
        />
      </div>
      <p className="text-xs text-stone-500">Contratos cancelados não entram nos indicadores.</p>
    </div>
  );
}
