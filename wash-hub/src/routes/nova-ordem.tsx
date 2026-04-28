import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  User,
  Car as CarIcon,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOrder, listCustomers, listProducts, type Customer, type Product } from "@/lib/api";

export const Route = createFileRoute("/nova-ordem")({ component: NovaOrdem });

function NovaOrdem() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("0");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [washType, setWashType] = useState("completa");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [items, setItems] = useState<{ id: number; name: string; price: number; qty: number }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomers().then(setCustomers).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar clientes"));
    listProducts().then(setProducts).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar produtos"));
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => String(customer.id) === selectedCustomerId),
    [customers, selectedCustomerId],
  );

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) {
      return customers;
    }

    return customers.filter((customer) => {
      const name = customer.name.toLowerCase();
      const plateValue = (customer.plate ?? "").toLowerCase();
      return name.includes(query) || plateValue.includes(query);
    });
  }, [customerSearch, customers]);

  const customerSuggestions = useMemo(() => {
    const query = customerSearch.trim();
    if (!query) {
      return [];
    }
    return filteredCustomers.slice(0, 6);
  }, [customerSearch, filteredCustomers]);

  useEffect(() => {
    if (!selectedCustomer) {
      return;
    }
    setCustomerName(selectedCustomer.name);
    setPhone(selectedCustomer.phone ?? "");
    setVehicle(selectedCustomer.vehicle ?? "");
    setPlate(selectedCustomer.plate ?? "");
    setColor(selectedCustomer.color ?? "");
    setCustomerSearch(selectedCustomer.plate ? `${selectedCustomer.name} • ${selectedCustomer.plate}` : selectedCustomer.name);
  }, [selectedCustomer]);

  function sanitizePhone(value: string) {
    return value.replace(/\D/g, "").slice(0, 11);
  }

  function sanitizePlate(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  function validateOrderForm() {
    if (!customerName.trim()) {
      return "Informe o nome do cliente.";
    }
    if (!phone.trim()) {
      return "Informe o telefone do cliente.";
    }
    if (sanitizePhone(phone).length < 10) {
      return "O telefone deve conter apenas numeros validos.";
    }
    if (!vehicle.trim()) {
      return "Informe o veiculo.";
    }
    if (!plate.trim()) {
      return "Informe a placa do veiculo.";
    }
    if (!color.trim()) {
      return "Informe a cor do veiculo.";
    }
    return null;
  }

  const baseValue = washType === "simples" ? 35 : 65;
  const total = baseValue + items.reduce((s, i) => s + i.price * i.qty, 0);

  function addSelectedProduct() {
    const product = products.find((entry) => String(entry.id) === selectedProductId);
    if (!product) {
      return;
    }
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [...current, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
    setSelectedProductId("");
  }

  async function handleCreateOrder(sendWhatsapp: boolean) {
    setMessage(null);
    setError(null);
    const validationError = validateOrderForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      await createOrder({
        customerId: selectedCustomer ? selectedCustomer.id : null,
        customerName,
        phone: sanitizePhone(phone),
        vehicle,
        plate: sanitizePlate(plate),
        color,
        washType,
        basePrice: baseValue,
        total,
        sendWhatsapp,
        items: items.map((item) => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.qty,
        })),
      });
      setMessage(sendWhatsapp ? "Ordem criada e notificacao solicitada." : "Ordem criada com sucesso.");
      setSelectedCustomerId("0");
      setCustomerSearch("");
      setSelectedProductId("");
      setCustomerName("");
      setPhone("");
      setVehicle("");
      setPlate("");
      setColor("");
      setItems([]);
      setWashType("completa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar ordem");
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Nova Ordem de Lavagem</h1>
              <p className="text-sm text-muted-foreground">Preencha os dados do veículo e serviços.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-primary" /> Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Buscar cliente por nome ou placa</Label>
                  <Input
                    className="mt-1.5"
                    placeholder="Digite nome ou placa para pesquisar..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      if (!e.target.value.trim()) {
                        setSelectedCustomerId("0");
                      }
                    }}
                  />
                  {customerSuggestions.length > 0 && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
                      {customerSuggestions.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-smooth hover:bg-muted/40"
                          onClick={() => setSelectedCustomerId(String(customer.id))}
                        >
                          <span className="font-medium text-foreground">{customer.name}</span>
                          <span className="text-xs text-muted-foreground">{customer.plate || "Sem placa"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {customerSearch.trim() && customerSuggestions.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">Nenhum cliente encontrado para essa busca.</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <Label>Selecionar Cliente</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Cliente avulso</SelectItem>
                      {filteredCustomers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name} {c.plate ? `• ${c.plate}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome</Label>
                  <Input className="mt-1.5" placeholder="Nome do cliente" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    className="mt-1.5"
                    placeholder="11999990000"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CarIcon className="h-4 w-4 text-primary" /> Veículo
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>Veículo</Label>
                  <Input className="mt-1.5" placeholder="Honda Civic" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
                </div>
                <div>
                  <Label>Placa</Label>
                  <Input className="mt-1.5" placeholder="ABC1D23" value={plate} onChange={(e) => setPlate(sanitizePlate(e.target.value))} />
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input className="mt-1.5" placeholder="Prata" value={color} onChange={(e) => setColor(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Serviços e Produtos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label>Tipo de Lavagem</Label>
                    <Select value={washType} onValueChange={setWashType}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simples">Lavagem Simples — R$ 35,00</SelectItem>
                        <SelectItem value="completa">Lavagem Completa — R$ 65,00</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Adicionar Produto/Serviço</Label>
                    <div className="mt-1.5 flex gap-2">
                      <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name} — R$ {p.price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={addSelectedProduct}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Itens adicionados
                  </p>
                  <ul className="space-y-2">
                    {items.map((it, idx) => (
                      <li key={idx} className="flex items-center justify-between rounded-lg bg-card px-3 py-2 shadow-sm">
                        <div>
                          <p className="text-sm font-medium">{it.name}</p>
                          <p className="text-xs text-muted-foreground">R$ {it.price.toFixed(2)} × {it.qty}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">R$ {(it.price * it.qty).toFixed(2)}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {message && <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
                {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/60 shadow-elegant overflow-hidden bg-gradient-hero text-primary-foreground">
              <CardContent className="relative p-6">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-glow/30 blur-3xl" />
                <p className="relative text-sm uppercase tracking-widest text-primary-foreground/80">Total</p>
                <p className="relative mt-2 text-4xl font-bold tracking-tight">R$ {total.toFixed(2)}</p>
                <div className="relative mt-4 space-y-1.5 text-sm text-primary-foreground/85">
                  <div className="flex justify-between"><span>Lavagem base</span><span>R$ {baseValue.toFixed(2)}</span></div>
                  {items.map((it, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{it.name} ×{it.qty}</span>
                      <span>R$ {(it.price * it.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button className="w-full bg-gradient-primary shadow-glow hover:opacity-95" size="lg" onClick={() => handleCreateOrder(false)}>
                <Save className="h-4 w-4" /> Salvar Ordem
              </Button>
              <Button variant="outline" className="w-full" size="lg" onClick={() => handleCreateOrder(true)}>
                <Send className="h-4 w-4" /> Avisar Cliente (WhatsApp)
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link to="/">Cancelar</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
