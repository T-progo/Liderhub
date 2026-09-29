"use client";

import { useActionState } from "react";
import { cancelarContrato, distribuirContrato, salvarCliente, type FormState } from "../actions";
import { Button, ErrorBox, Field, Input, Select, Textarea } from "@/components/ui";
import { MOTIVO, hojeISO } from "@/lib/format";
import type { Cliente } from "@/lib/types";

export function DistribuirForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(distribuirContrato, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Field label="Data de finalização / distribuição">
        <Input type="date" name="data_distribuicao" defaultValue={hojeISO()} required />
      </Field>
      <ErrorBox message={state.erro} />
      <Button type="submit" disabled={pending}>Marcar como distribuído</Button>
    </form>
  );
}

export function CancelarForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(cancelarContrato, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Field label="Motivo do cancelamento">
        <Select name="motivo" defaultValue="" required>
          <option value="" disabled>Escolha...</option>
          {Object.entries(MOTIVO).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </Field>
      <Field label="Observação">
        <Textarea name="obs" rows={2} />
      </Field>
      <ErrorBox message={state.erro} />
      <Button type="submit" variant="danger" disabled={pending}>Cancelar contrato</Button>
    </form>
  );
}

export function ClienteForm({ cliente }: { cliente: Cliente }) {
  const [state, action, pending] = useActionState<FormState, FormData>(salvarCliente, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="cliente_id" value={cliente.id} />
      <Field label="Nome completo">
        <Input name="nome" defaultValue={cliente.nome} required />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="CPF">
          <Input name="cpf" defaultValue={cliente.cpf ?? ""} inputMode="numeric" />
        </Field>
        <Field label="Telefone">
          <Input name="telefone" defaultValue={cliente.telefone ?? ""} />
        </Field>
      </div>
      <ErrorBox message={state.erro} />
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      <Button type="submit" variant="secondary" disabled={pending}>Salvar cliente</Button>
    </form>
  );
}
