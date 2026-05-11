import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Save,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOrder, listCustomers, listProducts, reserveNextOrderId, type Customer, type PlateReaderScan, type Product } from "@/lib/api";

export const Route = createFileRoute("/nova-ordem")({ component: NovaOrdem });

type OcrWorker = {
  recognize: (image: Blob | File, options?: Record<string, unknown>) => Promise<{ data: { text: string } }>;
  setParameters: (params: Record<string, string | number>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

type OcrLoggerMessage = {
  status?: string;
  progress?: number;
};

const PLATE_MASKS = ["LLLDDDD", "LLLDLDD"] as const;

const LETTER_FIXES: Record<string, string> = {
  "0": "O",
  "1": "I",
  "2": "Z",
  "4": "A",
  "5": "S",
  "6": "G",
  "7": "T",
  "8": "B",
};

const DIGIT_FIXES: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  B: "8",
  G: "6",
  T: "7",
  A: "4",
};

function coercePlateByMask(value: string, mask: (typeof PLATE_MASKS)[number]) {
  if (value.length !== mask.length) {
    return null;
  }

  let normalized = "";
  for (let index = 0; index < mask.length; index += 1) {
    const character = value[index];
    const expected = mask[index];

    if (expected === "L") {
      if (/[A-Z]/.test(character)) {
        normalized += character;
        continue;
      }
      if (LETTER_FIXES[character]) {
        normalized += LETTER_FIXES[character];
        continue;
      }
      return null;
    }

    if (/\d/.test(character)) {
      normalized += character;
      continue;
    }
    if (DIGIT_FIXES[character]) {
      normalized += DIGIT_FIXES[character];
      continue;
    }
    return null;
  }

  return normalized;
}

function extractPlateFromOcrText(text: string) {
  const normalizedText = text.toUpperCase();
  const tokenSet = new Set<string>();
  const tokens = normalizedText.split(/[^A-Z0-9]+/).filter(Boolean);
  const compact = normalizedText.replace(/[^A-Z0-9]/g, "");

  for (const token of [...tokens, compact]) {
    if (token.length < 7) {
      continue;
    }
    for (let index = 0; index <= token.length - 7; index += 1) {
      tokenSet.add(token.slice(index, index + 7));
    }
  }

  const candidates = [...tokenSet];
  const exact = candidates.find((candidate) => /^[A-Z]{3}\d{4}$/.test(candidate) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(candidate));
  if (exact) {
    return exact;
  }

  for (const candidate of candidates) {
    for (const mask of PLATE_MASKS) {
      const coerced = coercePlateByMask(candidate, mask);
      if (coerced) {
        return coerced;
      }
    }
  }

  return null;
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Nao foi possivel abrir a imagem para leitura da placa."));
    };
    image.src = imageUrl;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Nao foi possivel preparar a imagem para OCR."));
    }, "image/png");
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function buildPlateOcrTargets(file: File) {
  const image = await loadImageFromFile(file);
  const crops = [
    { left: 0, top: 0, width: 1, height: 1, scale: 1, threshold: false },
    { left: 0, top: 0, width: 1, height: 1, scale: 1.6 },
    { left: 0.12, top: 0.45, width: 0.76, height: 0.24, scale: 2.4 },
    { left: 0.18, top: 0.55, width: 0.64, height: 0.18, scale: 2.8 },
    { left: 0.2, top: 0.48, width: 0.6, height: 0.16, scale: 3.2 },
  ];

  const blobs: Array<{ blob: Blob; mode: "strict" | "fallback" }> = [];
  for (const crop of crops) {
    const sourceX = Math.round(image.width * crop.left);
    const sourceY = Math.round(image.height * crop.top);
    const sourceWidth = Math.max(1, Math.round(image.width * crop.width));
    const sourceHeight = Math.max(1, Math.round(image.height * crop.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(64, Math.round(sourceWidth * crop.scale));
    canvas.height = Math.max(32, Math.round(sourceHeight * crop.scale));
    const context = canvas.getContext("2d");
    if (!context) {
      continue;
    }

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    if (crop.threshold !== false) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      for (let index = 0; index < pixels.length; index += 4) {
        const grayscale = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
        const boosted = grayscale > 150 ? 255 : 0;
        pixels[index] = boosted;
        pixels[index + 1] = boosted;
        pixels[index + 2] = boosted;
      }
      context.putImageData(imageData, 0, 0);
    }
    blobs.push({ blob: await canvasToBlob(canvas), mode: crop.threshold === false ? "fallback" : "strict" });
  }

  return blobs;
}

function NovaOrdem() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ocrWorkerRef = useRef<OcrWorker | null>(null);
  const ocrWorkerPromiseRef = useRef<Promise<OcrWorker> | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [washTypes, setWashTypes] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("0");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedWashTypeId, setSelectedWashTypeId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [items, setItems] = useState<{ id: number; name: string; price: number; qty: number }[]>([]);
  const [reservedOrderId, setReservedOrderId] = useState<number | null>(null);
  const [scanResult, setScanResult] = useState<PlateReaderScan | null>(null);
  const [scanDecisionOpen, setScanDecisionOpen] = useState(false);
  const [isScanningPlate, setIsScanningPlate] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomers().then(setCustomers).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar clientes"));
    listProducts(undefined, "addon").then(setProducts).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar produtos"));
    listProducts(undefined, "wash_type").then(setWashTypes).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar tipos de lavagem"));
  }, []);

  useEffect(() => {
    if (!washTypes.length) {
      setSelectedWashTypeId("");
      return;
    }
    setSelectedWashTypeId((current) => current && washTypes.some((item) => String(item.id) === current) ? current : String(washTypes[0].id));
  }, [washTypes]);

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
    setReservedOrderId(null);
    setCustomerName(selectedCustomer.name);
    setPhone(selectedCustomer.phone ?? "");
    setVehicle(selectedCustomer.vehicle ?? "");
    setPlate(selectedCustomer.plate ?? "");
    setColor(selectedCustomer.color ?? "");
    setCustomerSearch(selectedCustomer.plate ? `${selectedCustomer.name} • ${selectedCustomer.plate}` : selectedCustomer.name);
  }, [selectedCustomer]);

  useEffect(() => {
    return () => {
      const worker = ocrWorkerRef.current;
      ocrWorkerRef.current = null;
      ocrWorkerPromiseRef.current = null;
      if (worker) {
        void worker.terminate();
      }
    };
  }, []);

  function resetCustomerForm() {
    setSelectedCustomerId("0");
    setCustomerSearch("");
    setCustomerName("");
    setPhone("");
    setVehicle("");
    setPlate("");
    setColor("");
    setReservedOrderId(null);
  }

  function applyGuestPreset(nextOrderId: number, recognizedPlate: string) {
    setSelectedCustomerId("0");
    setCustomerSearch(`nome avulso (${nextOrderId})`);
    setCustomerName(`cliente avulso (${nextOrderId})`);
    setPhone("00000000000");
    setVehicle(`veiculo avulso (${nextOrderId})`);
    setPlate(recognizedPlate);
    setColor(`cor avulso (${nextOrderId})`);
    setReservedOrderId(nextOrderId);
  }

  function sanitizePhone(value: string) {
    return value.replace(/\D/g, "").slice(0, 11);
  }

  function sanitizePlate(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  async function getOcrWorker() {
    if (ocrWorkerRef.current) {
      return ocrWorkerRef.current;
    }
    if (ocrWorkerPromiseRef.current) {
      return ocrWorkerPromiseRef.current;
    }

    ocrWorkerPromiseRef.current = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = (await createWorker("eng", 1, {
        logger: (event: OcrLoggerMessage) => {
          if (event.status === "recognizing text" && typeof event.progress === "number") {
            setScanStatus(`Lendo placa... ${Math.round(event.progress * 100)}%`);
            return;
          }
          if (event.status) {
            setScanStatus(`Lendo placa... ${event.status}`);
          }
        },
      })) as OcrWorker;
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
      ocrWorkerRef.current = worker;
      return worker;
    })();

    try {
      return await ocrWorkerPromiseRef.current;
    } finally {
      ocrWorkerPromiseRef.current = null;
    }
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
    if (!selectedWashType) {
      return "Cadastre e selecione um tipo de lavagem.";
    }
    return null;
  }

  const selectedWashType = useMemo(
    () => washTypes.find((product) => String(product.id) === selectedWashTypeId) ?? null,
    [washTypes, selectedWashTypeId],
  );
  const baseValue = selectedWashType?.price ?? 0;
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

  async function handleScanPlate(file: File) {
    setMessage(null);
    setError(null);
    setIsScanningPlate(true);
    setScanStatus("Preparando leitura...");

    try {
      const worker = await withTimeout(getOcrWorker(), 20000, "A inicializacao do leitor demorou demais. Tente novamente.");
      const targets = await withTimeout(buildPlateOcrTargets(file), 10000, "A preparacao da imagem demorou demais. Tente uma foto menor.");
      const recognizedTexts: string[] = [];
      for (const [index, target] of targets.entries()) {
        setScanStatus(`Lendo placa... etapa ${index + 1} de ${targets.length}`);
        if (target.mode === "strict") {
          await worker.setParameters({ tessedit_pageseg_mode: 8 });
        } else {
          await worker.setParameters({ tessedit_pageseg_mode: 11 });
        }
        const { data } = await withTimeout(
          worker.recognize(target.blob),
          15000,
          "A leitura da placa demorou demais. Tente uma foto mais proxima e com menos fundo.",
        );
        recognizedTexts.push(data.text);
      }

      const recognizedPlate = recognizedTexts
        .map((text) => extractPlateFromOcrText(text))
        .find((value): value is string => Boolean(value));

      if (!recognizedPlate) {
        throw new Error("Nao foi possivel identificar uma placa valida na imagem. Tente fotografar a placa mais de perto e com menos fundo.");
      }

      const customer = customers.find((entry) => sanitizePlate(entry.plate ?? "") === recognizedPlate) ?? null;
      let reservedId: number | null = null;
      if (!customer) {
        const reservation = await reserveNextOrderId();
        reservedId = reservation.reservedOrderId;
      }

      const result: PlateReaderScan = {
        plate: recognizedPlate,
        confidence: null,
        customer,
        reservedOrderId: reservedId,
      };

      setPlate(result.plate);
      setScanResult(result);

      if (result.customer) {
        setCustomers((current) => {
          const exists = current.some((customer) => customer.id === result.customer?.id);
          if (exists) {
            return current.map((customer) => (customer.id === result.customer?.id ? result.customer : customer));
          }
          return [...current, result.customer].sort((left, right) => left.name.localeCompare(right.name));
        });
        setSelectedCustomerId(String(result.customer.id));
        setScanDecisionOpen(false);
        setMessage(`Placa ${result.plate} lida com sucesso. Cadastro encontrado automaticamente.`);
        return;
      }

      resetCustomerForm();
      setPlate(result.plate);
      setScanDecisionOpen(true);
    } catch (err) {
      const worker = ocrWorkerRef.current;
      ocrWorkerRef.current = null;
      ocrWorkerPromiseRef.current = null;
      if (worker) {
        void worker.terminate();
      }
      setError(err instanceof Error ? err.message : "Falha ao ler a placa");
    } finally {
      setIsScanningPlate(false);
      setScanStatus(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function startManualEntryFromScan() {
    if (!scanResult) {
      return;
    }
    resetCustomerForm();
    setPlate(scanResult.plate);
    setScanDecisionOpen(false);
    setMessage(`Placa ${scanResult.plate} identificada. Complete os demais dados manualmente.`);
  }

  function startGuestEntryFromScan() {
    if (!scanResult?.reservedOrderId) {
      setError("Nao foi possivel preparar a ordem avulsa a partir da leitura da placa.");
      return;
    }
    applyGuestPreset(scanResult.reservedOrderId, scanResult.plate);
    setScanDecisionOpen(false);
    setMessage(`Placa ${scanResult.plate} identificada. Ordem avulsa preparada com o numero ${scanResult.reservedOrderId}.`);
  }

  async function handleCreateOrder() {
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
        reservedOrderId,
        washType: selectedWashType?.name ?? "",
        basePrice: baseValue,
        total,
        items: items.map((item) => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.qty,
        })),
      });
      setMessage("Ordem criada com sucesso.");
      resetCustomerForm();
      setSelectedProductId("");
      setItems([]);
      setScanResult(null);
      setSelectedWashTypeId(washTypes[0] ? String(washTypes[0].id) : "");
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
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleScanPlate(file);
                }
              }}
            />
            <Button variant="outline" disabled>
              <Camera className="h-4 w-4" /> Leitor suspenso temporariamente
            </Button>
          </>
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
                  <p className="mt-2 text-xs text-muted-foreground">A leitura automatica de placa esta suspensa temporariamente. Preencha a placa manualmente neste cadastro.</p>
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
                    <Select value={selectedWashTypeId} onValueChange={setSelectedWashTypeId}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {washTypes.map((washType) => (
                          <SelectItem key={washType.id} value={String(washType.id)}>{washType.name} — R$ {washType.price.toFixed(2)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!washTypes.length && <p className="mt-2 text-xs text-muted-foreground">Cadastre tipos de lavagem na tela de produtos.</p>}
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
                {isScanningPlate && scanStatus && <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{scanStatus}</p>}
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
              <Button className="w-full bg-gradient-primary shadow-glow hover:opacity-95" size="lg" onClick={handleCreateOrder}>
                <Save className="h-4 w-4" /> Salvar Ordem
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link to="/">Cancelar</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={scanDecisionOpen} onOpenChange={setScanDecisionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Placa lida sem cadastro anterior</DialogTitle>
            <DialogDescription>
              A placa {scanResult?.plate ? `“${scanResult.plate}”` : ""} foi reconhecida, mas nao existe cliente cadastrado com ela. Escolha como deseja seguir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>1. Continuar cadastro manual: mantem a placa lida e voce preenche nome, telefone, veiculo e cor.</p>
            <p>2. Ordem avulsa automatica: preenche nome, telefone, veiculo e cor com dados avulsos vinculados ao numero da nova ordem.</p>
            {scanResult?.reservedOrderId && (
              <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-foreground">
                Numero previsto da ordem: {scanResult.reservedOrderId}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={startManualEntryFromScan}>Continuar manualmente</Button>
            <Button className="bg-gradient-primary shadow-glow" onClick={startGuestEntryFromScan}>Cadastrar ordem avulsa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
