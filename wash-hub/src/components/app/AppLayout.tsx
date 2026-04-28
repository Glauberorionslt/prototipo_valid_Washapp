import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, PlusCircle, Users, Package, Wallet, Shield, LogOut, Droplets, Bell, Search, Briefcase, ReceiptText } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearAccessToken } from "@/lib/auth";
import { useCurrentUser } from "@/hooks/use-current-user";

const baseNav = [
  { to: "/" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/nova-ordem" as const, label: "Nova Ordem", icon: PlusCircle },
  { to: "/clientes" as const, label: "Clientes", icon: Users },
  { to: "/produtos" as const, label: "Produtos", icon: Package },
  { to: "/equipe" as const, label: "Equipe", icon: Briefcase },
  { to: "/custos-operacionais" as const, label: "Custos Operacionais", icon: ReceiptText },
  { to: "/financeiro" as const, label: "Financeiro", icon: Wallet },
  { to: "/admin" as const, label: "Admin Operacional", icon: Shield },
];

export function AppLayout({
  children,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar por placa, cliente, ordem...",
  onBellClick,
}: {
  children: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onBellClick?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, navigate, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-surface text-muted-foreground">
        Carregando sessao...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const nav = user.isMaster
    ? [...baseNav, { to: "/admin-sistema" as const, label: "Admin Sistema", icon: Shield }]
    : baseNav;

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col glass-dark text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">Wash App</p>
            <p className="text-xs text-sidebar-foreground/60">{user.shop}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {nav.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as "/"}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-xl bg-sidebar-accent/40 p-3">
            <p className="text-xs text-sidebar-foreground/60">Plano</p>
            <p className="text-sm font-semibold">{user.plan}</p>
            <p className="mt-2 text-xs text-sidebar-foreground/60">{user.shop}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearAccessToken();
              navigate({ to: "/login" });
            }}
            className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-smooth"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 glass border-b border-border/60">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-8">
            <div className="relative hidden flex-1 max-w-md md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-9 bg-background/60 border-border/60"
                value={searchValue ?? ""}
                onChange={(event) => onSearchChange?.(event.target.value)}
                readOnly={!onSearchChange}
              />
            </div>
            <div className="flex-1 md:hidden" />
            <Button variant="ghost" size="icon" className="relative" onClick={onBellClick}>
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary-glow shadow-glow" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.role}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground font-semibold shadow-soft">
                {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}