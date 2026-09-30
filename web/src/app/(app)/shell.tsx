import type { Perfil } from "@/lib/types";
import { sair } from "../login/actions";
import { NavLinks, type Icone } from "./nav";

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function Sair({ className }: { className: string }) {
  return (
    <form action={sair}>
      <button className={className} title="Sair">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
          <path d="M15 17l5-5-5-5M20 12H9M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
        </svg>
        Sair
      </button>
    </form>
  );
}

export function Shell({ perfil, children }: { perfil: Pick<Perfil, "nome" | "papel">; children: React.ReactNode }) {
  const links: { href: string; label: string; icone: Icone }[] = [
    { href: "/contratos", label: "Contratos", icone: "contratos" },
    { href: "/painel", label: "Painel", icone: "painel" },
    ...(perfil.papel === "admin" ? [{ href: "/admin", label: "Administração", icone: "admin" as const }] : []),
  ];
  const papel = perfil.papel === "admin" ? "Administrador" : "Usuário";

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-espresso text-stone-100 md:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 font-serif text-lg font-semibold text-white">AL</div>
          <div className="leading-tight">
            <p className="font-serif text-[15px] font-semibold text-white">Almeida Lima</p>
            <p className="text-xs text-stone-400">Controle de Distribuição</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          <NavLinks links={links} />
        </nav>
        <div className="m-3 rounded-xl bg-espresso-700 p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-200 text-sm font-semibold text-brand-900">
              {iniciais(perfil.nome)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{perfil.nome}</p>
              <p className="text-xs text-stone-400">{papel}</p>
            </div>
          </div>
          <Sair className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-stone-300 transition-colors hover:bg-white/10 hover:text-white" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-cream/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 font-serif font-semibold text-white">AL</div>
            <p className="font-serif font-semibold">Almeida Lima</p>
          </div>
          <Sair className="flex items-center gap-1.5 text-sm text-stone-600" />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          <NavLinks links={links} compacto />
        </nav>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
