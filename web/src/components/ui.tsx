import type { ComponentProps, ReactNode } from "react";

// Small Tailwind UI kit used across the app.

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" };
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const v = {
    primary: "bg-blue-700 text-white hover:bg-blue-800",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-700 hover:bg-slate-100",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50",
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
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none",
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
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none",
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
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-slate-800">{title}</h2>}
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
    gray: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
  }[tone];
  return <span className={cx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", t)}>{children}</span>;
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
  return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}
