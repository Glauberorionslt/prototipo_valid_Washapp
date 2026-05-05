import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Shield, KeyRound, UserCog, Lock } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizeAdminOperational, setManagerPassword, updateManagerProfile } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/admin")({ component: Admin });

function Admin() {
  const { user } = useCurrentUser();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessMethod, setAccessMethod] = useState<string | null>(null);
  const [accessPassword, setAccessPassword] = useState("");
  const [accessKeyToken, setAccessKeyToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user?.name ?? "");
    setPhone(user?.phone ?? "");
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (user.isMaster || !user.managerPasswordConfigured) {
      setAccessGranted(true);
      setAccessMethod(user.isMaster ? "master" : "open");
      return;
    }
    setAccessGranted(false);
    setAccessMethod(null);
  }, [user]);

  async function handleProfileSave() {
    if (!accessGranted) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await updateManagerProfile({ fullName, phone });
      setMessage("Perfil gerencial atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar perfil");
    }
  }

  async function handlePasswordSave() {
    if (!accessGranted) {
      return;
    }
    setError(null);
    setMessage(null);
    if (password !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    try {
      await setManagerPassword(password);
      setPassword("");
      setConfirmPassword("");
      setMessage("Senha gerencial atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar senha");
    }
  }

  async function handleAuthorizeAccess() {
    setError(null);
    setMessage(null);
    try {
      const payload = accessPassword.trim()
        ? { managerPassword: accessPassword.trim() }
        : { accessKeyToken: accessKeyToken.trim() };
      const result = await authorizeAdminOperational(payload);
      setAccessGranted(true);
      setAccessMethod(result.method);
      setAccessPassword("");
      setAccessKeyToken("");
      if (result.method === "access-key") {
        setMessage("Acesso liberado com a chave. Aproveite para redefinir sua senha gerencial abaixo.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao validar acesso ao admin operacional");
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Operacional</h1>
            <p className="text-sm text-muted-foreground">Configurações da gerência e segurança.</p>
          </div>
        </div>

        <Card className="border-border/60 shadow-elegant overflow-hidden bg-gradient-hero text-primary-foreground">
          <CardContent className="relative flex items-center gap-4 p-6">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-glow/30 blur-3xl" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur">
              <Shield className="h-6 w-6" />
            </div>
            <div className="relative">
              <p className="text-sm uppercase tracking-widest text-primary-foreground/80">Painel Restrito</p>
              <p className="text-xl font-semibold">Apenas o dono do estabelecimento</p>
              <p className="text-sm text-primary-foreground/80">Perfil gerencial e segurança operacional.</p>
            </div>
          </CardContent>
        </Card>

        {message && <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
        {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        {!accessGranted && (
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-primary" /> Acesso ao Admin Operacional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enquanto a senha gerencial nao existir, esta tela segue livre. Depois do cadastro da senha, o acesso passa a exigir a senha gerencial. Em caso de esquecimento, use a chave de acesso do usuario apenas para entrar nesta tela e redefinir a senha.
              </p>
              <div>
                <Label>Senha gerencial</Label>
                <Input className="mt-1.5" type="password" placeholder="••••••••" value={accessPassword} onChange={(event) => setAccessPassword(event.target.value)} />
              </div>
              <div>
                <Label>Ou chave de acesso</Label>
                <Input className="mt-1.5 font-mono" placeholder="Informe a chave vinculada ao usuario" value={accessKeyToken} onChange={(event) => setAccessKeyToken(event.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button className="bg-gradient-primary shadow-glow" onClick={handleAuthorizeAccess} disabled={!accessPassword.trim() && !accessKeyToken.trim()}>
                  Liberar acesso
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {accessGranted && (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="border-border/60 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserCog className="h-4 w-4 text-primary" /> Gerente Responsável
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nome</Label>
                    <Input className="mt-1.5" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Contato</Label>
                    <Input className="mt-1.5" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))} />
                  </div>
                  <Button className="w-full bg-gradient-primary shadow-glow" onClick={handleProfileSave}>Salvar</Button>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="h-4 w-4 text-primary" /> Senha Gerencial
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nova Senha</Label>
                    <Input className="mt-1.5" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div>
                    <Label>Confirmar Senha</Label>
                    <Input className="mt-1.5" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                  <Button className="w-full bg-gradient-primary shadow-glow" onClick={handlePasswordSave}>Atualizar Senha</Button>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> Necessária para excluir ordens, alterar preços e exportar relatórios.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {accessMethod === "access-key"
                      ? "Voce entrou com a chave de acesso. Defina uma nova senha gerencial para restaurar o fluxo normal desta area."
                      : "Neste prototipo, este cadastro tambem funciona como recuperacao da senha gerencial."}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Ações que exigem senha gerencial</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { t: "Excluir Ordem", d: "Remoção definitiva de O.L." },
                  { t: "Exportar Relatório", d: "Excel" },
                  { t: "Alterar Preço", d: "Edição de produtos" },
                ].map((action) => (
                  <div key={action.t} className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <p className="text-sm font-semibold">{action.t}</p>
                    <p className="text-xs text-muted-foreground">{action.d}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
