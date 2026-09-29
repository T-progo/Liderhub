"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { vazioNull } from "@/lib/format";

export type AdminState = { erro?: string; ok?: string };

const soDigitos = (v: string | null) => (v ?? "").replace(/\D/g, "") || null;

export async function criarUsuario(_prev: AdminState, fd: FormData): Promise<AdminState> {
  await requireAdmin();
  const email = vazioNull(fd.get("email"));
  const nome = vazioNull(fd.get("nome"));
  const senha = String(fd.get("senha") ?? "");
  if (!email || !nome) return { erro: "Informe nome e e-mail." };
  if (senha.length < 8) return { erro: "A senha temporária precisa ter pelo menos 8 caracteres." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error) {
    return { erro: error.message.includes("already") ? "Já existe um usuário com esse e-mail." : error.message };
  }
  // The perfis row is created by the on_auth_user_created trigger; complete it here.
  await admin
    .from("perfis")
    .update({ nome, papel: fd.get("papel") === "admin" ? "admin" : "usuario", whatsapp: soDigitos(vazioNull(fd.get("whatsapp"))) })
    .eq("id", data.user.id);
  refresh();
  return { ok: `Usuário ${nome} criado. Envie a ele o e-mail e a senha temporária.` };
}

export async function atualizarUsuario(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const { user } = await requireAdmin();
  const id = String(fd.get("id"));
  const ativo = fd.get("ativo") === "on";
  const papel = fd.get("papel") === "admin" ? "admin" : "usuario";
  if (id === user.id && (!ativo || papel !== "admin")) {
    return { erro: "Você não pode remover o seu próprio acesso de administrador." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("perfis")
    .update({ nome: vazioNull(fd.get("nome")), papel, ativo, whatsapp: soDigitos(vazioNull(fd.get("whatsapp"))) })
    .eq("id", id);
  if (error) return { erro: error.message };
  // Block/unblock the login itself, not only the profile.
  await admin.auth.admin.updateUserById(id, { ban_duration: ativo ? "none" : "876000h" });

  const senha = String(fd.get("nova_senha") ?? "");
  if (senha) {
    if (senha.length < 8) return { erro: "A nova senha precisa ter pelo menos 8 caracteres." };
    const { error: e2 } = await admin.auth.admin.updateUserById(id, { password: senha });
    if (e2) return { erro: e2.message };
  }
  refresh();
  return { ok: "Usuário atualizado." };
}

export async function adicionarTipo(fd: FormData) {
  const { supabase } = await requireAdmin();
  const nome = vazioNull(fd.get("nome"));
  if (!nome) return;
  await supabase.from("tipos_processo").insert({ nome, natureza: fd.get("natureza") === "civel" ? "civel" : "previdenciaria" });
  refresh();
}

export async function alternarTipo(fd: FormData) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("tipos_processo")
    .update({ ativo: fd.get("ativo") !== "true" })
    .eq("id", Number(fd.get("id")));
  refresh();
}

export async function salvarConfiguracoes(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const prazo = Number(fd.get("prazo_dias"));
  const atraso2 = Number(fd.get("atraso_2_dias"));
  const meta = Number(fd.get("meta_no_prazo"));
  if (!(prazo > 0) || !(atraso2 >= 2) || !(meta > 0 && meta <= 100)) return { erro: "Valores inválidos." };
  const { error } = await supabase
    .from("configuracoes")
    .update({ prazo_dias: prazo, atraso_2_dias: atraso2, meta_no_prazo: meta })
    .eq("id", true);
  if (error) return { erro: error.message };
  refresh();
  return { ok: "Configurações salvas." };
}
