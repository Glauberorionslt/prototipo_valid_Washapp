import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, DollarSign, Filter, ReceiptText, Wallet, Calculator } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchGeneralResultReport, type GeneralResultReport } from "@/lib/api";

export const Route = createFileRoute("/resultado-geral")({ component: ResultadoGeral });

const GENERAL_RESULT_FILTERS_STORAGE_KEY = "washapp2.general-result.filters";

function getDefaultFilters() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return { start: `${year}-${month}-01`, end: `${year}-${month}-${day}` };
}

function readStoredFilters() {
  if (typeof window === "undefined") {
    return getDefaultFilters();
  }

  try {
    const raw = window.localStorage.getItem(GENERAL_RESULT_FILTERS_STORAGE_KEY);
    if (!raw) {
      return getDefaultFilters();
    }
    const parsed = JSON.parse(raw) as Partial<{ start: string; end: string }>;
    return {
      start: parsed.start || getDefaultFilters().start,
      end: parsed.end || getDefaultFilters().end,
    };
  } catch {
    return getDefaultFilters();
  }
}

function ResultadoGeral() {
  const [filters, setFilters] = useState(readStoredFilters);
  const [report, setReport] = useState<GeneralResultReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    try {
      const payload = await fetchGeneralResultReport(filters);
      setReport(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar resultado geral");
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(GENERAL_RESULT_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Resultado Geral</h1>
            <p className="text-sm text-muted-foreground">Veja o acumulado do período combinando faturamento, despesas operacionais e despesas fixas.</p>
          </div>
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-primary" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label>Data Inicial</Label>
              <Input type="date" className="mt-1.5" value={filters.start} onChange={(e) => setFilters((current) => ({ ...current, start: e.target.value }))} />
            </div>
            <div>
              <Label>Data Final</Label>
              <Input type="date" className="mt-1.5" value={filters.end} onChange={(e) => setFilters((current) => ({ ...current, end: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <Button className="w-full bg-gradient-primary shadow-glow" onClick={loadReport}>Aplicar Filtro</Button>
            </div>
          </CardContent>
        </Card>

        {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/60 shadow-elegant overflow-hidden bg-gradient-hero text-primary-foreground">
            <CardContent className="relative p-6">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-glow/30 blur-3xl" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-sm uppercase tracking-widest text-primary-foreground/80">Faturamento Acumulado</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight">R$ {(report?.summary.totalAmount ?? 0).toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-primary-foreground/70" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">Despesas Operacionais</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">R$ {(report?.summary.operationalCostTotal ?? 0).toFixed(2)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ReceiptText className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">Despesas Fixas</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">R$ {(report?.summary.fixedCostTotal ?? 0).toFixed(2)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">Resultado Geral</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">R$ {(report?.summary.generalResultTotal ?? 0).toFixed(2)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Calculator className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}