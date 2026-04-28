import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Car,
  TrendingUp,
  DollarSign,
  Clock,
  Sparkles,
  CheckCircle2,
  Send,
  ChevronDown,
  PlusCircle,
  Phone,
  Calendar,
} from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type OrderStatus } from "@/components/app/StatusBadge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { fetchDashboard, notifyReady, type DashboardPayload, type Order } from "@/lib/api";
import { setSelectedOrderId } from "@/lib/selected-order";

export const Route = createFileRoute("/")({ component: Dashboard });

const statusGroups: { key: OrderStatus | "todas"; label: string; icon: typeof Car }[] = [
  { key: "todas", label: "Todas as Ordens", icon: Car },
  { key: "aguardando", label: "Aguardando", icon: Clock },
  { key: "em_lavagem", label: "Em Lavagem", icon: Sparkles },
  { key: "pronto", label: "Pronto", icon: CheckCircle2 },
  { key: "entregue", label: "Entregue", icon: Send },
];

function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDashboard()
      .then((payload) => {
        if (active) {
          setData(payload);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Falha ao carregar dashboard");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    if (!data) {
      return [];
    }

    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return data.orders;
    }

    return data.orders.filter((order) => {
      return [
        String(order.id),
        order.customerName,
        order.phone ?? "",
        order.vehicle ?? "",
        order.plate ?? "",
        order.color ?? "",
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [data, searchValue]);

  function handleOpenOrder(orderId: number) {
    setSelectedOrderId(orderId);
    navigate({ to: "/ordens" });
  }

  function handleBellClick() {
    if (!data) {
      return;
    }
    setError(null);
    setMessage(
      `Pendencias: ${data.stats.waiting} aguardando, ${data.stats.washing} em lavagem, ${data.stats.ready} prontas para retirada.`,
    );
  }

  async function handleNotifyReady(orderId: number) {
    setError(null);
    setMessage(null);
    try {
      const response = await notifyReady(orderId);
      setMessage(response.detail || "Cliente avisado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar aviso pelo WhatsApp");
    }
  }

  if (!data && !error) {
    return (
      <AppLayout onBellClick={handleBellClick}>
        <div className="py-16 text-center text-muted-foreground">Carregando dashboard...</div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout onBellClick={handleBellClick}>
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onBellClick={handleBellClick}
    >
      <div className="space-y-8">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-glow/30 blur-3xl" />
          <div className="absolute -bottom-20 right-32 h-56 w-56 rounded-full bg-accent/40 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-primary-foreground/80">
                Bom dia, {data.currentUser.name.split(" ")[0]}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Sua operação está fluindo bem.
              </h1>
              <p className="mt-2 text-primary-foreground/80">
                {data.stats.totalToday} ordens hoje • R$ {data.stats.revenueToday.toFixed(2)} faturados
              </p>
            </div>
            <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-soft">
              <Link to="/nova-ordem">
                <PlusCircle className="h-5 w-5" />
                Nova Ordem
              </Link>
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <KpiCard
            label="Total Hoje"
            value={data.stats.totalToday}
            icon={Car}
            tone="default"
          />
          <KpiCard label="Aguardando" value={data.stats.waiting} icon={Clock} tone="waiting" />
          <KpiCard label="Em Lavagem" value={data.stats.washing} icon={Sparkles} tone="washing" />
          <KpiCard label="Pronto" value={data.stats.ready} icon={CheckCircle2} tone="ready" />
          <KpiCard label="Entregue" value={data.stats.delivered} icon={Send} tone="delivered" />
        </div>

        {/* Revenue strip */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <RevenueCard label="Faturamento Hoje" value={data.stats.revenueToday} icon={DollarSign} />
          <RevenueCard label="Faturamento Semana" value={data.stats.revenueWeek} icon={TrendingUp} />
          <RevenueCard label="Ticket Médio" value={data.stats.ticketAvg} icon={Calendar} />
        </div>

        {/* Order lists */}
        <div className="space-y-4">
          {message && <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
          {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {statusGroups.map((g) => (
            <OrderGroup
              key={g.key}
              groupKey={g.key}
              label={g.label}
              Icon={g.icon}
              orders={filteredOrders}
              onOpenOrder={handleOpenOrder}
              onNotifyReady={handleNotifyReady}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Car;
  tone: "default" | "waiting" | "washing" | "ready" | "delivered";
}) {
  const tones: Record<string, string> = {
    default: "from-primary/10 to-primary-glow/10 text-primary",
    waiting: "text-[color:var(--status-waiting)]",
    washing: "text-[color:var(--status-washing)]",
    ready: "text-[color:var(--status-ready)]",
    delivered: "text-[color:var(--status-delivered)]",
  };
  const bgs: Record<string, string> = {
    default: "bg-card",
    waiting: "bg-[color:var(--status-waiting-bg)]",
    washing: "bg-[color:var(--status-washing-bg)]",
    ready: "bg-[color:var(--status-ready-bg)]",
    delivered: "bg-[color:var(--status-delivered-bg)]",
  };
  return (
    <Card className={cn("border-border/60 shadow-soft transition-smooth hover:shadow-elegant", bgs[tone])}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <Icon className={cn("h-4 w-4", tones[tone])} />
        </div>
        <p className={cn("mt-3 text-3xl font-bold tracking-tight", tones[tone])}>{value}</p>
      </CardContent>
    </Card>
  );
}

function RevenueCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof DollarSign;
}) {
  return (
    <Card className="border-border/60 shadow-soft overflow-hidden">
      <CardContent className="relative p-6">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-glow/10 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              R$ {value.toFixed(2)}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderGroup({
  groupKey,
  label,
  Icon,
  orders,
  onOpenOrder,
  onNotifyReady,
}: {
  groupKey: OrderStatus | "todas";
  label: string;
  Icon: typeof Car;
  orders: Order[];
  onOpenOrder: (orderId: number) => void;
  onNotifyReady: (orderId: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(groupKey === "aguardando" || groupKey === "em_lavagem");
  const filteredOrders =
    groupKey === "todas"
      ? orders
      : orders.filter((o) => o.status === groupKey);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border/60 shadow-soft overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between p-5 text-left transition-smooth hover:bg-muted/40">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  groupKey === "todas" && "bg-primary/10 text-primary",
                  groupKey === "aguardando" && "bg-[color:var(--status-waiting-bg)] text-[color:var(--status-waiting)]",
                  groupKey === "em_lavagem" && "bg-[color:var(--status-washing-bg)] text-[color:var(--status-washing)]",
                  groupKey === "pronto" && "bg-[color:var(--status-ready-bg)] text-[color:var(--status-ready)]",
                  groupKey === "entregue" && "bg-[color:var(--status-delivered-bg)] text-[color:var(--status-delivered)]",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{filteredOrders.length} ordens</p>
              </div>
            </div>
            <ChevronDown
              className={cn("h-5 w-5 text-muted-foreground transition-transform", open && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-80 overflow-y-auto border-t border-border/60">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma ordem nesta categoria.</div>
            ) : (
              <ul className="divide-y divide-border/60">
                {filteredOrders.map((o) => (
                  <li
                    key={o.id}
                    onClick={() => onOpenOrder(o.id)}
                    className={cn(
                      "flex flex-col gap-2 p-4 transition-smooth sm:flex-row sm:items-center sm:justify-between",
                      "cursor-pointer hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground/70 text-xs font-bold">
                        #{o.id}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{o.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.vehicle} • {o.color} • {o.plate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground hidden md:block">
                        {new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        R$ {o.total.toFixed(2)}
                      </span>
                      <StatusBadge status={o.status as OrderStatus} />
                      {o.status === "pronto" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onNotifyReady(o.id);
                          }}
                        >
                          <Phone className="h-3.5 w-3.5" /> Avisar
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
