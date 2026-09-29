import type { MotivoCancelamento, Natureza, StatusContrato } from "./types";

export const NATUREZA: Record<Natureza, string> = {
  civel: "Cível",
  previdenciaria: "Previdenciária",
};

export const STATUS: Record<StatusContrato, string> = {
  em_andamento: "Em andamento",
  distribuido: "Distribuído",
  cancelado: "Cancelado",
};

export const MOTIVO: Record<MotivoCancelamento, string> = {
  desistencia: "Desistência do cliente",
  sem_potencial: "Sem potencial (análise do advogado)",
};

// "2026-09-29" -> "29/09/2026" (dates are stored as calendar dates, no timezone shift).
export function data(d: string | null | undefined) {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

// Today in São Paulo as YYYY-MM-DD (default value for date inputs).
export function hojeISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function cpf(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length !== 11) return v ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function num(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined) return "-";
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

// Empty strings from forms -> null for the database.
export function vazioNull(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}
