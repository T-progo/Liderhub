"use client";

import { useActionState } from "react";
import { atualizarUsuario, criarUsuario, salvarConfiguracoes, type AdminState } from "./actions";
import { Badge, Button, ErrorBox, Field, Input, Select } from "@/components/ui";
import type { Configuracoes, Perfil } from "@/lib/types";

function Retorno({ state }: { state: AdminState }) {
  return (
    <>
      <ErrorBox message={state.erro} />
      {state.ok && <p className="text-sm text-emerald-700">{state.ok}</p>}
    </>
  );
}

export function NovoUsuarioForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(criarUsuario, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Nome">
          <Input name="nome" placeholder="Ex.: Vitória" required />
        </Field>
        <Field label="E-mail">
          <Input name="email" type="email" placeholder="nome@email.com" required />
        </Field>
        <Field label="Senha temporária">
          <Input name="senha" type="text" placeholder="Mínimo 8 caracteres" required minLength={8} />
        </Field>
        <Field label="WhatsApp">
          <Input name="whatsapp" placeholder="DDD + número" />
        </Field>
        <Field label="Perfil">
          <Select name="papel" defaultValue="usuario">
            <option value="usuario">Usuário</option>
            <option value="admin">Administrador</option>
          </Select>
        </Field>
      </div>
      <Retorno state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Criando..." : "Criar usuário"}</Button>
    </form>
  );
}

export function UsuarioForm({ perfil, email }: { perfil: Perfil; email: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(atualizarUsuario, {});
  return (
    <form
      action={action}
      className={`space-y-3 rounded-xl border p-4 ${perfil.ativo ? "border-stone-200 bg-stone-50/60" : "border-dashed border-stone-300 bg-white opacity-75"}`}
    >
      <input type="hidden" name="id" value={perfil.id} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
          {perfil.nome.trim().slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-stone-900">{perfil.nome}</p>
          <p className="truncate text-xs text-stone-500">{email}</p>
        </div>
        <Badge tone={perfil.papel === "admin" ? "blue" : "gray"}>{perfil.papel === "admin" ? "Administrador" : "Usuário"}</Badge>
        {!perfil.ativo && <Badge tone="red">Inativo</Badge>}
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
        <Field label="Nome">
          <Input name="nome" defaultValue={perfil.nome} required />
        </Field>
        <Field label="WhatsApp">
          <Input name="whatsapp" defaultValue={perfil.whatsapp ?? ""} placeholder="DDD + número" />
        </Field>
        <Field label="Perfil">
          <Select name="papel" defaultValue={perfil.papel}>
            <option value="usuario">Usuário</option>
            <option value="admin">Administrador</option>
          </Select>
        </Field>
        <Field label="Nova senha">
          <Input name="nova_senha" type="text" placeholder="Opcional" />
        </Field>
        <label className="flex h-[38px] items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="ativo" defaultChecked={perfil.ativo} className="h-4 w-4 accent-brand-600" /> Ativo
        </label>
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
      </div>
      <Retorno state={state} />
    </form>
  );
}

export function ConfiguracoesForm({ cfg }: { cfg: Configuracoes }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(salvarConfiguracoes, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid items-end gap-3 md:grid-cols-3">
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
