import { cn } from "@/lib/utils";

export type OrderStatus = "aguardando" | "em_lavagem" | "pronto" | "entregue";

const config: Record<
  OrderStatus,
  { label: string; text: string; bg: string; dot: string }
> = {
  aguardando: {
    label: "Aguardando",
    text: "text-[oklch(var(--status-waiting))]",
    bg: "bg-[color:var(--status-waiting-bg)]",
    dot: "bg-[color:var(--status-waiting)]",
  },
  em_lavagem: {
    label: "Em Lavagem",
    text: "text-[oklch(var(--status-washing))]",
    bg: "bg-[color:var(--status-washing-bg)]",
    dot: "bg-[color:var(--status-washing)]",
  },
  pronto: {
    label: "Pronto",
    text: "text-[oklch(var(--status-ready))]",
    bg: "bg-[color:var(--status-ready-bg)]",
    dot: "bg-[color:var(--status-ready)]",
  },
  entregue: {
    label: "Entregue",
    text: "text-[oklch(var(--status-delivered))]",
    bg: "bg-[color:var(--status-delivered-bg)]",
    dot: "bg-[color:var(--status-delivered)]",
  },
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        c.bg,
        className,
      )}
      style={{ color: `var(--status-${status === "em_lavagem" ? "washing" : status === "aguardando" ? "waiting" : status})` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: `var(--status-${status === "em_lavagem" ? "washing" : status === "aguardando" ? "waiting" : status})` }}
      />
      {c.label}
    </span>
  );
}

export const statusMeta = config;