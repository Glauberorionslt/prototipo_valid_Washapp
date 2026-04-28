import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Shield, KeyRound, UserCog, Lock, Smartphone, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizeAdminOperational, fetchAdminWhatsappConfig, relinkAdminWhatsapp, setManagerPassword, updateAdminWhatsappConfig, updateManagerProfile } from "@/lib/api";
import { useManagerPasswordDialog } from "@/components/app/ManagerPasswordDialog";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/admin")({ component: Admin });

function mapWhatsappStatus(detail: string | null | undefined) {
  if (!detail) {
    return "Bridge indisponivel";
  }

  const normalized = detail.toLowerCase();
  if (normalized.includes("failed to establish a new connection") || normalized.includes("winerror 10061")) {
    return "Bridge do WhatsApp offline. Inicie o servico do bridge na porta 3100.";
  }

  if (normalized.includes("bridge not configured")) {
    return "Bridge do WhatsApp nao configurado.";
  }

  return detail;
}

function describeWhatsappState(config: {
  connected: boolean;
  registered: boolean;
  qr: string | null;
  detail: string | null;
}) {
  if (config.connected) {
    return "Bridge conectado e pronto para enviar mensagens.";
  }
  if (config.qr) {
    return "QR gerado. Escaneie com o WhatsApp do numero remetente.";
  }
  if (config.registered === false) {
    return "Bridge iniciado, aguardando autenticacao do WhatsApp.";
  }
  return mapWhatsappStatus(config.detail);
}

function Admin() {
  const { user } = useCurrentUser();
  const { askManagerPassword, dialog } = useManagerPasswordDialog();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [bridgeQr, setBridgeQr] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<string>("Carregando...");
  const [isRefreshingWhatsapp, setIsRefreshingWhatsapp] = useState(false);
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

  async function refreshWhatsappConfig(pollForQr = false) {
    setIsRefreshingWhatsapp(true);
    try {
      let config = await fetchAdminWhatsappConfig();

      if (pollForQr) {
        for (let attempt = 0; attempt < 6 && !config.qr && !config.connected; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          config = await fetchAdminWhatsappConfig();
        }
      }

      setSenderPhone(config.senderPhone ?? "");
      setBridgeQr(config.qr ?? null);
      setWhatsappStatus(describeWhatsappState(config));
    } catch (err) {
      setWhatsappStatus(err instanceof Error ? mapWhatsappStatus(err.message) : "Falha ao consultar bridge");
    } finally {
      setIsRefreshingWhatsapp(false);
    }
  }

  useEffect(() => {
    if (!accessGranted) {
      return;
    }
    refreshWhatsappConfig();
  }, [accessGranted]);

  useEffect(() => {
    let cancelled = false;

    async function buildQrImage() {
      if (!bridgeQr) {
        setQrImage(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(bridgeQr, { margin: 1, width: 280 });
        if (!cancelled) {
          setQrImage(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setQrImage(null);
        }
      }
    }

    buildQrImage();
    return () => {
      cancelled = true;
    };
  }, [bridgeQr]);

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

  async function handleSenderSave() {
    if (!accessGranted) {
      return;
    }
    setError(null);
    setMessage(null);
    const managerPassword = await askManagerPassword("salvar o numero remetente do WhatsApp");
    if (!managerPassword) {
      return;
    }

    try {
      const config = await updateAdminWhatsappConfig(senderPhone, managerPassword);
      setSenderPhone(config.senderPhone ?? "");
      setWhatsappStatus(describeWhatsappState(config));
      setMessage("Numero remetente do WhatsApp atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar numero remetente");
    }
  }

  async function handleGenerateQr() {
    if (!accessGranted) {
      return;
    }
    setError(null);
    setMessage(null);
    const managerPassword = await askManagerPassword("gerar um novo QR do WhatsApp");
    if (!managerPassword) {
      return;
    }

    try {
      await relinkAdminWhatsapp(managerPassword);
      await refreshWhatsappConfig(true);
      setMessage("Novo processo de vinculacao iniciado. Escaneie o QR exibido abaixo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar novo QR");
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
          <CardContent className="relative p-6 flex items-center gap-4">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-glow/30 blur-3xl" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur">
              <Shield className="h-6 w-6" />
            </div>
            <div className="relative">
              <p className="text-sm uppercase tracking-widest text-primary-foreground/80">Painel Restrito</p>
              <p className="text-xl font-semibold">Apenas o dono do estabelecimento</p>
              <p className="text-sm text-primary-foreground/80">{whatsappStatus}</p>
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
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Necessária para excluir ordens, alterar preços e enviar relatórios.
              </p>
              <p className="text-xs text-muted-foreground">
                {accessMethod === "access-key"
                  ? "Voce entrou com a chave de acesso. Defina uma nova senha gerencial para restaurar o fluxo normal desta area."
                  : "Neste prototipo, este cadastro tambem funciona como recuperacao da senha gerencial."}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4 text-primary" /> Remetente WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Numero atual remetente</Label>
                <Input
                  className="mt-1.5"
                  inputMode="numeric"
                  placeholder="11999999999"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value.replace(/\D/g, "").slice(0, 13))}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Este numero fica salvo no sistema como remetente atual do WhatsApp.
                </p>
              </div>
              <Button className="w-full bg-gradient-primary shadow-glow" onClick={handleSenderSave}>
                Salvar numero remetente
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4 text-primary" /> Vinculo do dispositivo WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Gere um novo QR por aqui quando precisar conectar ou reconectar o dispositivo remetente.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button className="bg-gradient-primary shadow-glow" onClick={handleGenerateQr}>
                  Gerar novo QR
                </Button>
                <Button variant="outline" onClick={() => refreshWhatsappConfig()} disabled={isRefreshingWhatsapp}>
                  {isRefreshingWhatsapp ? "Atualizando..." : "Atualizar status"}
                </Button>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-semibold">Status atual</p>
                <p className="text-xs text-muted-foreground">{whatsappStatus}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">QR de vinculacao</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {qrImage ? (
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-white p-3">
                  <img src={qrImage} alt="QR do WhatsApp" className="mx-auto h-auto w-full max-w-64" />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Nenhum QR disponivel no momento. Gere um novo QR para conectar o dispositivo.
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Escaneie este QR no WhatsApp do numero remetente em Dispositivos conectados.
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
              { t: "Enviar Relatório", d: "WhatsApp / Excel" },
              { t: "Alterar Preço", d: "Edição de produtos" },
            ].map((a) => (
              <div key={a.t} className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-semibold">{a.t}</p>
                <p className="text-xs text-muted-foreground">{a.d}</p>
              </div>
            ))}
          </CardContent>
        </Card>
          </>
        )}
        {dialog}
      </div>
    </AppLayout>
  );
}
