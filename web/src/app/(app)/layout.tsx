import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sair } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = await requireUser();

  const links = [
    { href: "/contratos", label: "Contratos" },
    { href: "/painel", label: "Painel" },
    ...(perfil.papel === "admin" ? [{ href: "/admin", label: "Administração" }] : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-sm font-semibold">Controle de Distribuição</p>
          <p className="text-xs text-slate-500">Almeida Lima</p>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 text-sm">
          <p className="truncate font-medium">{perfil.nome}</p>
          <p className="mb-2 text-xs text-slate-500">{perfil.papel === "admin" ? "Administrador" : "Usuário"}</p>
          <form action={sair}>
            <button className="text-xs text-blue-700 hover:underline">Sair</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
