import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Send, DollarSign, ListChecks, Filter, ReceiptText, Briefcase, Calculator } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, type OrderStatus } from "@/components/app/StatusBadge";
import { exportFinanceReport, fetchFinanceReport, sendFinanceWhatsapp, type FinanceReport } from "@/lib/api";
import { useManagerPasswordDialog } from "@/components/app/ManagerPasswordDialog";

export const Route = createFileRoute("/financeiro")({ component: Financeiro });

function Financeiro() {
  const { askManagerPassword, dialog } = useManagerPasswordDialog();
  const [filters, setFilters] = useState({ start: "2025-04-01", end: "2025-04-24", status: "all" });
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    try {
      const payload = await fetchFinanceReport(filters);
      setReport(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar relatorio");
    }
  }

  useEffect(() => {
    loadReport();
  }, []);

  const finalizedCount = report?.summary.finalizedCount ?? 0;
  const total = report?.summary.totalAmount ?? 0;

  async function handleExport() {
    const managerPassword = await askManagerPassword("exportar relatorio");
    if (!managerPassword) {
      return;
    }
    try {
      const blob = await exportFinanceReport(filters, managerPassword);
      const url = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = "financeiro.xlsx";
      anchor.click();
      window.URL.revokeObjectURL(url);
      setMessage("Relatorio exportado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar relatorio");
    }
  }

  async function handleSendWhatsapp() {
    const managerPassword = await askManagerPassword("enviar relatorio por WhatsApp");
    if (!managerPassword) {
      return;
    }
    const phone = window.prompt("Numero para envio do resumo:");
    if (!phone) {
      return;
    }
    try {
      await sendFinanceWhatsapp({ ...filters, phone }, managerPassword);
      setMessage("Envio para WhatsApp solicitado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar relatorio");
    }
  }

  return (
    <AppLayout>
      {dialog}
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financeiro Operacional</h1>
            <p className="text-sm text-muted-foreground">Acompanhe seu faturamento e exporte relatórios.</p>
          </div>
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-primary" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <Label>Data Inicial</Label>
              <Input type="date" className="mt-1.5" value={filters.start} onChange={(e) => setFilters((current) => ({ ...current, start: e.target.value }))} />
            </div>
            <div>
              <Label>Data Final</Label>
              <Input type="date" className="mt-1.5" value={filters.end} onChange={(e) => setFilters((current) => ({ ...current, end: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="em_lavagem">Em Lavagem</SelectItem>
                  <SelectItem value="pronto">Pronto</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full bg-gradient-primary shadow-glow" onClick={loadReport}>Aplicar Filtro</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border-border/60 shadow-elegant overflow-hidden bg-gradient-hero text-primary-foreground">
            <CardContent className="relative p-6">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-glow/30 blur-3xl" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-sm uppercase tracking-widest text-primary-foreground/80">Faturamento Total</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight">R$ {total.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-primary-foreground/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">O.L. Finalizadas</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight">{finalizedCount}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ListChecks className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">Custos Operacionais</p>
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
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">Custo Equipe</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">R$ {(report?.summary.teamCostTotal ?? 0).toFixed(2)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Briefcase className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">Custo Operacional</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">R$ {(report?.summary.netOperationalTotal ?? 0).toFixed(2)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Calculator className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Detalhamento</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Excel</Button>
              <Button size="sm" className="bg-gradient-primary shadow-glow" onClick={handleSendWhatsapp}><Send className="h-4 w-4" /> WhatsApp</Button>
            </div>
          </CardHeader>
          <CardContent>
            {message && <p className="mb-4 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
            {error && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="max-h-96 overflow-y-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left">
                    <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                    <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                    <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Veículo</th>
                    <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {report?.rows.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/40 transition-smooth">
                      <td className="p-3 font-mono text-xs">#{o.id}</td>
                      <td className="p-3 font-medium">{o.customerName}</td>
                      <td className="p-3 text-muted-foreground">{o.vehicle} • {o.plate}</td>
                      <td className="p-3"><StatusBadge status={o.status as OrderStatus} /></td>
                      <td className="p-3 text-right font-semibold">R$ {o.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
