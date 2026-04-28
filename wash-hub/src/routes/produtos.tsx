import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Search, Plus, Pencil, Trash2, Package } from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type Product,
} from "@/lib/api";
import { useManagerPasswordDialog } from "@/components/app/ManagerPasswordDialog";

export const Route = createFileRoute("/produtos")({ component: Produtos });

function Produtos() {
  const { askManagerPassword, dialog } = useManagerPasswordDialog();
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: "", price: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProducts(q)
      .then(setProducts)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar produtos"));
  }, [q]);

  const filtered = products.filter((product) => product.name.toLowerCase().includes(q.toLowerCase()));

  async function handleSave() {
    setError(null);
    setMessage(null);

    try {
      const price = Number(form.price);
      if (Number.isNaN(price)) {
        throw new Error("Informe um preco valido.");
      }

      if (editingId) {
        const managerPassword = await askManagerPassword("alterar produto");
        if (!managerPassword) {
          return;
        }
        const updated = await updateProduct(editingId, { name: form.name, price }, managerPassword);
        setProducts(products.map((product) => (product.id === updated.id ? updated : product)));
        setMessage("Produto atualizado.");
      } else {
        const created = await createProduct({ name: form.name, price });
        setProducts([created, ...products]);
        setMessage("Produto cadastrado.");
      }

      setForm({ name: "", price: "" });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar produto");
    }
  }

  async function handleDelete(productId: number) {
    const managerPassword = await askManagerPassword("excluir produto");
    if (!managerPassword) {
      return;
    }

    try {
      await deleteProduct(productId, managerPassword);
      setProducts(products.filter((product) => product.id !== productId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir produto");
    }
  }

  return (
    <AppLayout>
      {dialog}
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Produtos & Serviços</h1>
            <p className="text-sm text-muted-foreground">Cadastre seus serviços e preços.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4 text-primary" /> Novo Produto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input className="mt-1.5" placeholder="Cera Premium" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input className="mt-1.5" placeholder="0,00" type="number" value={form.price} onChange={(e) => setForm((current) => ({ ...current, price: e.target.value }))} />
              </div>
              {message && <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
              {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => {
                  setForm({ name: "", price: "" });
                  setEditingId(null);
                }}>Cancelar</Button>
                <Button className="bg-gradient-primary shadow-glow" onClick={handleSave}>
                  {editingId ? "Salvar Alteracoes" : "Salvar Produto"}
                </Button>
              </div>
              <div className="rounded-lg border border-border/60 bg-accent/30 p-3 text-xs text-accent-foreground">
                🔒 Alterar ou excluir preço requer senha gerencial.
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-primary" /> Catálogo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
              </div>
              <div className="max-h-[480px] overflow-y-auto divide-y divide-border/60 rounded-lg border border-border/60">
                {filtered.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 hover:bg-muted/40 transition-smooth">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">R$ {p.price.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setEditingId(p.id);
                        setForm({ name: p.name, price: String(p.price) });
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
