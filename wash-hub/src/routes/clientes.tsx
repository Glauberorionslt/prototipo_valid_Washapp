import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Search, Plus, Pencil, Trash2, Users } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
  type Customer,
} from "@/lib/api";

export const Route = createFileRoute("/clientes")({ component: Clientes });

function Clientes() {
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", plate: "", vehicle: "", color: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function syncCustomers(next: Customer[]) {
    setCustomers(next.filter((customer) => !customer.isDefault));
  }

  function sanitizePhone(value: string) {
    return value.replace(/\D/g, "").slice(0, 11);
  }

  function sanitizePlate(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  function validateCustomerForm() {
    if (!form.name.trim()) {
      return "Informe o nome do cliente.";
    }
    if (!form.phone.trim()) {
      return "Informe o telefone do cliente.";
    }
    if (sanitizePhone(form.phone).length < 10) {
      return "Telefone deve conter apenas numeros validos.";
    }
    if (!form.vehicle.trim()) {
      return "Informe o veiculo.";
    }
    if (!form.plate.trim()) {
      return "Informe a placa.";
    }
    if (!form.color.trim()) {
      return "Informe a cor.";
    }
    return null;
  }

  useEffect(() => {
    listCustomers(q)
      .then(syncCustomers)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar clientes"));
  }, [q]);

  const filtered = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(q.toLowerCase()) ||
      (customer.plate ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  async function handleSave() {
    setError(null);
    setMessage(null);
    const validationError = validateCustomerForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const payload = {
        name: form.name,
        phone: sanitizePhone(form.phone),
        plate: sanitizePlate(form.plate),
        vehicle: form.vehicle,
        color: form.color,
      };

      if (editingId) {
        const updated = await updateCustomer(editingId, payload);
        syncCustomers(customers.map((customer) => (customer.id === updated.id ? updated : customer)));
        setMessage("Cliente atualizado.");
      } else {
        const created = await createCustomer(payload);
        syncCustomers([created, ...customers]);
        setMessage("Cliente cadastrado.");
      }

      setForm({ name: "", phone: "", plate: "", vehicle: "", color: "" });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar cliente");
    }
  }

  async function handleDelete(customerId: number) {
    try {
      await deleteCustomer(customerId);
      syncCustomers(customers.filter((customer) => customer.id !== customerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir cliente");
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground">Gerencie sua base de clientes.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4 text-primary" /> Novo Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nome</Label>
                <Input className="mt-1.5" placeholder="Nome completo" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input className="mt-1.5" placeholder="11999990000" inputMode="numeric" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: sanitizePhone(e.target.value) }))} />
              </div>
              <div>
                <Label>Placa</Label>
                <Input className="mt-1.5" placeholder="ABC1D23" value={form.plate} onChange={(e) => setForm((current) => ({ ...current, plate: sanitizePlate(e.target.value) }))} />
              </div>
              <div>
                <Label>Veículo</Label>
                <Input className="mt-1.5" placeholder="Honda Civic" value={form.vehicle} onChange={(e) => setForm((current) => ({ ...current, vehicle: e.target.value }))} />
              </div>
              <div>
                <Label>Cor</Label>
                <Input className="mt-1.5" placeholder="Prata" value={form.color} onChange={(e) => setForm((current) => ({ ...current, color: e.target.value }))} />
              </div>
              {message && <p className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
              {error && <p className="md:col-span-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => {
                  setForm({ name: "", phone: "", plate: "", vehicle: "", color: "" });
                  setEditingId(null);
                }}>Cancelar</Button>
                <Button className="bg-gradient-primary shadow-glow" onClick={handleSave}>
                  {editingId ? "Salvar Alteracoes" : "Salvar Cliente"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" /> Clientes Cadastrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome ou placa..."
                  className="pl-9"
                />
              </div>
              <div className="max-h-[480px] overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/60">
                {filtered.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/40 transition-smooth">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-sm font-semibold">
                        {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.vehicle} • {c.plate} • {c.color}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setEditingId(c.id);
                        setForm({
                          name: c.name,
                          phone: sanitizePhone(c.phone ?? ""),
                          plate: sanitizePlate(c.plate ?? ""),
                          vehicle: c.vehicle ?? "",
                          color: c.color ?? "",
                        });
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
