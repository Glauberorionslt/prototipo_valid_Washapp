# Wash App — Documentação Técnica do Front-end

> Documento gerado a partir do **protótipo atual** (sem back-end, dados em JSON).
> Stack: **React 19 + TanStack Start/Router + Tailwind CSS v4 + shadcn/ui (new-york) + lucide-react**.
> Tema visual: **Ocean Detailing** (azul/turquesa, glassmorphism, gradientes oklch).

---

## 1. Visão Geral

O Wash App é um protótipo de painel SaaS para gestão de lava-rápido. Esta versão é **somente front-end**: nenhuma ação persiste, todas as listas, KPIs e formulários são alimentados por `src/data/mock.json`. O objetivo é validar fluxo de telas, hierarquia visual e linguagem de UI antes da implementação do back-end.

### Características principais
- Roteamento file-based (TanStack Router), com tipos gerados automaticamente.
- Layout com **sidebar fixa** (desktop), **header sticky** com busca, sino de notificações e perfil.
- **Sistema de status** colorido por O.L. (Aguardando, Em Lavagem, Pronto, Entregue).
- Componentes shadcn/ui sem alteração estrutural (apenas tokens reescritos).
- Sem autenticação real: `/login` é decorativo e simplesmente leva para `/`.

---

## 2. Sistema de Design

### 2.1 Tokens de cor (oklch)
Definidos em `src/styles.css` (`:root` e `.dark`).

| Token | Uso |
|---|---|
| `--background` / `--foreground` | Fundo geral e texto principal |
| `--card` / `--card-foreground` | Superfícies elevadas |
| `--primary` / `--primary-foreground` | Azul-petróleo principal |
| `--primary-glow` | Turquesa para halos/gradientes |
| `--accent` | Verde-água sutil |
| `--muted` / `--muted-foreground` | Áreas neutras e textos secundários |
| `--destructive` | Ações destrutivas (excluir) |
| `--border` / `--input` / `--ring` | Bordas e foco |

### 2.2 Cores de status
| Token | Significado |
|---|---|
| `--status-waiting` / `--status-waiting-bg` | **Aguardando** (vermelho) |
| `--status-washing` / `--status-washing-bg` | **Em Lavagem** (laranja) |
| `--status-ready` / `--status-ready-bg` | **Pronto** (verde) |
| `--status-delivered` / `--status-delivered-bg` | **Entregue** (azul) |

Cada par tem versão sólida (texto/ponto) e versão com 10% de opacidade (background do badge/card).

### 2.3 Gradientes e sombras
- `--gradient-primary` — botão principal e avatares.
- `--gradient-hero` — hero do dashboard, card de total da Nova Ordem, header do Admin e card de faturamento.
- `--gradient-surface` — fundo do app (`AppLayout`).
- `--shadow-elegant`, `--shadow-glow`, `--shadow-soft` — três níveis de elevação.

### 2.4 Utilities customizadas
Definidas em `@layer utilities`:
- `.glass` — vidro claro com blur 16px.
- `.glass-dark` — vidro escuro 20px (sidebar).
- `.bg-gradient-primary`, `.bg-gradient-hero`, `.bg-gradient-surface`.
- `.shadow-elegant`, `.shadow-glow`, `.shadow-soft`.
- `.transition-smooth` — `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`.

### 2.5 Tipografia, raio e ícones
- Fontes herdadas do default do Tailwind (sem font customizada).
- Raio base: `--radius: 0.875rem` → escala `sm/md/lg/xl/2xl/3xl/4xl`.
- Ícones: **lucide-react** (size 4 padrão nos botões, via classe `[&_svg]:size-4`).

---

## 3. Mapa de Rotas

Todas em `src/routes/`. Registro automático em `routeTree.gen.ts` (não editado manualmente).

| Path | Arquivo | Tela | Layout |
|---|---|---|---|
| `/` | `index.tsx` | Dashboard | `AppLayout` |
| `/login` | `login.tsx` | Login | Standalone (sem sidebar) |
| `/nova-ordem` | `nova-ordem.tsx` | Nova Ordem de Lavagem | `AppLayout` |
| `/ordens` | `ordens.tsx` | Detalhe de Ordem | `AppLayout` |
| `/clientes` | `clientes.tsx` | CRUD Clientes | `AppLayout` |
| `/produtos` | `produtos.tsx` | CRUD Produtos | `AppLayout` |
| `/financeiro` | `financeiro.tsx` | Financeiro Operacional | `AppLayout` |
| `/admin` | `admin.tsx` | Admin Operacional | `AppLayout` |
| `*` (não encontrado) | `__root.tsx` → `NotFoundComponent` | 404 | Standalone |

**Root** (`src/routes/__root.tsx`): define meta tags (title, description, og:*), injeta `styles.css`, monta o shell HTML (`<html><head><body>`) e expõe `<Outlet />`. Inclui `notFoundComponent` global.

**Router** (`src/router.tsx`): expõe `getRouter()` com `scrollRestoration` ativo e um `defaultErrorComponent` global (mostra mensagem amigável + botão **Try again**/**Go home**, e o erro bruto em DEV).

---

## 4. Mock de Dados (`src/data/mock.json`)

Estrutura única, importada diretamente por cada tela.

| Chave | Conteúdo | Usada por |
|---|---|---|
| `currentUser` | `name`, `role`, `shop`, `plan` | `AppLayout` (header/sidebar), Dashboard (saudação) |
| `stats` | `totalToday`, `waiting`, `washing`, `ready`, `delivered`, `revenueToday`, `revenueWeek`, `ticketAvg` | Dashboard (KPI + faturamento) |
| `customers[]` | `id, name, phone, vehicle, plate, color, isDefault?` (inclui o "Avulso") | Nova Ordem (select), Clientes (lista) |
| `products[]` | `id, name, price` | Nova Ordem (select), Produtos (catálogo) |
| `orders[]` | `id, customerName, phone, vehicle, plate, color, washType, total, status, createdAt` | Dashboard (listas), Ordens (detalhe), Financeiro (tabela) |

> Todas as mutações (filtros, remoção de itens da Nova Ordem) são feitas em `useState` local — nada volta ao JSON.

---

## 5. Componentes Compartilhados

### 5.1 `AppLayout` — `src/components/app/AppLayout.tsx`
Wrapper de todas as telas autenticadas.

**Estrutura**
- **Sidebar fixa** (`lg:flex`, escondida em mobile)
  - Logo Wash App + ícone `Droplets` em badge gradient.
  - Lista de navegação (`nav` array): Dashboard, Nova Ordem, Ordens, Clientes, Produtos, Financeiro, Admin Operacional.
  - Estado **ativo** baseado em `useLocation()` — exato para `/`, `startsWith` para os demais.
  - Card de **Plano** (`mock.currentUser.plan` + `shop`) e link **Sair** (vai para `/login`).
- **Header sticky** com `glass`
  - Busca (input com ícone `Search`) — visível em `md+`.
  - Botão sino com indicador (decorativo).
  - Bloco de perfil: nome, role e avatar com iniciais.
- **Main** com padding responsivo (`px-4 py-6 sm:px-8 sm:py-8`).

**Botões / interações**
| Elemento | Ação no protótipo |
|---|---|
| Itens do `nav` | Navegação real via `<Link to="…">` |
| Sino de notificações | Sem ação |
| Campo de busca | Sem ação (decorativo) |
| Avatar | Sem ação |
| Link "Sair" | Vai para `/login` |

### 5.2 `StatusBadge` — `src/components/app/StatusBadge.tsx`
Badge pílula com ponto colorido + label.

- Tipo: `OrderStatus = "aguardando" | "em_lavagem" | "pronto" | "entregue"`.
- Mapeia status → label PT-BR + tokens `--status-*`.
- Exporta também `statusMeta` (config completa).

### 5.3 Componentes shadcn/ui usados
`Button`, `Card` (+ `Header`/`Title`/`Content`), `Input`, `Label`, `Checkbox`, `Select`, `Collapsible`. Todos no estilo "new-york" padrão, sem variantes adicionais. Apenas os tokens de cor foram alterados via `styles.css`.

---

## 6. Telas — Detalhamento

### 6.1 `/login` — Login
Tela autônoma, **fora** do `AppLayout`.

**Layout**
- Fundo `bg-gradient-hero` com dois blobs desfocados (`primary-glow` e `accent`).
- Card central `glass` com sombra `shadow-elegant`, máx 28rem.
- Topo: ícone `Droplets` em badge gradient + título "Wash App" + subtítulo.

**Campos**
| Campo | Tipo | Ícone | Estado |
|---|---|---|---|
| Usuário | texto (placeholder `seu@email.com`) | `Mail` | Vazio |
| Senha | password | `Lock` | Vazio |
| Chave/Token (primeiro acesso) | texto, fonte mono | `KeyRound` | Vazio, placeholder `WASH-XXXX-XXXX-XXXX` |
| Checkbox "Já possuo cadastro" | checkbox | — | **Marcado por padrão** |

**Botões**
| Botão | Estilo | Ação |
|---|---|---|
| Entrar | `bg-gradient-primary` + `shadow-glow`, full-width, lg | Link para `/` |
| Criar Conta | link de texto | Sem ação |
| Esqueci a senha | link de texto | Sem ação |

---

### 6.2 `/` — Dashboard
A tela "central" da operação.

**Seções**
1. **Hero header** (gradient + dois blobs)
   - Saudação dinâmica: `Bom dia, {primeiro nome}` (usa `mock.currentUser.name`).
   - Subtítulo motivacional fixo.
   - Linha de resumo: `{totalToday} ordens hoje • R$ {revenueToday}`.
   - Botão **Nova Ordem** (`PlusCircle`, fundo branco, texto primary) → `/nova-ordem`.

2. **KPI cards** (`KpiCard`) — grid 2 col mobile / 5 col md+
   | Card | Valor (mock) | Cor (token) |
   |---|---|---|
   | Total Hoje | `stats.totalToday` | `primary` |
   | Aguardando | `stats.waiting` | `--status-waiting` (vermelho) |
   | Em Lavagem | `stats.washing` | `--status-washing` (laranja) |
   | Pronto | `stats.ready` | `--status-ready` (verde) |
   | Entregue | `stats.delivered` | `--status-delivered` (azul) |

   Cada card usa o background do status com 10% de opacidade.

3. **Revenue strip** (`RevenueCard`) — grid 1/3
   - Faturamento Hoje (`DollarSign`)
   - Faturamento Semana (`TrendingUp`)
   - Ticket Médio (`Calendar`)
   - Cada card tem ícone em badge `bg-gradient-primary` + halo `primary-glow`.

4. **Listas retráteis por status** (`OrderGroup`)
   - Grupos: **Todas as Ordens, Aguardando, Em Lavagem, Pronto, Entregue**.
   - Default abertos: **Aguardando** e **Em Lavagem**.
   - Cabeçalho clicável com ícone colorido (background do status), título, contagem de ordens e chevron animado.
   - Conteúdo: lista com `max-h-80 overflow-y-auto`.
   - Cada linha mostra: `#id`, nome do cliente, veículo • cor • placa, hora (`md+`), valor, `StatusBadge`.
   - Quando `status === "pronto"`, aparece botão **Avisar** (outline, ícone `Phone`) — sem ação.
   - Estados editáveis (`aguardando`, `em_lavagem`, `todas`) recebem hover e cursor pointer (visual apenas — sem rota associada).

**Botões / ações**
| Local | Botão | Ação |
|---|---|---|
| Hero | Nova Ordem | `/nova-ordem` |
| Header de cada grupo | Toggle expandir/recolher | Estado local (`useState`) |
| Linha de "Pronto" | Avisar | Sem ação |

---

### 6.3 `/nova-ordem` — Nova Ordem de Lavagem
Layout em duas colunas (`lg:grid-cols-3`): formulário (2/3) + sidebar de total (1/3).

**Cabeçalho**
- Botão **voltar** (ghost, `ArrowLeft`) → `/`.
- Título e subtítulo.

**Card "Cliente"** (ícone `User`)
| Campo | Tipo | Origem |
|---|---|---|
| Selecionar Cliente | Select (default `Avulso` id=0) | `mock.customers` (mostra nome + placa) |
| Nome | Input texto | Vazio |
| Telefone | Input texto, placeholder `(11) 99999-0000` | Vazio |

**Card "Veículo"** (ícone `CarIcon`) — grid 3 col
| Campo | Placeholder |
|---|---|
| Veículo | `Honda Civic` |
| Placa | `ABC1D23` |
| Cor | `Prata` |

**Card "Serviços e Produtos"** (ícone `Sparkles`)
- **Tipo de Lavagem**: Select com `Lavagem Simples — R$ 35,00` / `Lavagem Completa — R$ 65,00` (default `completa`).
- **Adicionar Produto/Serviço**: Select com `mock.products` + botão `+` (ícone `Plus`, sem ação).
- **Itens adicionados**: lista com 1 item pré-populado em `useState` (`Lavagem Completa, R$ 65, qty 1`).
  - Cada item mostra nome, `R$ preço × qty`, subtotal e botão lixeira (`Trash2`, vermelho) que **remove o item localmente**.

**Sidebar de Total** (gradient hero)
- Label "Total" + valor em destaque.
- Detalhamento: `Lavagem base R$ 35,00` + cada item `nome ×qty / R$ subtotal`.
- Cálculo: `baseValue (35) + Σ(price × qty)`.

**Botões finais (sidebar direita)**
| Botão | Estilo | Ação |
|---|---|---|
| Salvar Ordem | `bg-gradient-primary`, `shadow-glow`, lg | Sem ação |
| Avisar Cliente (WhatsApp) | outline, lg | Sem ação |
| Cancelar | ghost | Link para `/` |

---

### 6.4 `/ordens` — Detalhe da Ordem
Mostra **uma única ordem** (a primeira de `mock.orders`, `#1042` por padrão).

**Cabeçalho**
- Botão voltar (`ArrowLeft`) → `/`.
- Título `Ordem #{id}` + subtítulo.
- À direita: `<StatusBadge>` com o status da ordem.

**Card "Detalhes"** — grid 2 col
| Campo | Default value |
|---|---|
| Cliente | `order.customerName` |
| Telefone | `order.phone` |
| Veículo | `order.vehicle` |
| Placa | `order.plate` |
| Cor | `order.color` |
| Valor (R$) | `order.total.toFixed(2)` |
| Atualizar Status | Select com: Aguardando, Em Lavagem, Pronto, Entregue, **Excluir (requer senha gerencial)** |

**Botões de rodapé**
| Botão | Estilo | Ação |
|---|---|---|
| Excluir | outline, ícone `Trash2` | Sem ação |
| Salvar Alterações | `bg-gradient-primary`, ícone `Save` | Sem ação |

> Limitação atual: a rota não recebe parâmetro (`/ordens/$id` não existe); sempre exibe o primeiro registro.

---

### 6.5 `/clientes` — Clientes
Layout em 2 colunas: **formulário** + **lista buscável**.

**Cabeçalho**
- Botão voltar → `/`.
- Título "Clientes" + subtítulo.

**Card "Novo Cliente"** (ícone `Plus`)
| Campo | Tipo |
|---|---|
| Nome (col-span 2) | Input |
| Telefone | Input |
| Placa | Input |
| Veículo | Input |
| Cor | Input |

Botões: **Cancelar** (outline, sem ação) e **Salvar Cliente** (`bg-gradient-primary`, sem ação).

**Card "Clientes Cadastrados"** (ícone `Users`)
- Campo de busca com ícone `Search` — filtra `mock.customers` em tempo real (`useState`).
- Lista filtrada **exclui** o cliente "Avulso" (`isDefault: true`).
- Critério de busca: `name` ou `plate` (case-insensitive).
- Cada linha: avatar com iniciais (gradient), nome, `veículo • placa • cor`, botões **Editar** (`Pencil`, ghost) e **Excluir** (`Trash2`, ghost vermelho).
- Container com `max-h-[480px] overflow-y-auto`.

| Botão por linha | Ação |
|---|---|
| Editar | Sem ação |
| Excluir | Sem ação |

---

### 6.6 `/produtos` — Produtos & Serviços
Mesmo padrão de Clientes (2 colunas).

**Card "Novo Produto"** (ícone `Plus`)
| Campo | Tipo |
|---|---|
| Nome | Input texto, placeholder `Cera Premium` |
| Preço (R$) | Input number, placeholder `0,00` |

Botões **Cancelar** (outline) e **Salvar Produto** (gradient). Sem ação.
Nota visual abaixo: bloco com fundo `accent` informando "🔒 Alterar ou excluir preço requer senha gerencial".

**Card "Catálogo"** (ícone `Package`)
- Busca por nome (filtro local em `mock.products`).
- Cada linha: badge quadrada com `Package` + nome + preço, botões **Editar** e **Excluir** (sem ação).
- Mesmo padrão de scroll (`max-h-[480px]`).

---

### 6.7 `/financeiro` — Financeiro Operacional

**Cabeçalho**: voltar + título + subtítulo.

**Card "Filtros"** (ícone `Filter`) — grid 4 col
| Campo | Tipo | Default |
|---|---|---|
| Data Inicial | `input type="date"` | `2025-04-01` |
| Data Final | `input type="date"` | `2025-04-24` |
| Status | Select | `Todos` (opções: Aguardando, Em Lavagem, Pronto, Entregue) |
| (botão) | **Aplicar Filtro** | Sem ação |

**Cards-resumo** — grid 2 col
- **Faturamento Total** (gradient hero, ícone `DollarSign`)
  - Calcula: soma de `order.total` onde `status ∈ {entregue, pronto}`.
- **O.L. Finalizadas** (card branco, ícone `ListChecks`)
  - Conta orders com status `pronto` ou `entregue`.

**Card "Detalhamento"**
- Header com botões à direita: **Excel** (outline, `Download`) e **WhatsApp** (gradient, `Send`) — sem ação.
- Tabela com `max-h-96 overflow-y-auto`, header sticky.

| Coluna | Conteúdo |
|---|---|
| ID | `#order.id` (font-mono) |
| Cliente | `order.customerName` |
| Veículo | `vehicle • plate` |
| Status | `<StatusBadge>` |
| Valor | `R$ total.toFixed(2)` (alinhado à direita) |

> A tabela mostra **todas** as ordens (`mock.orders`), os filtros do topo são apenas visuais.

---

### 6.8 `/admin` — Admin Operacional

**Cabeçalho**: voltar + título + subtítulo.

**Banner "Painel Restrito"** — card `bg-gradient-hero` com ícone `Shield` em badge translúcida e texto "Apenas o dono do estabelecimento".

**Card "Gerente Responsável"** (ícone `UserCog`) — grid coluna
| Campo | Default |
|---|---|
| Nome | `Carlos Almeida` |
| Contato | `(11) 98000-0000` |

Botão **Salvar** (gradient, full-width, sem ação).

**Card "Senha Gerencial"** (ícone `KeyRound`)
| Campo | Tipo |
|---|---|
| Nova Senha | password |
| Confirmar Senha | password |

Botão **Atualizar Senha** (gradient) e nota com ícone `Lock`: "Necessária para excluir ordens, alterar preços e enviar relatórios."

**Card "Ações que exigem senha gerencial"** — grid 3 col, blocos informativos (sem botão):
- Excluir Ordem — Remoção definitiva de O.L.
- Enviar Relatório — WhatsApp / Excel
- Alterar Preço — Edição de produtos

---

### 6.9 404 — Página Não Encontrada
Definida em `__root.tsx` (`NotFoundComponent`).
- Tela centralizada com "404", "Page not found" e botão **Go home** (link para `/`).

---

## 7. Estados visuais e interações reais do protótipo

| Tela | Lógica realmente funcional |
|---|---|
| Dashboard | Filtragem das listas por status (sobre `mock.orders`); abrir/fechar cada grupo; saudação com primeiro nome do mock. |
| Nova Ordem | Cálculo automático do **Total** com base no item pré-populado; remoção de item da lista. |
| Clientes | Busca por nome ou placa (filtro client-side, exclui "Avulso"). |
| Produtos | Busca por nome. |
| Financeiro | Cálculo de Faturamento Total e contagem de O.L. finalizadas (status `pronto` + `entregue`). |
| Login / Ordens / Admin | Apenas decorativos — botões não submetem nem persistem nada. |

---

## 8. Limitações conhecidas (intencionais — protótipo)

- Sem autenticação, sessão, refresh ou validação de chave/token.
- Sem persistência: salvar/excluir/atualizar não têm efeito.
- Filtros do Financeiro não filtram a tabela (apenas UI).
- `/ordens` não recebe parâmetro `:id` — exibe sempre a primeira ordem.
- Botões "Avisar Cliente (WhatsApp)" e "Excel" são placeholders.
- Sem tela de **Admin Sistema** (módulo Master) e sem **recuperação de senha**.
- Ainda não existe modal de confirmação de **senha gerencial** para ações sensíveis.
- Dark mode declarado em `styles.css` mas sem toggle exposto na UI.
- Mobile: a sidebar desaparece em telas `<lg`; ainda não há menu hambúrguer substituto.

---

## 9. Estrutura de arquivos relevantes

```
src/
├── components/
│   ├── app/
│   │   ├── AppLayout.tsx       # Shell (sidebar + header)
│   │   └── StatusBadge.tsx     # Badge de status da O.L.
│   └── ui/                     # shadcn/ui (Button, Card, Input, Select, Collapsible, …)
├── data/
│   └── mock.json               # Único fonte de dados do protótipo
├── routes/
│   ├── __root.tsx              # Shell HTML, meta, 404
│   ├── index.tsx               # Dashboard
│   ├── login.tsx
│   ├── nova-ordem.tsx
│   ├── ordens.tsx
│   ├── clientes.tsx
│   ├── produtos.tsx
│   ├── financeiro.tsx
│   └── admin.tsx
├── styles.css                  # Tokens oklch + utilities (glass, gradients, shadows)
├── router.tsx                  # createRouter + ErrorComponent global
└── routeTree.gen.ts            # Gerado automaticamente — NÃO editar
```
