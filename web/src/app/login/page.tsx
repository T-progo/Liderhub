"use client";

import { useActionState } from "react";
import { entrar, type LoginState } from "./actions";
import { Button, ErrorBox, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(entrar, {});

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-espresso p-12 text-stone-100 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-500 font-serif text-lg font-semibold text-white">AL</div>
          <p className="font-serif text-lg font-semibold text-white">Almeida Lima</p>
        </div>
        <div className="relative max-w-md">
          <p className="font-serif text-4xl leading-tight font-medium text-white">Cada prazo acompanhado, cada cliente bem atendido.</p>
          <p className="mt-4 text-stone-400">Controle de distribuição de processos do Estúdio Jurídico Almeida Lima.</p>
        </div>
        <p className="relative text-xs text-stone-500">Acesso restrito à equipe do escritório.</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <form action={action} className="w-full max-w-sm space-y-5">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-500 font-serif text-lg font-semibold text-white">AL</div>
            <p className="font-serif text-lg font-semibold">Almeida Lima</p>
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Bem-vindo(a)</h1>
            <p className="mt-1 text-sm text-stone-500">Entre com seu e-mail e senha para acessar o controle de distribuição.</p>
          </div>
          <Field label="E-mail">
            <Input name="email" type="email" autoComplete="email" required className="py-2.5" />
          </Field>
          <Field label="Senha">
            <Input name="senha" type="password" autoComplete="current-password" required className="py-2.5" />
          </Field>
          <ErrorBox message={state.erro} />
          <Button type="submit" disabled={pending} className="w-full py-2.5">
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
