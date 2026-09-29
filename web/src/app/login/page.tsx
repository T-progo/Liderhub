"use client";

import { useActionState } from "react";
import { entrar, type LoginState } from "./actions";
import { Button, ErrorBox, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(entrar, {});

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold">Controle de Distribuição</h1>
          <p className="text-sm text-slate-500">Entre com seu e-mail e senha.</p>
        </div>
        <Field label="E-mail">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Senha">
          <Input name="senha" type="password" autoComplete="current-password" required />
        </Field>
        <ErrorBox message={state.erro} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
