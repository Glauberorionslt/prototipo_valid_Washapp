import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, type OrderStatus } from "@/components/app/StatusBadge";
import { deleteOrder, getOrder, updateOrder, type Order } from "@/lib/api";
import { clearSelectedOrderId, getSelectedOrderId } from "@/lib/selected-order";
import { useManagerPasswordDialog } from "@/components/app/ManagerPasswordDialog";

export const Route = createFileRoute("/ordens")({ component: Ordens });

function Ordens() {
  const navigate = useNavigate();
  const { askManagerPassword, dialog } = useManagerPasswordDialog();
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<OrderStatus>("aguardando");
  const [form, setForm] = useState({ customerName: "", phone: "", vehicle: "", plate: "", color: "", total: "0" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const selectedOrderId = getSelectedOrderId();
    if (!selectedOrderId) {
      navigate({ to: "/" });
      return;
    }

    getOrder(selectedOrderId)
      .then((selectedOrder) => {
        setOrder(selectedOrder);
        if (selectedOrder) {
          setStatus(selectedOrder.status as OrderStatus);
          setForm({
            customerName: selectedOrder.customerName,
            phone: selectedOrder.phone ?? "",
            vehicle: selectedOrder.vehicle ?? "",
            plate: selectedOrder.plate ?? "",
            color: selectedOrder.color ?? "",
            total: selectedOrder.total.toFixed(2),
          });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar ordem"));
  }, [navigate]);

  if (!order && !error) {
    return (
      <AppLayout>
        <div className="py-16 text-center text-muted-foreground">Carregando ordem...</div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout>
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Nenhuma ordem encontrada."}
        </div>
      </AppLayout>
    );
  }

  async function handleSave() {
    try {
      const updated = await updateOrder(order.id, {
        customerName: form.customerName,
        phone: form.phone,
        vehicle: form.vehicle,
        plate: form.plate,
        color: form.color,
        total: Number(form.total),
        status,
      });
      setOrder(updated);
      setMessage("Ordem atualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar ordem");
    }
  }

  async function handleDelete() {
    const managerPassword = await askManagerPassword("excluir ordem");
    if (!managerPassword) {
      return;
    }

    try {
      await deleteOrder(order.id, managerPassword);
      clearSelectedOrderId();
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir ordem");
    }
  }

  return (
    <AppLayout>
      {dialog}
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Ordem #{order.id}</h1>
            <p className="text-sm text-muted-foreground">Visualize e atualize o status da O.L.</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><Label>Cliente</Label><Input className="mt-1.5" value={form.customerName} onChange={(e) => setForm((current) => ({ ...current, customerName: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input className="mt-1.5" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} /></div>
            <div><Label>Veículo</Label><Input className="mt-1.5" value={form.vehicle} onChange={(e) => setForm((current) => ({ ...current, vehicle: e.target.value }))} /></div>
            <div><Label>Placa</Label><Input className="mt-1.5" value={form.plate} onChange={(e) => setForm((current) => ({ ...current, plate: e.target.value }))} /></div>
            <div><Label>Cor</Label><Input className="mt-1.5" value={form.color} onChange={(e) => setForm((current) => ({ ...current, color: e.target.value }))} /></div>
            <div><Label>Valor (R$)</Label><Input className="mt-1.5" value={form.total} onChange={(e) => setForm((current) => ({ ...current, total: e.target.value }))} /></div>
            <div className="md:col-span-2">
              <Label>Atualizar Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="em_lavagem">Em Lavagem</SelectItem>
                  <SelectItem value="pronto">Pronto</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {message && <p className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
            {error && <p className="md:col-span-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleDelete}><Trash2 className="h-4 w-4" /> Excluir</Button>
          <Button className="bg-gradient-primary shadow-glow" onClick={handleSave}><Save className="h-4 w-4" /> Salvar Alterações</Button>
        </div>
      </div>
    </AppLayout>
  );
}
