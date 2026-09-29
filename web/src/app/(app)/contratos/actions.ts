"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { vazioNull } from "@/lib/format";

export type FormState = { erro?: string; ok?: string };

function mensagemErro(e: { code?: string; message: string }) {
  if (e.code === "23505" && e.message.includes("numero")) return "Já existe um contrato com esse número.";
  if (e.code === "23505" && e.message.includes("cpf")) return "Já existe um cliente com esse CPF.";
  if (e.message.includes("distribuido_com_numero")) return "Informe o nº do contrato antes de marcar como distribuído.";
  return `Erro ao salvar: ${e.message}`;
}

// Create or update a contract. A new contract either belongs to an existing client
// (cliente_id) or creates/reuses a client by CPF.
export async function salvarContrato(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const id = vazioNull(fd.get("id"));
  let clienteId = vazioNull(fd.get("cliente_id"));

  if (!clienteId) {
    const nome = vazioNull(fd.get("cliente_nome"));
    const cpf = (vazioNull(fd.get("cliente_cpf")) ?? "").replace(/\D/g, "") || null;
    const telefone = vazioNull(fd.get("cliente_telefone"));
    if (!nome) return { erro: "Informe o nome do cliente." };
    if (cpf && cpf.length !== 11) return { erro: "CPF deve ter 11 dígitos." };

    if (cpf) {
      const { data: existente } = await supabase.from("clientes").select("id").eq("cpf", cpf).maybeSingle();
      if (existente) clienteId = existente.id;
    }
    if (!clienteId) {
      const { data: novo, error } = await supabase
        .from("clientes")
        .insert({ nome, cpf, telefone })
        .select("id")
        .single();
      if (error) return { erro: mensagemErro(error) };
      clienteId = novo.id;
    }
  }

  const contrato = {
    cliente_id: clienteId,
    numero: vazioNull(fd.get("numero")),
    natureza: vazioNull(fd.get("natureza")) ?? "previdenciaria",
    tipo_id: vazioNull(fd.get("tipo_id")) ? Number(fd.get("tipo_id")) : null,
    descricao: vazioNull(fd.get("descricao")),
    responsavel_id: vazioNull(fd.get("responsavel_id")),
    data_assinatura: vazioNull(fd.get("data_assinatura")),
    data_entrega_docs: vazioNull(fd.get("data_entrega_docs")),
    onedrive_url: vazioNull(fd.get("onedrive_url")),
  };

  if (id) {
    const { error } = await supabase.from("contratos").update(contrato).eq("id", id);
    if (error) return { erro: mensagemErro(error) };
    refresh();
    return { ok: "Contrato salvo." };
  }

  const { data: criado, error } = await supabase.from("contratos").insert(contrato).select("id").single();
  if (error) return { erro: mensagemErro(error) };
  redirect(`/contratos/${criado.id}`);
}

export async function salvarCliente(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const id = String(fd.get("cliente_id"));
  const cpf = (vazioNull(fd.get("cpf")) ?? "").replace(/\D/g, "") || null;
  if (cpf && cpf.length !== 11) return { erro: "CPF deve ter 11 dígitos." };
  const { error } = await supabase
    .from("clientes")
    .update({ nome: vazioNull(fd.get("nome")), cpf, telefone: vazioNull(fd.get("telefone")) })
    .eq("id", id);
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: "Cliente salvo." };
}

export async function adicionarPendencia(fd: FormData) {
  const { supabase } = await requireUser();
  const descricao = vazioNull(fd.get("descricao"));
  if (!descricao) return;
  await supabase.from("pendencias").insert({
    contrato_id: String(fd.get("contrato_id")),
    descricao,
    providencia: vazioNull(fd.get("providencia")),
    acao: vazioNull(fd.get("acao")),
  });
  refresh();
}

export async function atualizarPendencia(fd: FormData) {
  const { supabase } = await requireUser();
  const resolver = fd.get("resolver") === "1";
  await supabase
    .from("pendencias")
    .update({
      providencia: vazioNull(fd.get("providencia")),
      acao: vazioNull(fd.get("acao")),
      ...(resolver ? { resolvida_em: vazioNull(fd.get("resolvida_em")) } : {}),
    })
    .eq("id", String(fd.get("id")));
  refresh();
}

export async function reabrirPendencia(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("pendencias").update({ resolvida_em: null }).eq("id", String(fd.get("id")));
  refresh();
}

export async function cancelarContrato(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const motivo = vazioNull(fd.get("motivo"));
  if (!motivo) return { erro: "Escolha o motivo do cancelamento." };
  const { error } = await supabase
    .from("contratos")
    .update({ status: "cancelado", motivo_cancelamento: motivo, obs_cancelamento: vazioNull(fd.get("obs")) })
    .eq("id", String(fd.get("id")));
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: "Contrato cancelado." };
}

export async function distribuirContrato(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const dataDistribuicao = vazioNull(fd.get("data_distribuicao"));
  if (!dataDistribuicao) return { erro: "Informe a data de distribuição." };
  const { error } = await supabase
    .from("contratos")
    .update({ status: "distribuido", data_distribuicao: dataDistribuicao })
    .eq("id", String(fd.get("id")));
  if (error) return { erro: mensagemErro(error) };
  refresh();
  return { ok: "Contrato marcado como distribuído." };
}

// Admin only: back to "em andamento" (undo cancel / distribution).
export async function reabrirContrato(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("contratos")
    .update({ status: "em_andamento", data_distribuicao: null, motivo_cancelamento: null, obs_cancelamento: null })
    .eq("id", String(fd.get("id")));
  refresh();
}
