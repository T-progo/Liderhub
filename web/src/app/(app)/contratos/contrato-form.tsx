"use client";

import { useActionState, useState } from "react";
import { salvarContrato, type FormState } from "./actions";
import { Button, ErrorBox, Field, Input, Select } from "@/components/ui";
import { NATUREZA, cpf as fmtCpf } from "@/lib/format";
import type { Cliente, ContratoPrazo, Natureza, Perfil, TipoProcesso } from "@/lib/types";

type Props = {
  contrato?: ContratoPrazo;
  cliente?: Cliente; // fixed client (edit, or "novo contrato" for an existing client)
  tipos: TipoProcesso[];
  perfis: Perfil[];
};

export function ContratoForm({ contrato, cliente, tipos, perfis }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(salvarContrato, {});
  const [natureza, setNatureza] = useState<Natureza>(contrato?.natureza ?? "previdenciaria");
  const tiposDaNatureza = tipos.filter((t) => t.natureza === natureza && (t.ativo || t.id === contrato?.tipo_id));

  return (
    <form action={action} className="space-y-4">
      {contrato && <input type="hidden" name="id" value={contrato.id} />}

      {cliente ? (
        <input type="hidden" name="cliente_id" value={cliente.id} />
      ) : (
        <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Cliente</legend>
          <Field label="Nome completo">
            <Input name="cliente_nome" required />
          </Field>
          <Field label="CPF" hint="Se o CPF já existir, o contrato é ligado ao mesmo cliente.">
            <Input name="cliente_cpf" inputMode="numeric" placeholder="000.000.000-00" />
          </Field>
          <Field label="Telefone">
            <Input name="cliente_telefone" />
          </Field>
        </fieldset>
      )}
      {cliente && !contrato && (
        <p className="text-sm text-slate-600">
          Cliente: <strong>{cliente.nome}</strong> {cliente.cpf && `(${fmtCpf(cliente.cpf)})`}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nº do contrato" hint="Obrigatório para marcar como distribuído.">
          <Input name="numero" defaultValue={contrato?.numero ?? ""} />
        </Field>
        <Field label="Natureza">
          <Select name="natureza" value={natureza} onChange={(e) => setNatureza(e.target.value as Natureza)}>
            {Object.entries(NATUREZA).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select name="tipo_id" defaultValue={contrato?.tipo_id ?? ""} key={natureza}>
            <option value="">(não informado)</option>
            {tiposDaNatureza.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </Select>
        </Field>
        <Field label="Responsável">
          <Select name="responsavel_id" defaultValue={contrato?.responsavel_id ?? ""}>
            <option value="">(sem responsável)</option>
            {perfis
              .filter((p) => p.ativo || p.id === contrato?.responsavel_id)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
          </Select>
        </Field>
        <Field label="Data de assinatura do contrato">
          <Input type="date" name="data_assinatura" defaultValue={contrato?.data_assinatura ?? ""} />
        </Field>
        <Field label="Data de entrega dos documentos" hint="Inicia o prazo de distribuição.">
          <Input type="date" name="data_entrega_docs" defaultValue={contrato?.data_entrega_docs ?? ""} />
        </Field>
        <Field label="Link da pasta no OneDrive">
          <Input type="url" name="onedrive_url" defaultValue={contrato?.onedrive_url ?? ""} placeholder="https://..." />
        </Field>
      </div>

      <ErrorBox message={state.erro} />
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : contrato ? "Salvar alterações" : "Criar contrato"}
      </Button>
    </form>
  );
}
