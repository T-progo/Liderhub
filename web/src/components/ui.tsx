import type { ComponentProps, ReactNode } from "react";

// Small Tailwind UI kit used across the app.

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" };
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const v = {
    primary: "bg-brand-600 text-white shadow-sm shadow-brand-900/10 hover:bg-brand-700",
    secondary: "border border-stone-300 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50",
    danger: "bg-red-700 text-white hover:bg-red-800",
    ghost: "text-stone-700 hover:bg-stone-100",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:outline-none disabled:opacity-50",
        v,
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cx(
        "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-shadow focus:border-brand-500 focus:ring-3 focus:ring-brand-100 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cx(
        "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-shadow focus:border-brand-500 focus:ring-3 focus:ring-brand-100 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cx(
        "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-shadow focus:border-brand-500 focus:ring-3 focus:ring-brand-100 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(68,40,24,0.06)]", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-stone-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "gray" | "green" | "red" | "amber" | "blue";
export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  const t = {
    gray: "bg-stone-100 text-stone-700 ring-stone-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    red: "bg-red-50 text-red-800 ring-red-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-brand-50 text-brand-800 ring-brand-200",
  }[tone];
  return <span className={cx("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", t)}>{children}</span>;
}

// Deadline status of a contract, from the contratos_prazos view columns.
export function PrazoBadge(c: {
  status: string;
  data_entrega_docs: string | null;
  dias_restantes: number | null;
  dias_atraso: number | null;
  tempo_distribuicao: number | null;
  no_prazo: boolean | null;
}) {
  if (c.status === "cancelado") return <Badge>Cancelado</Badge>;
  if (c.status === "distribuido") {
    return (
      <Badge tone={c.no_prazo ? "green" : "red"}>
        {c.no_prazo ? "No prazo" : "Fora do prazo"} ({c.tempo_distribuicao} d)
      </Badge>
    );
  }
  if (!c.data_entrega_docs) return <Badge>Sem data de entrega</Badge>;
  if ((c.dias_atraso ?? 0) > 0) return <Badge tone="red">{c.dias_atraso} d de atraso</Badge>;
  const r = c.dias_restantes ?? 0;
  if (r === 0) return <Badge tone="red">Vence hoje</Badge>;
  if (r <= 3) return <Badge tone="amber">{r} d restantes</Badge>;
  return <Badge tone="blue">{r} d restantes</Badge>;
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>;
}
