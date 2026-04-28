import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ReceiptText, Plus, Pencil, Trash2, CalendarDays, Save } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerPasswordDialog } from "@/components/app/ManagerPasswordDialog";
import {
  createOperationalCostType,
  deleteOperationalCostEntry,
  deleteOperationalCostType,
  fetchOperationalCostEntries,
  listOperationalCostTypes,
  saveOperationalCostEntries,
  updateOperationalCostEntry,
  updateOperationalCostType,
  verifyManagerPassword,
  type OperationalCostEntry,
  type OperationalCostType,
} from "@/lib/api";

export const Route = createFileRoute("/custos-operacionais")({ component: CustosOperacionaisPage });

type LaunchLine = {
  costTypeId: string;
  amount: string;
};

function currentDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function CustosOperacionaisPage() {
  const navigate = useNavigate();
  const { askManagerPassword, dialog } = useManagerPasswordDialog();
  const [managerPassword, setManagerPassword] = useState<string | null>(null);
  const [costTypes, setCostTypes] = useState<OperationalCostType[]>([]);
  const [entries, setEntries] = useState<OperationalCostEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(currentDateInput());
  const [launches, setLaunches] = useState<LaunchLine[]>([{ costTypeId: "", amount: "" }]);
  const [typeForm, setTypeForm] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTypes = useMemo(() => costTypes.filter((costType) => costType.isActive), [costTypes]);
  const totalEntries = useMemo(() => entries.reduce((sum, entry) => sum + entry.amount, 0), [entries]);

  async function authorizePage() {
    const password = await askManagerPassword("acessar a area de custos operacionais");
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
      listOperationalCostTypes(password),
      fetchOperationalCostEntries(selectedDate, password),
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
    loadBaseData(managerPassword).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar custos operacionais"));
  }, [managerPassword, selectedDate]);

  async function handleSaveType() {
    if (!managerPassword) {
      return;
    }
    setError(null);
    setMessage(null);
    if (!typeForm.trim()) {
      setError("Informe o nome do custo operacional.");
      return;
    }

    try {
      if (editingTypeId) {
        const updated = await updateOperationalCostType(editingTypeId, { name: typeForm.trim() }, managerPassword);
        setCostTypes((current) => current.map((costType) => (costType.id === updated.id ? updated : costType)));
        setMessage("Tipo de custo atualizado.");
      } else {
        const created = await createOperationalCostType(typeForm.trim(), managerPassword);
        setCostTypes((current) => [created, ...current]);
        setMessage("Tipo de custo cadastrado.");
      }
      setTypeForm("");
      setEditingTypeId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar tipo de custo");
    }
  }

  async function handleDeleteType(costTypeId: number) {
    if (!managerPassword) {
      return;
    }
    try {
      await deleteOperationalCostType(costTypeId, managerPassword);
      setCostTypes((current) => current.filter((costType) => costType.id !== costTypeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir tipo de custo");
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
      const saved = await saveOperationalCostEntries(selectedDate, parsed, managerPassword);
      setEntries(saved);
      setLaunches([{ costTypeId: "", amount: "" }]);
      setMessage("Lancamentos operacionais salvos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar lancamentos");
    }
  }

  async function handleUpdateEntry(entryId: number, amount: number) {
    if (!managerPassword) {
      return;
    }
    try {
      const updated = await updateOperationalCostEntry(entryId, amount, managerPassword);
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
      await deleteOperationalCostEntry(entryId, managerPassword);
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      setMessage("Lancamento removido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir lancamento");
    }
  }

  return (
    <AppLayout>
      {dialog}
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Custos Operacionais</h1>
            <p className="text-sm text-muted-foreground">Cadastre tipos de custo e lance os valores por dia.</p>
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
                <Label>Tipo de custo</Label>
                <Input className="mt-1.5" value={typeForm} onChange={(event) => setTypeForm(event.target.value)} placeholder="Ex.: Produto quimico, energia, terceirizado" />
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
                    <p className="text-xs text-muted-foreground">Total operacional: R$ {totalEntries.toFixed(2)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <OperationalEntryRow key={entry.id} entry={entry} onSave={handleUpdateEntry} onDelete={handleDeleteEntry} />
                  ))}
                  {!entries.length && <p className="text-sm text-muted-foreground">Nenhum lancamento para esta data.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function OperationalEntryRow({ entry, onSave, onDelete }: { entry: OperationalCostEntry; onSave: (entryId: number, amount: number) => Promise<void>; onDelete: (entryId: number) => Promise<void>; }) {
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