// Imports the client's current control spreadsheet (~300 rows) into clientes + contratos.
//
//   node --env-file=.env.local scripts/import-excel.mjs ../data/planilha.xlsx            (dry run: report only)
//   node --env-file=.env.local scripts/import-excel.mjs ../data/planilha.xlsx --gravar   (write to Supabase)
//
// Columns are recognized by name (accents/case ignored). Adjust COLUNAS below after seeing the real file.
// Uses the service_role key (bypasses RLS) - run only on your machine.
import * as fs from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

XLSX.set_fs(fs); // the ESM build of SheetJS needs the file system injected

const [arquivo, ...flags] = process.argv.slice(2);
const GRAVAR = flags.includes("--gravar");
if (!arquivo) {
  console.error("Uso: node --env-file=.env.local scripts/import-excel.mjs <arquivo.xlsx> [--gravar]");
  process.exit(1);
}

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// field -> header keywords (first header containing any keyword wins)
const COLUNAS = {
  numero: ["n contrato", "no contrato", "numero do contrato", "numero contrato", "contrato"],
  cliente: ["cliente", "nome"],
  cpf: ["cpf"],
  telefone: ["telefone", "celular", "whatsapp"],
  natureza: ["natureza", "pasta", "area"],
  tipo: ["tipo", "beneficio", "previdencia"],
  responsavel: ["responsavel", "advogado", "colaborador"],
  data_assinatura: ["assinatura"],
  data_entrega_docs: ["entrega"],
  data_distribuicao: ["distribu", "finaliza", "protocolo"],
  status: ["status", "situacao", "cancelad"],
  motivo: ["motivo"],
  pendencia: ["pendencia", "falt"],
  providencia: ["providencia"],
  acao: ["acao", "acoes"],
};

function mapearCabecalho(cabecalhos) {
  const usados = new Set();
  const mapa = {};
  for (const [campo, chaves] of Object.entries(COLUNAS)) {
    const h = cabecalhos.find((c) => !usados.has(c) && chaves.some((k) => norm(c).includes(k)));
    if (h) {
      mapa[campo] = h;
      usados.add(h);
    }
  }
  return mapa;
}

// Excel serial number, Date, "dd/mm/aaaa" or "aaaa-mm-dd" -> "aaaa-mm-dd"
function data(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
  }
  const s = String(v).trim();
  let iso = null;
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) iso = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) iso = `${m[1]}-${m[2]}-${m[3]}`;
  // Reject impossible dates such as 31/02.
  const d = iso ? new Date(`${iso}T12:00:00Z`) : null;
  return d && !isNaN(d) && d.toISOString().slice(0, 10) === iso ? iso : "INVALIDA";
}

const chave = (s) => norm(s).replace(/[^a-z0-9]/g, ""); // "BPC Loas" == "BPC/LOAS"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const wb = XLSX.readFile(arquivo, { cellDates: true });
const aba = wb.Sheets[wb.SheetNames[0]];
const linhas = XLSX.utils.sheet_to_json(aba, { defval: null, raw: true });
const mapa = mapearCabecalho(Object.keys(linhas[0] ?? {}));
console.log(`Aba "${wb.SheetNames[0]}": ${linhas.length} linhas.`);
console.log("Colunas reconhecidas:", mapa);
const faltando = ["numero", "cliente", "data_entrega_docs"].filter((c) => !mapa[c]);
if (faltando.length) console.warn("ATENÇÃO - colunas não encontradas:", faltando, "(ajuste COLUNAS no script)");

const [{ data: tipos }, { data: perfis }, { data: existentes }] = await Promise.all([
  db.from("tipos_processo").select("id, nome, natureza"),
  db.from("perfis").select("id, nome"),
  db.from("contratos").select("numero").not("numero", "is", null),
]);
const numerosExistentes = new Set((existentes ?? []).map((c) => String(c.numero)));

const acharTipo = (v) => {
  const n = chave(v);
  if (!n) return null;
  return (tipos ?? []).find((t) => chave(t.nome) === n || n.includes(chave(t.nome)) || chave(t.nome).includes(n))?.id ?? null;
};
const acharPerfil = (v) => {
  const n = norm(v);
  if (!n) return null;
  return (
    (perfis ?? []).find((p) => norm(p.nome) === n) ??
    (perfis ?? []).find((p) => norm(p.nome).startsWith(n) || n.startsWith(norm(p.nome).split(" ")[0]))
  )?.id ?? null;
};

const erros = [];
const avisos = [];
const validos = [];
const vistos = new Set();
linhas.forEach((l, i) => {
  const linha = i + 2; // header is row 1
  const get = (campo) => (mapa[campo] ? l[mapa[campo]] : null);
  const numero = get("numero") === null ? null : String(get("numero")).trim();
  const cliente = get("cliente") ? String(get("cliente")).trim() : null;
  if (!numero && !cliente) return; // empty row
  if (!cliente) return erros.push(`Linha ${linha}: sem nome do cliente.`);
  if (numero && vistos.has(numero)) return erros.push(`Linha ${linha}: nº de contrato ${numero} repetido na planilha.`);
  if (numero && numerosExistentes.has(numero)) return avisos.push(`Linha ${linha}: contrato ${numero} já existe no sistema (ignorado).`);
  if (numero) vistos.add(numero);

  const datas = {
    data_assinatura: data(get("data_assinatura")),
    data_entrega_docs: data(get("data_entrega_docs")),
    data_distribuicao: data(get("data_distribuicao")),
  };
  for (const [c, v] of Object.entries(datas)) {
    if (v === "INVALIDA") {
      avisos.push(`Linha ${linha}: data inválida em "${mapa[c]}" (${get(c)}) - deixada em branco.`);
      datas[c] = null;
    }
  }

  const statusTxt = norm(get("status"));
  const cancelado = statusTxt.includes("cancel") || statusTxt.includes("desist");
  const motivoTxt = norm(get("motivo")) || statusTxt;
  const status = cancelado ? "cancelado" : datas.data_distribuicao ? "distribuido" : "em_andamento";
  if (status === "distribuido" && !numero) {
    avisos.push(`Linha ${linha}: distribuído sem nº de contrato - importado como "em andamento".`);
  }

  const naturezaTxt = norm(get("natureza"));
  const cpf = String(get("cpf") ?? "").replace(/\D/g, "") || null;
  if (cpf && cpf.length !== 11) avisos.push(`Linha ${linha}: CPF "${get("cpf")}" inválido - ignorado.`);
  const tipoId = acharTipo(get("tipo"));
  if (get("tipo") && !tipoId) avisos.push(`Linha ${linha}: tipo "${get("tipo")}" não cadastrado - deixado em branco.`);
  const respId = acharPerfil(get("responsavel"));
  if (get("responsavel") && !respId) avisos.push(`Linha ${linha}: responsável "${get("responsavel")}" não é usuário do sistema - deixado em branco.`);

  validos.push({
    linha,
    cliente: { nome: cliente, cpf: cpf && cpf.length === 11 ? cpf : null, telefone: get("telefone") ? String(get("telefone")) : null },
    contrato: {
      numero,
      natureza: naturezaTxt.startsWith("civ") ? "civel" : "previdenciaria",
      tipo_id: tipoId,
      responsavel_id: respId,
      status: status === "distribuido" && !numero ? "em_andamento" : status,
      motivo_cancelamento: cancelado ? (motivoTxt.includes("potencial") || motivoTxt.includes("analise") ? "sem_potencial" : "desistencia") : null,
      ...datas,
      data_distribuicao: status === "distribuido" && numero ? datas.data_distribuicao : null,
      origem: "importacao",
    },
    pendencia: get("pendencia") && !["nao", "n", "-", "0", "false"].includes(norm(get("pendencia")))
      ? { descricao: String(get("pendencia")), providencia: get("providencia") ? String(get("providencia")) : null, acao: get("acao") ? String(get("acao")) : null }
      : null,
  });
});

console.log(`\nVálidas: ${validos.length} · Erros: ${erros.length} · Avisos: ${avisos.length}`);
[...erros, ...avisos].forEach((m) => console.log(" - " + m));

if (!GRAVAR) {
  console.log("\nSimulação concluída. Nada foi gravado. Rode de novo com --gravar para importar.");
  process.exit(0);
}

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
  const { data: k, error } = await db.from("contratos").insert({ ...v.contrato, cliente_id: clienteId }).select("id").single();
  if (error) {
    console.log(` - Linha ${v.linha}: erro ao criar contrato: ${error.message}`);
    continue;
  }
  if (v.pendencia) await db.from("pendencias").insert({ ...v.pendencia, contrato_id: k.id, criado_por: null });
  ok++;
}
console.log(`\nImportados: ${ok} de ${validos.length}.`);
