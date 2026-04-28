import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Droplets, KeyRound, LogIn, Mail, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { activateKey, login, recoverPassword, register } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [keyToken, setKeyToken] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [recoverMode, setRecoverMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (recoverMode) {
        if (password !== confirmPassword) {
          setError("As senhas informadas nao conferem.");
          return;
        }
        if (!keyToken.trim()) {
          setError("Informe a chave de acesso vinculada ao usuario.");
          return;
        }
        await recoverPassword({ email, accessKeyToken: keyToken.trim(), password });
        setRecoverMode(false);
        setPassword("");
        setConfirmPassword("");
        setKeyToken("");
        setMessage("Senha redefinida com sucesso. Agora faca login com a nova senha.");
        return;
      }

      if (createAccount) {
        if (password !== confirmPassword) {
          setError("As senhas informadas nao conferem.");
          return;
        }
        await register({ email, password, full_name: email.split("@")[0] });
        setCreateAccount(false);
        setPassword("");
        setConfirmPassword("");
        setMessage("Conta criada. Agora faca login para continuar.");
        return;
      }

      const result = await login({ email, password });
      setAccessToken(result.access_token);

      if (result.needs_key) {
        if (!keyToken.trim()) {
          setMessage("Login validado. Informe a chave/token para ativar o primeiro acesso.");
          return;
        }
        await activateKey(keyToken.trim());
      }

      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary-glow/40 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />

      <Card className="relative w-full max-w-md glass border-white/30 shadow-elegant">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
              <Droplets className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Wash App</h1>
            <p className="text-sm text-muted-foreground">
              {recoverMode ? "Redefina sua senha usando a chave de acesso vinculada ao usuario" : createAccount ? "Crie sua conta para iniciar o prototipo" : "Entre na sua conta operacional"}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Senha</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            {(createAccount || recoverMode) && (
              <div>
                <Label>Confirmar Senha</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
            )}
            <div>
              <Label className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> {recoverMode ? "Chave de acesso vinculada" : "Chave/Token (primeiro acesso)"}
              </Label>
              <Input className="mt-1.5 font-mono" placeholder="WASH-XXXX-XXXX-XXXX" value={keyToken} onChange={(e) => setKeyToken(e.target.value)} />
            </div>

            {!recoverMode && (
              <div className="flex items-center gap-3 pt-1">
              <Checkbox id="have" checked={!createAccount} onCheckedChange={(checked) => setCreateAccount(!checked)} />
              <label htmlFor="have" className="text-sm">Já possuo cadastro</label>
              </div>
            )}

            {message && <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
            {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <Button className="w-full bg-gradient-primary shadow-glow" size="lg" onClick={handleSubmit} disabled={loading}>
              <LogIn className="h-4 w-4" /> {loading ? "Processando..." : recoverMode ? "Redefinir Senha" : createAccount ? "Criar Conta" : "Entrar"}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button className="text-primary hover:underline" onClick={() => {
                setRecoverMode(false);
                setCreateAccount((value) => !value);
                setMessage(null);
                setError(null);
              }}> 
                {createAccount ? "Voltar ao Login" : "Criar Conta"}
              </button>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => {
                setCreateAccount(false);
                setRecoverMode((value) => !value);
                setMessage(null);
                setError(null);
              }}>{recoverMode ? "Voltar ao Login" : "Esqueci a senha"}</button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
