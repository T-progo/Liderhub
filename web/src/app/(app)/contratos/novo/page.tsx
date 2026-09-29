import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { ContratoForm } from "../contrato-form";
import type { Cliente, Perfil, TipoProcesso } from "@/lib/types";

export default async function NovoContratoPage(props: PageProps<"/contratos/novo">) {
  const { cliente: clienteId } = (await props.searchParams) as { cliente?: string };
  const { supabase } = await requireUser();

  const [{ data: tipos }, { data: perfis }, { data: cliente }] = await Promise.all([
    supabase.from("tipos_processo").select("*").order("nome").returns<TipoProcesso[]>(),
    supabase.from("perfis").select("*").order("nome").returns<Perfil[]>(),
    clienteId
      ? supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle<Cliente>()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href="/contratos" className="text-sm text-blue-700 hover:underline">← Contratos</Link>
        <h1 className="text-xl font-semibold">Novo contrato</h1>
      </div>
      <Card>
        <ContratoForm tipos={tipos ?? []} perfis={perfis ?? []} cliente={cliente ?? undefined} />
      </Card>
    </div>
  );
}
