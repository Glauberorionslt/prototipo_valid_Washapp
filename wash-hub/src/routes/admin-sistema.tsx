import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Download, KeyRound, Plus, Shield, Trash2, UserCog } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type AdminSystemRow,
  createAccessKey,
  createSystemUser,
  deleteSystemUser,
  exportSystemAccessKeys,
  listAdminSystemRows,
  toggleCompanyContractStatus,
  toggleAccessKey,
  toggleSystemUserStatus,
  type AdminUser,
  updateSystemUser,
} from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/admin-sistema")({ component: AdminSistema });

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("pt-BR");
}

function matchesStatusFilter(value: string | null | undefined, filter: string) {
  if (filter === "all") {
    return true;
  }
  return value === filter;
}

function renderStatusBadge(status: string | null | undefined, labels?: { active?: string; inactive?: string; empty?: string }) {
  if (status === "active") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">{labels?.active ?? "Ativo"}</Badge>;
  }
  if (status === "inactive") {
    return <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">{labels?.inactive ?? "Inativo"}</Badge>;
  }
  return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">{labels?.empty ?? "Sem vinculo"}</Badge>;
}

function getRowDisplayName(row: AdminSystemRow) {
  if (row.rowType === "user") {
    return row.fullName || row.email || "Usuario sem nome";
  }
  return row.keyLabel || "Chave avulsa";
}

function isRowFullyActive(row: AdminSystemRow) {
  return row.contractStatus === "active"
    && row.userStatus === "active"
    && (row.accessKeyId === null || row.accessKeyStatus === "active");
}

function AdminSistema() {
  const navigate = useNavigate();
  const { user, loading } = useCurrentUser();
  const [rows, setRows] = useState<AdminSystemRow[]>([]);
  const [userForm, setUserForm] = useState({
    email: "",
    fullName: "",
    companyName: "",
    phone: "",
    password: "",
    isMaster: false,
  });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [keyForm, setKeyForm] = useState({ label: "", keyToken: "" });
  const [filterTerm, setFilterTerm] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [keyStatusFilter, setKeyStatusFilter] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [isUnifiedListOpen, setIsUnifiedListOpen] = useState(true);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const editingUser = editingUserId === null ? null : rows.find((item) => item.userId === editingUserId && item.rowType === "user") ?? null;
  const inactiveContractsCount = new Set(
    rows
      .filter((item) => item.rowType === "user")
      .filter((item) => item.companyId !== null && item.contractStatus === "inactive")
      .map((item) => item.companyId),
  ).size;
  const inactiveUsersCount = rows.filter((item) => item.rowType === "user" && item.userStatus === "inactive").length;
  const inactiveKeysCount = rows.filter((item) => item.accessKeyStatus === "inactive").length;

  useEffect(() => {
    if (!loading && user && !user.isMaster) {
      navigate({ to: "/" });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user?.isMaster) {
      return;
    }

    listAdminSystemRows()
      .then((nextRows) => {
        setRows(nextRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar dados do admin sistema"));
  }, [user?.isMaster]);

  function resetUserForm() {
    setUserForm({ email: "", fullName: "", companyName: "", phone: "", password: "", isMaster: false });
    setEditingUserId(null);
  }

  async function reloadSystemData() {
    const nextRows = await listAdminSystemRows();
    setRows(nextRows);
  }

  async function handleSaveUser() {
    setError(null);
    setMessage(null);

    if (!userForm.email.trim()) {
      setError("Informe o email do usuario.");
      return;
    }

    if (!userForm.fullName.trim()) {
      setError("Informe o nome do usuario.");
      return;
    }

    if (!userForm.companyName.trim()) {
      setError("Informe o nome da empresa do usuario.");
      return;
    }

    if (!userForm.phone.trim()) {
      setError("Informe o telefone do usuario.");
      return;
    }

    if (!editingUserId && !userForm.password.trim()) {
      setError("Informe a senha inicial do usuario.");
      return;
    }

    setSavingUser(true);
    try {
      if (editingUserId) {
        const updated = await updateSystemUser(editingUserId, {
          fullName: userForm.fullName || undefined,
          companyName: userForm.companyName || undefined,
          phone: userForm.phone || undefined,
          password: userForm.password || undefined,
          isMaster: userForm.isMaster,
        });
        await reloadSystemData();
        setMessage("Usuario atualizado.");
      } else {
        await createSystemUser({
          email: userForm.email.trim(),
          fullName: userForm.fullName || undefined,
          companyName: userForm.companyName.trim(),
          phone: userForm.phone || undefined,
          password: userForm.password,
          isMaster: userForm.isMaster,
        });
        await reloadSystemData();
        setMessage("Usuario criado.");
      }
      resetUserForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar usuario");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeleteUser(userId: number) {
    setError(null);
    setMessage(null);
    try {
      await deleteSystemUser(userId);
      await reloadSystemData();
      if (editingUserId === userId) {
        resetUserForm();
      }
      setMessage("Usuario removido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir usuario");
    }
  }

  async function handleToggleMaster(target: AdminSystemRow) {
    if (target.userId === null) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await updateSystemUser(target.userId, { isMaster: !target.isMaster });
      await reloadSystemData();
      setMessage("Perfil de acesso atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar o perfil do usuario");
    }
  }

  async function handleToggleUserStatus(target: AdminSystemRow) {
    if (target.userId === null) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await toggleSystemUserStatus(target.userId);
      await reloadSystemData();
      setMessage("Status do usuario atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar o status do usuario");
    }
  }

  async function handleToggleContractStatus(target: AdminSystemRow) {
    if (target.companyId == null) {
      setError("Usuario sem empresa vinculada.");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await toggleCompanyContractStatus(target.companyId);
      await reloadSystemData();
      setMessage("Status do contrato atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar o status do contrato");
    }
  }

  async function handleCreateKey() {
    setError(null);
    setMessage(null);
    setSavingKey(true);
    try {
      await createAccessKey({
        label: keyForm.label || undefined,
        keyToken: keyForm.keyToken || undefined,
      });
      await reloadSystemData();
      setKeyForm({ label: "", keyToken: "" });
      setMessage("Chave criada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar chave");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleExportKeys() {
    setError(null);
    setMessage(null);
    try {
      const blob = await exportSystemAccessKeys();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `licencas-acesso-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setMessage("Exportacao das licencas iniciada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar licencas");
    }
  }

  async function handleToggleKey(row: AdminSystemRow) {
    if (row.accessKeyId === null) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await toggleAccessKey(row.accessKeyId);
      await reloadSystemData();
      setMessage("Status da chave atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar o status da chave");
    }
  }

  async function handleToggleAll(row: AdminSystemRow) {
    if (row.rowType !== "user" || row.userId === null) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      if (isRowFullyActive(row)) {
        if (row.accessKeyId !== null && row.accessKeyStatus === "active") {
          await toggleAccessKey(row.accessKeyId);
        }
        if (row.userStatus === "active") {
          await toggleSystemUserStatus(row.userId);
        }
        if (row.companyId !== null && row.contractStatus === "active") {
          await toggleCompanyContractStatus(row.companyId);
        }
      } else {
        if (row.companyId !== null && row.contractStatus !== "active") {
          await toggleCompanyContractStatus(row.companyId);
        }
        if (row.userStatus !== "active") {
          await toggleSystemUserStatus(row.userId);
        }
        if (row.accessKeyId !== null && row.accessKeyStatus !== "active") {
          await toggleAccessKey(row.accessKeyId);
        }
      }
      await reloadSystemData();
      setMessage("Status gerais da linha atualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar os status da linha");
    }
  }

  const filteredRows = useMemo(() => {
    const query = filterTerm.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesText = !query || [
        item.contractCode,
        item.companyName,
        item.fullName,
        item.email,
        item.keyToken,
        item.keyLabel,
        item.phone,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));

      return matchesText
        && matchesStatusFilter(item.contractStatus, contractStatusFilter)
        && matchesStatusFilter(item.userStatus, userStatusFilter)
        && matchesStatusFilter(item.accessKeyStatus, keyStatusFilter);
    });
  }, [rows, filterTerm, contractStatusFilter, userStatusFilter, keyStatusFilter]);

  const userRows = rows.filter((item) => item.rowType === "user");
  const orphanKeyRows = rows.filter((item) => item.rowType !== "user");

  function toggleRowOpen(rowId: string, nextOpen: boolean) {
    setOpenRows((current) => ({ ...current, [rowId]: nextOpen }));
  }

  if (loading || !user) {
    return null;
  }

  if (!user.isMaster) {
    return null;
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Sistema</h1>
            <p className="text-sm text-muted-foreground">Gestao de usuarios mestres, operadores e licencas de acesso.</p>
          </div>
        </div>

        <Card className="border-border/60 shadow-elegant overflow-hidden bg-gradient-hero text-primary-foreground">
          <CardContent className="relative flex items-center gap-4 p-6">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-glow/30 blur-3xl" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur">
              <Shield className="h-6 w-6" />
            </div>
            <div className="relative">
              <p className="text-sm uppercase tracking-widest text-primary-foreground/80">Acesso Master</p>
              <p className="text-xl font-semibold">Controle central do SaaS</p>
              <p className="text-sm text-primary-foreground/80">Usuarios cadastrados: {userRows.length} • Chaves cadastradas: {rows.filter((item) => item.accessKeyId !== null).length} • Chaves avulsas: {orphanKeyRows.length}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="border-white/20 bg-white/15 text-primary-foreground hover:bg-white/15">
                  Contratos inativos: {inactiveContractsCount}
                </Badge>
                <Badge className="border-white/20 bg-white/15 text-primary-foreground hover:bg-white/15">
                  Usuarios inativos: {inactiveUsersCount}
                </Badge>
                <Badge className="border-white/20 bg-white/15 text-primary-foreground hover:bg-white/15">
                  Chaves inativas: {inactiveKeysCount}
                </Badge>
              </div>
            </div>
            <div className="relative ml-auto">
              <Button variant="secondary" onClick={() => void reloadSystemData()}>Atualizar dados</Button>
            </div>
          </CardContent>
        </Card>

        {message && <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
        {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Buscar por contrato</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 pt-0 md:grid-cols-2 xl:grid-cols-[1.15fr,0.85fr,0.85fr,0.85fr] xl:items-end">
              <div className="md:col-span-2 xl:col-span-1">
                <Label>Busca geral</Label>
                <Input
                  className="mt-1.5"
                  placeholder="Contrato, empresa, email, usuario ou chave"
                  value={filterTerm}
                  onChange={(event) => setFilterTerm(event.target.value)}
                />
              </div>
              <div>
                <Label>Status contrato</Label>
                <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status usuario</Label>
                <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status chave</Label>
                <Select value={keyStatusFilter} onValueChange={setKeyStatusFilter}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 xl:col-span-4 flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <span>Linhas encontradas: {filteredRows.length}</span>
                <span>Usuarios: {userRows.length} • Chaves avulsas: {orphanKeyRows.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCog className="h-4 w-4 text-primary" /> {editingUserId ? "Editar usuario" : "Novo usuario"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Email *</Label>
                <Input className="mt-1.5" required value={userForm.email} disabled={editingUserId !== null} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input className="mt-1.5" required value={userForm.fullName} onChange={(event) => setUserForm((current) => ({ ...current, fullName: event.target.value }))} />
              </div>
              <div>
                <Label>Empresa *</Label>
                <Input className="mt-1.5" required value={userForm.companyName} onChange={(event) => setUserForm((current) => ({ ...current, companyName: event.target.value }))} />
              </div>
              <div>
                <Label>Telefone *</Label>
                <Input className="mt-1.5" required inputMode="numeric" value={userForm.phone} onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "").slice(0, 11) }))} />
              </div>
              <div>
                <Label>{editingUserId ? "Nova senha (opcional)" : "Senha inicial *"}</Label>
                <Input className="mt-1.5" type="password" required={editingUserId === null} value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} />
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={userForm.isMaster}
                  disabled={Boolean(editingUser && editingUser.userStatus !== "active" && !userForm.isMaster)}
                  onChange={(event) => setUserForm((current) => ({ ...current, isMaster: event.target.checked }))}
                />
                Conceder acesso master
              </label>
              {editingUser && editingUser.userStatus !== "active" && !userForm.isMaster ? (
                <p className="text-xs text-muted-foreground">Reative o usuario antes de conceder acesso master.</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetUserForm}>Cancelar</Button>
                <Button className="bg-gradient-primary shadow-glow" onClick={handleSaveUser} disabled={savingUser}>
                  <Plus className="h-4 w-4" /> {savingUser ? "Salvando..." : editingUserId ? "Salvar alteracoes" : "Criar usuario"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Collapsible open={isUnifiedListOpen} onOpenChange={setIsUnifiedListOpen}>
          <Card className="border-border/60 shadow-soft">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CollapsibleTrigger asChild>
                  <button className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-left transition-smooth hover:bg-muted/40 md:flex-1">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <UserCog className="h-4 w-4 text-primary" /> Visao Unificada de Usuarios e Licencas
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {filteredRows.length} linhas filtradas prontas para consulta rapida.
                      </p>
                    </div>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isUnifiedListOpen ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <Button variant="outline" onClick={() => void handleExportKeys()}>
                  <Download className="h-4 w-4" /> Exportar Excel
                </Button>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {filteredRows.map((item) => {
                  const open = Boolean(openRows[item.rowId]);
                  return (
                    <Collapsible key={item.rowId} open={open} onOpenChange={(nextOpen) => toggleRowOpen(item.rowId, nextOpen)}>
                      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
                        <CollapsibleTrigger asChild>
                          <button className="flex w-full items-center justify-between gap-4 p-4 text-left transition-smooth hover:bg-muted/40">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">{getRowDisplayName(item)}</p>
                                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">{item.rowType === "user" ? "Usuario" : "Chave avulsa"}</Badge>
                                {item.isMaster ? <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Master</Badge> : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.email || item.keyToken || "Sem email ou chave"}
                                {item.companyName ? ` • ${item.companyName}` : ""}
                                {item.contractCode ? ` • ${item.contractCode}` : ""}
                              </p>
                            </div>
                            <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
                              {renderStatusBadge(item.accessKeyStatus, { active: "Chave ativa", inactive: "Chave inativa", empty: "Sem chave" })}
                              {renderStatusBadge(item.userStatus, { active: "Usuario ativo", inactive: "Usuario inativo", empty: "Sem usuario" })}
                              {renderStatusBadge(item.contractStatus, { active: "Contrato ativo", inactive: "Contrato inativo", empty: "Sem contrato" })}
                            </div>
                            <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t border-border/60 bg-muted/20 p-4">
                            <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Empresa</p>
                                  <p className="text-sm font-medium text-foreground">{item.companyName || "Sem empresa"}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Contrato</p>
                                  <p className="text-sm font-medium text-foreground">{item.contractCode || "Sem contrato"}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</p>
                                  <p className="text-sm font-medium text-foreground">{item.phone || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Rotulo da chave</p>
                                  <p className="text-sm font-medium text-foreground">{item.keyLabel || "Sem rotulo"}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Chave</p>
                                  <p className="break-all font-mono text-sm text-foreground">{item.keyToken || "Sem chave"}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Criado em</p>
                                  <p className="text-sm font-medium text-foreground">{formatDate(item.createdAt)}</p>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  {renderStatusBadge(item.accessKeyStatus, { active: "Chave ativa", inactive: "Chave inativa", empty: "Sem chave" })}
                                  {renderStatusBadge(item.userStatus, { active: "Usuario ativo", inactive: "Usuario inativo", empty: "Sem usuario" })}
                                  {renderStatusBadge(item.contractStatus, { active: "Contrato ativo", inactive: "Contrato inativo", empty: "Sem contrato" })}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {item.rowType === "user" && item.userId !== null ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingUserId(item.userId);
                                          setUserForm({
                                            email: item.email || "",
                                            fullName: item.fullName || "",
                                            companyName: item.companyName || "",
                                            phone: item.phone || "",
                                            password: "",
                                            isMaster: item.isMaster,
                                          });
                                        }}
                                      >
                                        Editar usuario
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={() => void handleToggleAll(item)}>
                                        {isRowFullyActive(item) ? "Desligar tudo" : "Ligar tudo"}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void handleToggleUserStatus(item)}
                                        disabled={item.userStatus !== "active" && item.contractStatus !== "active"}
                                        title={item.userStatus !== "active" && item.contractStatus !== "active" ? "Ative o contrato antes de liberar o usuario" : undefined}
                                      >
                                        {item.userStatus === "active" ? "Inativar usuario" : "Ativar usuario"}
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={() => void handleToggleContractStatus(item)}>
                                        {item.contractStatus === "active" ? "Suspender contrato" : "Reativar contrato"}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void handleToggleMaster(item)}
                                        disabled={!item.isMaster && item.userStatus !== "active"}
                                        title={!item.isMaster && item.userStatus !== "active" ? "Ative o usuario antes de conceder acesso master" : undefined}
                                      >
                                        {item.isMaster ? "Remover master" : "Tornar master"}
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => void handleDeleteUser(item.userId)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </>
                                  ) : null}
                                  {item.accessKeyId !== null ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => void handleToggleKey(item)}
                                      disabled={item.accessKeyStatus !== "active" && item.contractStatus === "inactive"}
                                      title={item.accessKeyStatus !== "active" && item.contractStatus === "inactive" ? "Ative o contrato antes de reativar a chave" : undefined}
                                    >
                                      {item.accessKeyStatus === "active" ? "Desativar chave" : "Ativar chave"}
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr,1.1fr]">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" /> Nova Licenca
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Rotulo</Label>
                <Input className="mt-1.5" placeholder="Ex.: Cliente piloto" value={keyForm.label} onChange={(event) => setKeyForm((current) => ({ ...current, label: event.target.value }))} />
              </div>
              <div>
                <Label>Token manual (opcional)</Label>
                <Input className="mt-1.5 font-mono" placeholder="Se vazio, o sistema gera automaticamente" value={keyForm.keyToken} onChange={(event) => setKeyForm((current) => ({ ...current, keyToken: event.target.value }))} />
              </div>
              <div className="flex justify-end">
                <Button className="bg-gradient-primary shadow-glow" onClick={handleCreateKey} disabled={savingKey}>
                  <Plus className="h-4 w-4" /> {savingKey ? "Criando..." : "Criar chave"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" /> Observacao sobre Licencas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>A lista unica acima ja consolida usuario, empresa, contrato e chave. Quando um novo usuario ainda nao tem chave vinculada, ele aparece com empresa e contrato corretos e com o status da chave como "Sem chave".</p>
              <p>As chaves criadas sem usuario vinculado continuam visiveis na mesma lista como "Chave avulsa".</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}