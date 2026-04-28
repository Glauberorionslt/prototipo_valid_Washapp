import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function useManagerPasswordDialog() {
  const resolverRef = useRef<((value: string | null) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [actionLabel, setActionLabel] = useState("");

  function closeDialog(result: string | null) {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    setPassword("");
    resolver?.(result);
  }

  function askManagerPassword(label: string) {
    setActionLabel(label);
    setPassword("");
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }

  const dialog = (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDialog(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Senha gerencial</DialogTitle>
          <DialogDescription>
            Informe a senha gerencial para {actionLabel}. Esta senha e independente da senha de login.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmedPassword = password.trim();
            if (!trimmedPassword) {
              return;
            }
            closeDialog(trimmedPassword);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="manager-password">Senha</Label>
            <Input
              id="manager-password"
              type="password"
              placeholder="••••••••"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeDialog(null)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-gradient-primary shadow-glow" disabled={!password.trim()}>
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { askManagerPassword, dialog };
}