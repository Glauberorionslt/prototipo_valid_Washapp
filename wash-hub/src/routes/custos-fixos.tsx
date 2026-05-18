import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ReceiptText, Plus, Pencil, Trash2, CalendarDays, Save, Filter, Download } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerPasswordDialog } from "@/components/app/ManagerPasswordDialog";
import {
  createFixedCostType,
  deleteFixedCostEntry,
  deleteFixedCostType,
  exportFixedCostEntries,
  fetchFixedCostEntries,
  listFixedCostTypes,
  saveFixedCostEntries,
  updateFixedCostEntry,
  updateFixedCostType,
  verifyManagerPassword,
  type FixedCostEntry,
  type FixedCostType,
} from "@/lib/api";

export const Route = createFileRoute("/custos-fixos")({ component: CustosFixosPage });

type LaunchLine = {
  costTypeId: string;
  amount: string;
};

function currentDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function readStoredFilters() {
  if (typeof window === "undefined") {
    const current = currentDateInput();
    return { start: current, end: current };
  }

  try {
    const raw = window.localStorage.getItem("washapp2.fixed-costs.filters");
    const current = currentDateInput();
    if (!raw) {
      return { start: current, end: current };
    }
    const parsed = JSON.parse(raw) as Partial<{ start: string; end: string }>;
    return { start: parsed.start || current, end: parsed.end || current };
  } catch {
    const current = currentDateInput();
    return { start: current, end: current };
  }
}

function CustosFixosPage() {
  const navigate = useNavigate();
  const { askManagerPassword, dialog } = useManagerPasswordDialog();
  const [managerPassword, setManagerPassword] = useState<string | null>(null);
  const [costTypes, setCostTypes] = useState<FixedCostType[]>([]);
  const [entries, setEntries] = useState<FixedCostEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(currentDateInput());
  const [filters, setFilters] = useState(readStoredFilters);
  const [launches, setLaunches] = useState<LaunchLine[]>([{ costTypeId: "", amount: "" }]);
  const [typeForm, setTypeForm] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTypes = useMemo(() => costTypes.filter((costType) => costType.isActive), [costTypes]);
  const totalEntries = useMemo(() => entries.reduce((sum, entry) => sum + entry.amount, 0), [entries]);

  async function handleExport() {
    const password = managerPassword ?? await askManagerPassword("exportar custos fixos");
    if (!password) {
      return;
    }
    try {
      const blob = await exportFixedCostEntries({ start: filters.start, end: filters.end }, password);
      const url = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `custos-fixos-${filters.start || "inicio"}-${filters.end || "fim"}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      setManagerPassword(password);
      setMessage("Tabela de despesas fixas exportada.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar custos fixos");
      setMessage(null);
    }
  }

  async function authorizePage() {
    const password = await askManagerPassword("acessar a area de custos fixos");
    if (!password) {
      navigate({ to: "/" });
      return;
    }

    try {
      await verifyManagerPassword(password);
      setManagerPassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Senha gerencial invalida");
      navigate({ to: "/" });
    }
  }

  async function loadBaseData(password: string) {
    const [typePayload, entryPayload] = await Promise.all([
      listFixedCostTypes(password),
      fetchFixedCostEntries({ start: filters.start, end: filters.end }, password),
    ]);
    setCostTypes(typePayload);
    setEntries(entryPayload);
  }

  useEffect(() => {
    authorizePage();
  }, []);

  useEffect(() => {
    if (!managerPassword) {
      return;
    }
    loadBaseData(managerPassword).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar custos fixos"));
  }, [managerPassword, filters.start, filters.end]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("washapp2.fixed-costs.filters", JSON.stringify(filters));
  }, [filters]);

  async function handleSaveType() {
    if (!managerPassword) {
      return;
    }
    setError(null);
    setMessage(null);
    if (!typeForm.trim()) {
      setError("Informe o nome do custo fixo.");
      return;
    }

    try {
      if (editingTypeId) {
        const updated = await updateFixedCostType(editingTypeId, { name: typeForm.trim() }, managerPassword);
        setCostTypes((current) => current.map((costType) => (costType.id === updated.id ? updated : costType)));
        setMessage("Tipo de custo fixo atualizado.");
      } else {
        const created = await createFixedCostType(typeForm.trim(), managerPassword);
        setCostTypes((current) => [created, ...current]);
        setMessage("Tipo de custo fixo cadastrado.");
      }
      setTypeForm("");
      setEditingTypeId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar tipo de custo fixo");
    }
  }

  async function handleDeleteType(costTypeId: number) {
    if (!managerPassword) {
      return;
    }
    try {
      await deleteFixedCostType(costTypeId, managerPassword);
      setCostTypes((current) => current.filter((costType) => costType.id !== costTypeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir tipo de custo fixo");
    }
  }

  async function handleSaveLaunches() {
    if (!managerPassword) {
      return;
    }
    setError(null);
    setMessage(null);

    const parsed = launches
      .filter((line) => line.costTypeId && line.amount)
      .map((line) => ({ costTypeId: Number(line.costTypeId), amount: Number(line.amount) }))
      .filter((line) => Number.isFinite(line.costTypeId) && Number.isFinite(line.amount));

    if (!parsed.length) {
      setError("Informe ao menos um lancamento valido.");
      return;
    }

    try {
      const saved = await saveFixedCostEntries(selectedDate, parsed, managerPassword);
      setEntries((current) => {
        const remaining = current.filter((entry) => entry.entryDate !== selectedDate);
        return [...saved, ...remaining].sort((left, right) => {
          if (left.entryDate === right.entryDate) {
            return left.costTypeName.localeCompare(right.costTypeName);
          }
          return left.entryDate < right.entryDate ? 1 : -1;
        });
      });
      setLaunches([{ costTypeId: "", amount: "" }]);
      setMessage("Lancamentos fixos salvos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar lancamentos");
    }
  }

  async function handleUpdateEntry(entryId: number, amount: number) {
    if (!managerPassword) {
      return;
    }
    try {
      const updated = await updateFixedCostEntry(entryId, amount, managerPassword);
      setEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setMessage("Lancamento atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar lancamento");
    }
  }

  async function handleDeleteEntry(entryId: number) {
    if (!managerPassword) {
      return;
    }
    try {
      await deleteFixedCostEntry(entryId, managerPassword);
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      setMessage("Lancamento removido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir lancamento");
    }
  }

  const selectedEntries = entries.filter((entry) => entry.entryDate === selectedDate);

  return (
    <AppLayout>
      {dialog}
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Custos Fixos</h1>
            <p className="text-sm text-muted-foreground">Cadastre tipos de custo fixo e lance os valores por dia, respeitando o mes vigente.</p>
          </div>
        </div>

        {message && <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
        {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-primary" /> Cadastro de Custos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipo de custo fixo</Label>
                <Input className="mt-1.5" value={typeForm} onChange={(event) => setTypeForm(event.target.value)} placeholder="Ex.: Aluguel, internet, plataforma" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setTypeForm("");
                  setEditingTypeId(null);
                }}>Cancelar</Button>
                <Button className="bg-gradient-primary shadow-glow" onClick={handleSaveType}>{editingTypeId ? "Salvar Alteracoes" : "Cadastrar Custo"}</Button>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/60">
                {costTypes.map((costType) => (
                  <div key={costType.id} className="flex items-center justify-between p-3 hover:bg-muted/40 transition-smooth">
                    <div>
                      <p className="text-sm font-semibold">{costType.name}</p>
                      <p className="text-xs text-muted-foreground">{costType.isActive ? "Ativo" : "Inativo"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setEditingTypeId(costType.id);
                        setTypeForm(costType.name);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteType(costType.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" /> Lancamentos por Dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Dia do custo</Label>
                <Input className="mt-1.5" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </div>
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                {launches.map((line, index) => (
                  <div key={`launch-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,180px,auto]">
                    <Select value={line.costTypeId} onValueChange={(value) => setLaunches((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, costTypeId: value } : item))}>
                      <SelectTrigger><SelectValue placeholder="Escolha o custo" /></SelectTrigger>
                      <SelectContent>
                        {activeTypes.map((costType) => <SelectItem key={costType.id} value={String(costType.id)}>{costType.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" step="0.01" placeholder="0,00" value={line.amount} onChange={(event) => setLaunches((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} />
                    <Button variant="outline" onClick={() => setLaunches((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))}>Remover</Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setLaunches((current) => [...current, { costTypeId: "", amount: "" }])}><Plus className="h-4 w-4" /> Linha</Button>
                  <Button className="bg-gradient-primary shadow-glow" onClick={handleSaveLaunches}><Save className="h-4 w-4" /> Salvar Todos</Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Lancamentos do dia</p>
                    <p className="text-xs text-muted-foreground">Total fixo: R$ {selectedEntries.reduce((sum, entry) => sum + entry.amount, 0).toFixed(2)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {selectedEntries.map((entry) => (
                    <FixedEntryRow key={entry.id} entry={entry} onSave={handleUpdateEntry} onDelete={handleDeleteEntry} />
                  ))}
                  {!selectedEntries.length && <p className="text-sm text-muted-foreground">Nenhum lancamento para esta data.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base"><Filter className="h-4 w-4 text-primary" /> Consulta de Despesas</CardTitle>
              <Button variant="outline" size="sm" onClick={() => void handleExport()}><Download className="h-4 w-4" /> Excel</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <Label>Data Inicial</Label>
                <Input type="date" className="mt-1.5" value={filters.start} onChange={(event) => setFilters((current) => ({ ...current, start: event.target.value }))} />
              </div>
              <div>
                <Label>Data Final</Label>
                <Input type="date" className="mt-1.5" value={filters.end} onChange={(event) => setFilters((current) => ({ ...current, end: event.target.value }))} />
              </div>
              <div className="md:col-span-2 flex items-end">
                <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 w-full">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Total filtrado</p>
                  <p className="text-xl font-bold tracking-tight">R$ {totalEntries.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                    <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Despesa</th>
                    <th className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="transition-smooth hover:bg-muted/40">
                      <td className="p-3 text-muted-foreground">{new Date(`${entry.entryDate}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 font-medium">{entry.costTypeName}</td>
                      <td className="p-3 text-right font-semibold">R$ {entry.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  {!entries.length && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">Nenhuma despesa fixa encontrada para o período selecionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function FixedEntryRow({ entry, onSave, onDelete }: { entry: FixedCostEntry; onSave: (entryId: number, amount: number) => Promise<void>; onDelete: (entryId: number) => Promise<void>; }) {
  const [amount, setAmount] = useState(String(entry.amount));
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 p-3 md:grid-cols-[1fr,140px,auto,auto] md:items-center">
      <div>
        <p className="text-sm font-semibold">{entry.costTypeName}</p>
        <p className="text-xs text-muted-foreground">{new Date(entry.entryDate).toLocaleDateString("pt-BR")}</p>
      </div>
      <Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Button variant="outline" onClick={() => onSave(entry.id, Number(amount))}>Salvar</Button>
      <Button variant="ghost" onClick={() => onDelete(entry.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}
