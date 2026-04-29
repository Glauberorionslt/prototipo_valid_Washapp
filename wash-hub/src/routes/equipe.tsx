import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Briefcase, Plus, Pencil, Trash2, CalendarDays, Save } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerPasswordDialog } from "@/components/app/ManagerPasswordDialog";
import {
  createTeamMember,
  deleteTeamEntry,
  deleteTeamMember,
  fetchTeamEntries,
  listTeamMembers,
  saveTeamEntries,
  updateTeamEntry,
  updateTeamMember,
  verifyManagerPassword,
  type TeamCostEntry,
  type TeamMember,
} from "@/lib/api";

export const Route = createFileRoute("/equipe")({ component: EquipePage });

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

type LaunchLine = {
  memberId: string;
  amount: string;
  tipAmount: string;
};

function currentDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function EquipePage() {
  const navigate = useNavigate();
  const { askManagerPassword, dialog } = useManagerPasswordDialog();
  const [managerPassword, setManagerPassword] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [entries, setEntries] = useState<TeamCostEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(currentDateInput());
  const [launches, setLaunches] = useState<LaunchLine[]>([{ memberId: "", amount: "", tipAmount: "" }]);
  const [memberForm, setMemberForm] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeMembers = useMemo(() => members.filter((member) => member.isActive), [members]);
  const totalAmountEntries = useMemo(() => entries.reduce((sum, entry) => sum + entry.amount, 0), [entries]);
  const totalTipEntries = useMemo(() => entries.reduce((sum, entry) => sum + entry.tipAmount, 0), [entries]);
  const totalEntries = useMemo(() => totalAmountEntries + totalTipEntries, [totalAmountEntries, totalTipEntries]);

  async function authorizePage() {
    const password = await askManagerPassword("acessar a area de equipe");
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
    const [memberPayload, entryPayload] = await Promise.all([
      listTeamMembers(password),
      fetchTeamEntries(selectedDate, password),
    ]);
    setMembers(memberPayload);
    setEntries(entryPayload);
  }

  useEffect(() => {
    authorizePage();
  }, []);

  useEffect(() => {
    if (!managerPassword) {
      return;
    }
    loadBaseData(managerPassword).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar equipe"));
  }, [managerPassword, selectedDate]);

  async function handleSaveMember() {
    if (!managerPassword) {
      return;
    }
    setError(null);
    setMessage(null);
    if (!memberForm.trim()) {
      setError("Informe o nome do membro da equipe.");
      return;
    }

    try {
      if (editingMemberId) {
        const updated = await updateTeamMember(editingMemberId, { name: memberForm.trim() }, managerPassword);
        setMembers((current) => current.map((member) => (member.id === updated.id ? updated : member)));
        setMessage("Membro atualizado.");
      } else {
        const created = await createTeamMember(memberForm.trim(), managerPassword);
        setMembers((current) => [created, ...current]);
        setMessage("Membro cadastrado.");
      }
      setMemberForm("");
      setEditingMemberId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar membro");
    }
  }

  async function handleDeleteMember(memberId: number) {
    if (!managerPassword) {
      return;
    }
    try {
      await deleteTeamMember(memberId, managerPassword);
      setMembers((current) => current.filter((member) => member.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir membro");
    }
  }

  async function handleSaveLaunches() {
    if (!managerPassword) {
      return;
    }
    setError(null);
    setMessage(null);

    const parsed = launches
      .filter((line) => line.memberId && (line.amount || line.tipAmount))
      .map((line) => ({ memberId: Number(line.memberId), amount: Number(line.amount || 0), tipAmount: Number(line.tipAmount || 0) }))
      .filter((line) => Number.isFinite(line.memberId) && Number.isFinite(line.amount) && Number.isFinite(line.tipAmount));

    if (!parsed.length) {
      setError("Informe ao menos um lancamento valido.");
      return;
    }

    try {
      const saved = await saveTeamEntries(selectedDate, parsed, managerPassword);
      setEntries(saved);
      setLaunches([{ memberId: "", amount: "", tipAmount: "" }]);
      setMessage("Lancamentos da equipe salvos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar lancamentos");
    }
  }

  async function handleUpdateEntry(entryId: number, amount: number, tipAmount: number) {
    if (!managerPassword) {
      return;
    }
    try {
      const updated = await updateTeamEntry(entryId, amount, tipAmount, managerPassword);
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
      await deleteTeamEntry(entryId, managerPassword);
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
            <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
            <p className="text-sm text-muted-foreground">Cadastre membros e lance o custo diario da equipe por data.</p>
          </div>
        </div>

        {message && <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
        {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4 text-primary" /> Cadastro da Equipe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do membro</Label>
                <Input className="mt-1.5" value={memberForm} onChange={(event) => setMemberForm(event.target.value)} placeholder="Ex.: João Silva" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setMemberForm("");
                  setEditingMemberId(null);
                }}>Cancelar</Button>
                <Button className="bg-gradient-primary shadow-glow" onClick={handleSaveMember}>{editingMemberId ? "Salvar Alteracoes" : "Cadastrar Membro"}</Button>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/60">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 hover:bg-muted/40 transition-smooth">
                    <div>
                      <p className="text-sm font-semibold">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.isActive ? "Ativo" : "Inativo"}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setEditingMemberId(member.id);
                        setMemberForm(member.name);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteMember(member.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
                  <div key={`launch-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,160px,160px,auto]">
                    <Select value={line.memberId} onValueChange={(value) => setLaunches((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, memberId: value } : item))}>
                      <SelectTrigger><SelectValue placeholder="Escolha um membro" /></SelectTrigger>
                      <SelectContent>
                        {activeMembers.map((member) => <SelectItem key={member.id} value={String(member.id)}>{member.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" step="0.01" placeholder="0,00" value={line.amount} onChange={(event) => setLaunches((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} />
                    <Input type="number" min="0" step="0.01" placeholder="Gorjeta" value={line.tipAmount} onChange={(event) => setLaunches((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, tipAmount: event.target.value } : item))} />
                    <Button variant="outline" onClick={() => setLaunches((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))}>Remover</Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setLaunches((current) => [...current, { memberId: "", amount: "", tipAmount: "" }])}><Plus className="h-4 w-4" /> Linha</Button>
                  <Button className="bg-gradient-primary shadow-glow" onClick={handleSaveLaunches}><Save className="h-4 w-4" /> Salvar Todos</Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Lancamentos do dia</p>
                    <p className="text-xs text-muted-foreground">Valor: {formatCurrency(totalAmountEntries)} • Gorjeta: {formatCurrency(totalTipEntries)} • Total geral: {formatCurrency(totalEntries)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <TeamEntryRow key={entry.id} entry={entry} onSave={handleUpdateEntry} onDelete={handleDeleteEntry} />
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

function TeamEntryRow({ entry, onSave, onDelete }: { entry: TeamCostEntry; onSave: (entryId: number, amount: number, tipAmount: number) => Promise<void>; onDelete: (entryId: number) => Promise<void>; }) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [tipAmount, setTipAmount] = useState(String(entry.tipAmount));
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 p-3 md:grid-cols-[1fr,120px,120px,auto,auto] md:items-center">
      <div>
        <p className="text-sm font-semibold">{entry.memberName}</p>
        <p className="text-xs text-muted-foreground">{new Date(entry.entryDate).toLocaleDateString("pt-BR")} • Total R$ {entry.totalAmount.toFixed(2)}</p>
      </div>
      <Input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Input type="number" min="0" step="0.01" value={tipAmount} onChange={(event) => setTipAmount(event.target.value)} />
      <Button variant="outline" onClick={() => onSave(entry.id, Number(amount || 0), Number(tipAmount || 0))}>Salvar</Button>
      <Button variant="ghost" onClick={() => onDelete(entry.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}