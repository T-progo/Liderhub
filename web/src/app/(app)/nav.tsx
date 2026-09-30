"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONES = {
  contratos: "M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5",
  painel: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  admin: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
};
export type Icone = keyof typeof ICONES;

export function Icon({ nome, className = "h-4.5 w-4.5" }: { nome: Icone; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={ICONES[nome]} />
    </svg>
  );
}

export function NavLinks({ links, compacto = false }: { links: { href: string; label: string; icone: Icone }[]; compacto?: boolean }) {
  const path = usePathname();
  return links.map((l) => {
    const ativo = path === l.href || path.startsWith(`${l.href}/`);
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={ativo ? "page" : undefined}
        className={
          compacto
            ? `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap ${ativo ? "bg-brand-100 font-medium text-brand-800" : "text-stone-600"}`
            : `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                ativo ? "bg-white/10 font-medium text-white" : "text-stone-300 hover:bg-white/5 hover:text-white"
              }`
        }
      >
        <Icon nome={l.icone} className={`h-4.5 w-4.5 ${!compacto && ativo ? "text-brand-300" : ""}`} />
        {l.label}
      </Link>
    );
  });
}
