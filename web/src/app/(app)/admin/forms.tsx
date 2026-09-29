"use client";

import { useActionState } from "react";
import { atualizarUsuario, criarUsuario, salvarConfiguracoes, type AdminState } from "./actions";
import { Button, ErrorBox, Field, Input, Select } from "@/components/ui";
import type { Configuracoes, Perfil } from "@/lib/types";

function Retorno({ state }: { state: AdminState }) {
  return (
    <>
      <ErrorBox message={state.erro} />
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
    </>
  );
}

export function NovoUsuarioForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(criarUsuario, {});
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 md:grid-cols-5">
        <Input name="nome" placeholder="Nome" required />
        <Input name="email" type="email" placeholder="E-mail" required />
        <Input name="senha" type="text" placeholder="Senha temporária (8+)" required minLength={8} />
        <Input name="whatsapp" placeholder="WhatsApp (DDD + número)" />
        <Select name="papel" defaultValue="usuario">
          <option value="usuario">Usuário</option>
          <option value="admin">Administrador</option>
        </Select>
      </div>
      <Retorno state={state} />
      <Button type="submit" disabled={pending}>Criar usuário</Button>
    </form>
  );
}

export function UsuarioForm({ perfil, email }: { perfil: Perfil; email: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(atualizarUsuario, {});
  return (
    <form action={action} className="space-y-2 rounded-md border border-slate-200 p-3">
      <input type="hidden" name="id" value={perfil.id} />
      <p className="text-xs text-slate-500">{email}</p>
      <div className="grid gap-2 md:grid-cols-5">
        <Input name="nome" defaultValue={perfil.nome} required />
        <Input name="whatsapp" defaultValue={perfil.whatsapp ?? ""} placeholder="WhatsApp" />
        <Select name="papel" defaultValue={perfil.papel}>
          <option value="usuario">Usuário</option>
          <option value="admin">Administrador</option>
        </Select>
        <Input name="nova_senha" type="text" placeholder="Nova senha (opcional)" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={perfil.ativo} /> Ativo
        </label>
      </div>
      <Retorno state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>Salvar</Button>
    </form>
  );
}

export function ConfiguracoesForm({ cfg }: { cfg: Configuracoes }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(salvarConfiguracoes, {});
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 md:grid-cols-3">
        <Field label="Prazo de distribuição (dias corridos)">
          <Input type="number" name="prazo_dias" min={1} defaultValue={cfg.prazo_dias} />
        </Field>
        <Field label="2º aviso de atraso (dias após o prazo)">
          <Input type="number" name="atraso_2_dias" min={2} defaultValue={cfg.atraso_2_dias} />
        </Field>
        <Field label="Meta de distribuição no prazo (%)">
          <Input type="number" name="meta_no_prazo" min={1} max={100} step="0.1" defaultValue={cfg.meta_no_prazo} />
        </Field>
      </div>
      <Retorno state={state} />
      <Button type="submit" disabled={pending}>Salvar configurações</Button>
    </form>
  );
}
