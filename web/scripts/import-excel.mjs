// Imports the office's control spreadsheet (tab "2026 - b") into clientes + contratos + pendencias.
//
//   node --env-file=.env.local scripts/import-excel.mjs planilha.xlsx --aba "2026 - b"            (dry run: report only)
//   node --env-file=.env.local scripts/import-excel.mjs planilha.xlsx --aba "2026 - b" --gravar   (write to Supabase)
//   node --env-file=.env.local scripts/import-excel.mjs planilha.xlsx --aba "2026 - b" --responsaveis
//     (after creating the users: links imported contracts that have no responsavel yet, by contract number)
//
// The dry run also works without .env.local (no database checks).
// Columns are recognized by name (accents/case ignored); the header row is the first row with "contrato" and "cliente".
// Create the users (responsáveis) in the system BEFORE importing, so contracts get linked to them.
// Uses the service_role key (bypasses RLS) - run only on your machine.
import * as fs from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

XLSX.set_fs(fs); // the ESM build of SheetJS needs the file system injected

const args = process.argv.slice(2);
const arquivo = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--aba");
const GRAVAR = args.includes("--gravar");
const SO_RESP = args.includes("--responsaveis");
const abaNome = args.includes("--aba") ? args[args.indexOf("--aba") + 1] : null;
if (!arquivo) {
  console.error('Uso: node --env-file=.env.local scripts/import-excel.mjs <arquivo.xlsx> [--aba "2026 - b"] [--gravar]');
  process.exit(1);
}

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const chave = (s) => norm(s).replace(/[^a-z0-9]/g, ""); // "BPC Loas" == "BPC/LOAS"
const texto = (v) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

// field -> header keywords, compared letters/digits only (first header containing any keyword wins; order matters)
const COLUNAS = {
  numero: ["ncontrato", "nocontrato", "numerodocontrato", "numerocontrato"],
  cliente: ["cliente", "nome"],
  cpf: ["cpf"],
  telefone: ["telefone", "celular", "whatsapp"],
  natureza: ["natureza"],
  tipo: ["tipo", "beneficio"],
  data_assinatura: ["assinatura"],
  situacao: ["situacao", "status"],
  pendencia: ["pendencia"],
  providencia: ["providencia"],
  data_entrega_docs: ["entrega"],
  responsavel: ["responsavel", "advogado"],
  data_distribuicao: ["finalizado", "distribuicaoem", "datadistribu"],
};

function mapearCabecalho(cabecalhos) {
  const usados = new Set();
  const mapa = {};
  for (const [campo, chaves] of Object.entries(COLUNAS)) {
    const i = cabecalhos.findIndex((c, idx) => c && !usados.has(idx) && chaves.some((k) => chave(c).includes(k)));
    if (i >= 0) {
      mapa[campo] = i;
      usados.add(i);
    }
  }
  return mapa;
}

// Date cell, Excel serial number, "dd/mm/aaaa" or "aaaa-mm-dd" -> "aaaa-mm-dd"
function data(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v)) {
    // SheetJS returns local-midnight dates; add 12h so the time zone never moves the day.
    return new Date(v.getTime() + 12 * 3600e3 - v.getTimezoneOffset() * 60e3).toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : "INVALIDA";
  }
  const s = String(v).trim();
  let iso = null;
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) iso = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = iso ? new Date(`${iso}T12:00:00Z`) : null; // rejects 31/02 etc.
  return d && !isNaN(d) && d.toISOString().slice(0, 10) === iso ? iso : "INVALIDA";
}
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400e3);

// Nature column: typos of "previdenciário" -> previdenciaria; civil, bancário, tributário, etc. -> civel.
const natureza = (v) => (/^pr[ae]v|^prv/.test(norm(v)) ? "previdenciaria" : norm(v) ? "civel" : null);

// Free-text type -> type registered in supabase (schema.sql, 002, 003). First rule that matches wins.
const TIPOS = [
  [/reclus/, "Auxílio-reclusão"],
  [/acident/, "Auxílio-acidente"],
  [/incapacidade|auxilio.?doenca|invalidez/, "Auxílio por incapacidade"],
  [/beneficio assistencial|bpc|loas/, "BPC/LOAS"],
  [/pensao/, "Pensão por morte"],
  [/maternidade/, "Salário-maternidade"],
  [/planejamento|panejamento/, "Planejamento previdenciário"],
  [/aposentadoria/, "Aposentadoria"],
  [/revisao|majoracao|pccs/, "Revisão"],
  [/imposto de renda|\bir\b/, "Isenção de imposto de renda"],
  [/acerto|vinculos|contribuic/, "Acerto de contribuições"],
  [/banco|bancari|financeira|infinitepay|caixa economica|descontos indevidos/, "Ação contra banco / instituição financeira"],
  [/indenizacao|dano moral|danos morais/, "Indenização / danos morais"],
];
function tipoCanonico(txt, nat) {
  const n = norm(txt);
  if (!n) return null;
  const achado = TIPOS.find(([re]) => re.test(n))?.[1];
  if (achado) {
    // The nature follows the type (the sheet sometimes marks a bank case as "previdenciário").
    const civel = achado.startsWith("Ação") || achado.startsWith("Indenização");
    return { nome: achado, natureza: civel ? "civel" : "previdenciaria" };
  }
  return { nome: nat === "civel" ? "Outros (cível)" : "Outros (previdenciário)", natureza: nat ?? "previdenciaria" };
}

// Spelling variants of the same person ("Joao", "João", "joao") share the first 3 letters of the
// first name; the most frequent spelling in the sheet is used (users are matched by first name).
const chaveResp = (v) => chave(norm(v).split(" ")[0]).slice(0, 3);
let grafias = new Map();
const responsavelCanonico = (v) => (texto(v) ? grafias.get(chaveResp(v)) ?? texto(v) : null);

const CANCELA = /cancel|desist|distrato/;
const SEM_POTENCIAL = /inviav|potencial|qualidade de segurado|gerado errado|geradoerrado|nao gera direito|baixo retorno/;
const SEM_PENDENCIA = /^(nao|n|nao\.|ok|-|0|false)$/;

// ------------------------------------------------------------------ read the sheet
const wb = XLSX.readFile(arquivo, { cellDates: true });
const nomeAba = abaNome ?? wb.SheetNames[0];
const aba = wb.Sheets[nomeAba];
if (!aba) {
  console.error(`Aba "${nomeAba}" não encontrada. Abas: ${wb.SheetNames.join(" | ")}`);
  process.exit(1);
}
const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, defval: null, raw: true });
const iCab = matriz.findIndex((r) => r.some((c) => norm(c).includes("contrato")) && r.some((c) => norm(c).includes("cliente")));
if (iCab < 0) {
  console.error('Linha de cabeçalho não encontrada (precisa ter "contrato" e "cliente").');
  process.exit(1);
}
const mapa = mapearCabecalho(matriz[iCab]);
if (mapa.responsavel !== undefined) {
  const freq = new Map();
  for (const r of matriz.slice(iCab + 1)) {
    const v = texto(r[mapa.responsavel]);
    if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  const melhor = new Map();
  for (const [v, n] of freq) {
    const k = chaveResp(v);
    if (!melhor.has(k) || n > melhor.get(k)[1]) melhor.set(k, [v, n]);
  }
  grafias = new Map([...melhor].map(([k, [v]]) => [k, v]));
}
console.log(`Aba "${nomeAba}": cabeçalho na linha ${iCab + 1}, ${matriz.length - iCab - 1} linhas abaixo.`);
console.log("Colunas reconhecidas:", Object.fromEntries(Object.entries(mapa).map(([k, i]) => [k, String(matriz[iCab][i]).trim()])));
const faltando = ["numero", "cliente", "data_entrega_docs"].filter((c) => mapa[c] === undefined);
if (faltando.length) console.warn("ATENÇÃO - colunas não encontradas:", faltando, "(ajuste COLUNAS no script)");

// ------------------------------------------------------------------ database (optional in the dry run)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if ((GRAVAR || SO_RESP) && (!url || !key)) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}
const db = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
let tipos = null;
let perfis = null;
const numerosExistentes = new Set();
if (db) {
  const [t, p] = await Promise.all([db.from("tipos_processo").select("id, nome, natureza"), db.from("perfis").select("id, nome")]);
  if (t.error) {
    console.error("Erro ao ler o banco:", t.error.message);
    process.exit(1);
  }
  tipos = t.data;
  perfis = p.data;
  for (let de = 0; ; de += 1000) {
    const { data: lote } = await db.from("contratos").select("numero").not("numero", "is", null).range(de, de + 999);
    lote?.forEach((c) => numerosExistentes.add(String(c.numero)));
    if (!lote || lote.length < 1000) break;
  }
} else {
  console.log("(sem .env.local: simulação sem consultar o banco)");
}
const idTipo = (t) => tipos?.find((x) => x.natureza === t.natureza && chave(x.nome) === chave(t.nome))?.id ?? null;
const idPerfil = (nome) => {
  if (!perfis || !nome) return null;
  const n = norm(nome);
  const primeiro = n.split(" ")[0];
  return (perfis.find((p) => norm(p.nome) === n) ?? perfis.find((p) => norm(p.nome).split(" ")[0] === primeiro))?.id ?? null;
};

// ------------------------------------------------------------------ validate rows
const erros = [];
const avisos = [];
const validos = [];
const vistos = new Set();
const semUsuario = new Map();
const tiposFaltando = new Set();
const outros = [];
const situacoesIgnoradas = new Map();

matriz.slice(iCab + 1).forEach((r, i) => {
  const linha = iCab + 2 + i;
  const get = (campo) => (mapa[campo] === undefined ? null : r[mapa[campo]]);
  const numero = texto(get("numero"));
  const cliente = texto(get("cliente"));
  if (!numero && !cliente) return; // empty row
  if (!cliente) return avisos.push(`Linha ${linha}: "${numero}" sem nome do cliente - linha ignorada.`);
  if (numero && vistos.has(numero)) return erros.push(`Linha ${linha}: nº de contrato ${numero} repetido na planilha.`);
  if (numero && numerosExistentes.has(numero) && !SO_RESP) return avisos.push(`Linha ${linha}: contrato ${numero} já existe no sistema (ignorado).`);
  if (numero) vistos.add(numero);

  const datas = {
    data_assinatura: data(get("data_assinatura")),
    data_entrega_docs: data(get("data_entrega_docs")),
    data_distribuicao: data(get("data_distribuicao")),
  };
  for (const [c, v] of Object.entries(datas)) {
    if (v === "INVALIDA") {
      avisos.push(`Linha ${linha} (${numero}): data inválida em "${String(matriz[iCab][mapa[c]]).trim()}" (${get(c)}) - deixada em branco.`);
      datas[c] = null;
    }
  }
  const hoje = new Date().toISOString().slice(0, 10);
  for (const c of ["data_entrega_docs", "data_distribuicao"]) {
    if (datas[c] && datas[c] > hoje) avisos.push(`Linha ${linha} (${numero}): ${c === "data_entrega_docs" ? "entrega" : "finalizado"} no futuro (${datas[c]}) - conferir.`);
  }
  if (datas.data_entrega_docs && datas.data_distribuicao && datas.data_distribuicao < datas.data_entrega_docs) {
    avisos.push(`Linha ${linha} (${numero}): finalizado (${datas.data_distribuicao}) antes da entrega (${datas.data_entrega_docs}) - conferir.`);
  }

  const situacao = texto(get("situacao"));
  const pendencia = texto(get("pendencia"));
  const providencia = texto(get("providencia"));
  const cancelado = CANCELA.test(norm(situacao)) || CANCELA.test(norm(pendencia));
  if (situacao && !cancelado) situacoesIgnoradas.set(situacao, (situacoesIgnoradas.get(situacao) ?? 0) + 1);

  let status = cancelado ? "cancelado" : datas.data_distribuicao ? "distribuido" : "em_andamento";
  if (status === "distribuido" && !numero) {
    avisos.push(`Linha ${linha}: finalizado sem nº de contrato - importado como "em andamento".`);
    status = "em_andamento";
  }

  const nat = natureza(get("natureza"));
  const tipoTxt = texto(get("tipo"));
  const tipo = tipoCanonico(tipoTxt, nat);
  if (tipo?.nome.startsWith("Outros")) outros.push(tipoTxt);
  const tipoId = tipo ? idTipo(tipo) : null;
  if (tipo && tipos && !tipoId) tiposFaltando.add(tipo.nome);

  const respNome = responsavelCanonico(get("responsavel"));
  const respId = idPerfil(respNome);
  if (respNome && !respId) semUsuario.set(respNome, (semUsuario.get(respNome) ?? 0) + 1);

  const cpf = String(get("cpf") ?? "").replace(/\D/g, "") || null;
  if (cpf && cpf.length !== 11) avisos.push(`Linha ${linha}: CPF "${get("cpf")}" inválido - ignorado.`);

  const temPendencia = !cancelado && pendencia && !SEM_PENDENCIA.test(norm(pendencia)) && !(pendencia instanceof Date);
  const descricaoPendencia = temPendencia ? pendencia.replace(/^sim\s*[,.:-]?\s*/i, "").trim() || "Pendência (sem detalhe na planilha)" : null;

  validos.push({
    linha,
    cliente: { nome: cliente, cpf: cpf && cpf.length === 11 ? cpf : null, telefone: texto(get("telefone")) },
    responsavel: respNome,
    contrato: {
      numero,
      natureza: tipo?.natureza ?? nat ?? "previdenciaria",
      tipo_id: tipoId,
      tipo_nome: tipo?.nome ?? null, // only for the report; removed before insert
      descricao: tipoTxt,
      responsavel_id: respId,
      status,
      motivo_cancelamento: cancelado
        ? SEM_POTENCIAL.test(norm([situacao, pendencia, providencia].join(" "))) ? "sem_potencial" : "desistencia"
        : null,
      obs_cancelamento: cancelado ? [situacao, pendencia, providencia].filter(Boolean).join(" | ") : null,
      ...datas,
      data_distribuicao: status === "distribuido" ? datas.data_distribuicao : null,
      origem: "importacao",
    },
    pendencia: temPendencia
      ? {
          descricao: descricaoPendencia,
          providencia,
          acao: situacao,
          resolvida_em: status === "distribuido" ? datas.data_distribuicao : null,
        }
      : null,
  });
});

// ------------------------------------------------------------------ report
const conta = (f) => validos.reduce((m, v) => ((m[f(v)] = (m[f(v)] ?? 0) + 1), m), {});
console.log(`\nVálidas: ${validos.length} · Erros: ${erros.length} · Avisos: ${avisos.length}`);
[...erros, ...avisos].forEach((m) => console.log(" - " + m));
console.log("\nPor status:", conta((v) => v.contrato.status));
console.log("Cancelados por motivo:", conta((v) => v.contrato.motivo_cancelamento ?? "-"));
console.log("Por natureza:", conta((v) => v.contrato.natureza));
console.log("Por tipo:", conta((v) => v.contrato.tipo_nome ?? "(sem tipo)"));
console.log(`Tipo "Outros" (${outros.length}) - texto original fica na descrição:`, outros);
console.log("Por responsável:", conta((v) => v.responsavel ?? "(sem responsável)"));
console.log("Pendências:", validos.filter((v) => v.pendencia).length, "(abertas:", validos.filter((v) => v.pendencia && !v.pendencia.resolvida_em).length + ")");
if (situacoesIgnoradas.size) console.log('Textos de "situação" (não são cancelamento; vão para a ação da pendência quando houver):', Object.fromEntries(situacoesIgnoradas));
if (semUsuario.size) console.log("ATENÇÃO - responsáveis sem usuário no sistema (contratos ficarão sem responsável):", Object.fromEntries(semUsuario));
if (tiposFaltando.size) console.log("ATENÇÃO - tipos não cadastrados (rode supabase/003_tipos.sql):", [...tiposFaltando]);

// Same KPI as the dashboard: distributed contracts with delivery date, deadline 10 calendar days.
const medidos = validos.filter((v) => v.contrato.status === "distribuido" && v.contrato.data_entrega_docs);
const tempos = medidos.map((v) => diasEntre(v.contrato.data_entrega_docs, v.contrato.data_distribuicao));
if (tempos.length) {
  const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
  const noPrazo = tempos.filter((t) => t <= 10).length;
  console.log(`\nIndicadores esperados no painel: tempo médio ${media.toFixed(1)} dias · ${((100 * noPrazo) / tempos.length).toFixed(1)}% no prazo (${noPrazo}/${tempos.length} distribuídos com data de entrega)`);
}

if (SO_RESP) {
  let n = 0;
  for (const v of validos.filter((v) => v.contrato.numero && v.contrato.responsavel_id)) {
    const { data: lig } = await db
      .from("contratos")
      .update({ responsavel_id: v.contrato.responsavel_id })
      .eq("numero", v.contrato.numero)
      .is("responsavel_id", null)
      .select("id");
    n += lig?.length ?? 0;
  }
  console.log(`
Responsáveis vinculados: ${n} contratos.`);
  process.exit(0);
}

if (!GRAVAR) {
  console.log("\nSimulação concluída. Nada foi gravado. Rode de novo com --gravar para importar.");
  process.exit(0);
}
if (erros.length) {
  console.error("\nCorrija os erros acima antes de gravar.");
  process.exit(1);
}

// ------------------------------------------------------------------ write
let ok = 0;
for (const v of validos) {
  let clienteId = null;
  if (v.cliente.cpf) {
    const { data: c } = await db.from("clientes").select("id").eq("cpf", v.cliente.cpf).maybeSingle();
    clienteId = c?.id ?? null;
  }
  if (!clienteId) {
    const { data: c, error } = await db.from("clientes").insert(v.cliente).select("id").single();
    if (error) {
      console.log(` - Linha ${v.linha}: erro ao criar cliente: ${error.message}`);
      continue;
    }
    clienteId = c.id;
  }
  const contrato = { ...v.contrato };
  delete contrato.tipo_nome;
  const { data: k, error } = await db.from("contratos").insert({ ...contrato, cliente_id: clienteId }).select("id").single();
  if (error) {
    console.log(` - Linha ${v.linha}: erro ao criar contrato: ${error.message}`);
    continue;
  }
  if (v.pendencia) {
    const { error: e } = await db.from("pendencias").insert({ ...v.pendencia, contrato_id: k.id, criado_por: null });
    if (e) console.log(` - Linha ${v.linha}: contrato criado, mas erro na pendência: ${e.message}`);
  }
  ok++;
}
console.log(`\nImportados: ${ok} de ${validos.length}.`);
