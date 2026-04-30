# Manual Funcional e Operacional - Washapp V2

Versao do documento: 1.0
Data: 30/04/2026
Publico-alvo: uso interno, demonstracao comercial e alinhamento funcional do prototipo
Classificacao do produto: MVP de SaaS vertical / prototipo funcional de SaaS para lava-rapido

## 1. O que e o Washapp V2

O Washapp V2 foi concebido como um sistema de apoio a operacao diaria de um lava-rapido. A intencao aparente do produto e centralizar, em uma unica ferramenta, os principais processos de atendimento, execucao, controle e acompanhamento do negocio.

Em termos funcionais, o produto busca resolver quatro dores principais:

- organizar o fluxo de ordens de lavagem;
- manter cadastros minimos de clientes e servicos;
- dar visibilidade do andamento da operacao e do resultado financeiro;
- permitir comunicacao agil com o cliente por WhatsApp.

## 2. Como o produto deve ser apresentado

A forma mais adequada de apresentar o Washapp V2 e como um MVP de SaaS vertical para lava-rapido. Essa descricao comunica dois pontos ao mesmo tempo:

- ja existe um produto funcional, com fluxo operacional de ponta a ponta;
- o produto ainda esta em fase de consolidacao para producao madura e escala maior.

## 3. Visao funcional geral

O produto esta organizado para que o usuario consiga operar o negocio quase sempre a partir de um fluxo simples:

1. entrar no sistema;
2. consultar o dashboard;
3. cadastrar ou localizar cliente;
4. abrir nova ordem;
5. movimentar a ordem conforme o andamento do servico;
6. avisar o cliente quando necessario;
7. acompanhar o resultado financeiro;
8. usar o painel administrativo para configuracoes sensiveis.

## 4. Perfis e niveis de uso

### 4.1 Usuario master

O usuario master tem papel de governanca do sistema. Sua intencao funcional e administrar a estrutura mais ampla da plataforma, incluindo usuarios, contratos, chaves e estados de acesso.

### 4.2 Usuario operacional/gestor

O usuario operacional administra a operacao do proprio negocio. A intencao funcional desse perfil e tocar a rotina da empresa, cadastrar dados, abrir ordens, acompanhar o financeiro e controlar o modulo administrativo da propria empresa.

## 5. Primeiro acesso e login

### 5.1 Intencao da tela de login

A tela de login nao serve apenas para autenticar. Ela tambem introduz o conceito de ativacao controlada do sistema. Isso aparece pela presenca de:

- usuario e senha;
- validacao de chave no primeiro acesso;
- bloqueio apos tentativas invalidas;
- dependencias de status de usuario, contrato e chave.

A intencao por tras desse desenho parece ser garantir que o SaaS tenha algum nivel de controle comercial e operacional sobre quem pode entrar e quando pode entrar.

### 5.2 Fluxo funcional esperado

1. o usuario informa email e senha;
2. se for o primeiro uso, pode ser necessario informar uma chave de acesso;
3. em seguida, pode ser exigida a definicao da senha gerencial;
4. se as validacoes forem satisfeitas, o usuario entra na area operacional.

## 6. Dashboard

### 6.1 Intencao do modulo

O dashboard foi claramente pensado como centro de comando da operacao. Sua funcao principal e permitir leitura rapida do estado do negocio sem exigir navegacao imediata por outras telas.

### 6.2 O que o usuario encontra

- resumo de ordens do dia;
- agrupamento por status operacional;
- indicadores de faturamento;
- listas de ordens por situacao;
- atalho para nova ordem;
- acao rapida de aviso ao cliente quando a ordem estiver pronta.

### 6.3 Problema que resolve

Esse modulo reduz a necessidade de o gestor montar controle paralelo em papel, WhatsApp solto ou memoria. A intencao e concentrar, em uma unica visao, o que esta aguardando, o que esta em lavagem, o que esta pronto e o que ja foi entregue.

## 7. Clientes

### 7.1 Intencao do modulo

O modulo de clientes parece ter sido criado para dar base ao restante do sistema. Sem um cadastro simples e reaproveitavel de cliente, a abertura de ordens ficaria repetitiva e propensa a erro.

### 7.2 O que o modulo guarda

- nome;
- telefone;
- veiculo;
- placa;
- cor;
- cliente padrao ou avulso, quando aplicavel.

### 7.3 Problema que resolve

Permite localizar rapidamente um cliente recorrente, evitar retrabalho de digitacao e melhorar a consistencia das ordens futuras.

## 8. Nova Ordem de Lavagem

### 8.1 Intencao do modulo

A tela de nova ordem foi desenhada como ponto principal de entrada da rotina operacional. Ela conecta cliente, veiculo, servico, itens adicionais e opcao de notificacao.

### 8.2 Funcao pratica

- buscar cliente por nome ou placa;
- selecionar cliente existente ou cadastrar um caso avulso;
- preencher dados do veiculo;
- escolher tipo de lavagem;
- adicionar itens/produtos extras;
- calcular o total;
- salvar a ordem;
- opcionalmente disparar comunicacao via WhatsApp.

### 8.3 Problema que resolve

Esse modulo substitui um processo disperso de recepcao, anotacao e soma manual por um fluxo unico, mais rastreavel e coerente com o restante do sistema.

## 9. Ordem de Lavagem

### 9.1 Intencao do modulo

A tela de ordens existe para acompanhar a vida util da O.L. depois que ela e criada. A intencao aparente e nao limitar o sistema ao cadastro inicial, mas permitir controle real do andamento do servico.

### 9.2 Papel no processo

- consultar dados completos da ordem;
- alterar status conforme o andamento do servico;
- editar informacoes permitidas;
- respeitar restricoes de edicao em status finais, especialmente quando a ordem ja foi entregue.

### 9.3 Problema que resolve

Sem esse modulo, o sistema viraria apenas um emissor de ordens. Com ele, passa a haver rastreabilidade basica do processo operacional.

## 10. Produtos e servicos adicionais

### 10.1 Intencao do modulo

O modulo de produtos foi pensado para tornar parametrizavel o que entra no valor final da ordem. Em vez de depender de texto livre, o sistema passa a trabalhar com itens previamente cadastrados.

### 10.2 Beneficios funcionais

- padronizacao de nomenclatura;
- agilidade na montagem do pedido;
- menor erro de digitacao;
- base melhor para leitura de receita e composicao do ticket medio.

## 11. Financeiro

### 11.1 Intencao do modulo

O modulo financeiro nao parece ser um financeiro contabil completo. A intencao e mais operacional e gerencial: mostrar quanto entrou, quantas ordens foram fechadas e quanto sobrou apos considerar custos da operacao.

### 11.2 O que ele entrega

- filtro por periodo;
- filtro por status;
- total faturado;
- quantidade de ordens finalizadas;
- custos operacionais;
- custo de equipe;
- lucro operacional;
- exportacao para Excel;
- envio de resumo por WhatsApp.

### 11.3 Problema que resolve

Esse modulo reduz a necessidade de apurar o movimento fora do sistema. Para o dono da operacao, ele oferece uma visao minima de desempenho sem exigir planilha paralela para tudo.

## 12. Equipe

### 12.1 Intencao do modulo

A existencia do modulo de equipe indica a preocupacao de nao olhar apenas faturamento. O produto parece ter sido pensado para refletir melhor o custo real da operacao, incluindo a mao de obra.

### 12.2 Papel esperado

- cadastrar membros da equipe;
- manter relacao ativa/inativa;
- registrar custos por data;
- apoiar o calculo do resultado operacional.

## 13. Custos operacionais

### 13.1 Intencao do modulo

Esse modulo parece ter sido criado para representar despesas da operacao que nao sao necessariamente produto nem mao de obra direta, como insumos, agua, energia, material e outros custos recorrentes.

### 13.2 Papel esperado

- cadastrar tipos de custo;
- lancar custos por data;
- complementar a leitura financeira;
- ajudar a aproximar o sistema da realidade economica do negocio.

## 14. Admin Operacional

### 14.1 Intencao do modulo

O Admin Operacional foi desenhado como area sensivel da empresa. A intencao parece ser separar a rotina operacional comum das configuracoes que exigem mais cuidado.

### 14.2 O que concentra

- atualizacao de perfil gerencial;
- configuracao e redefinicao da senha gerencial;
- configuracao do numero remetente do WhatsApp;
- leitura do status da bridge;
- geracao de novo QR ou relink da sessao.

### 14.3 Problema que resolve

Esse modulo concentra a governanca da empresa usuaria sem misturar essas acoes com o uso operacional do dia a dia.

## 15. Admin Sistema

### 15.1 Intencao do modulo

O Admin Sistema e a parte mais claramente ligada ao conceito de SaaS. Sua intencao e permitir que o proprietario da plataforma gerencie a camada superior do produto, controlando quem existe, quem esta ativo e quais contratos ou chaves estao liberados.

### 15.2 O que se espera desse modulo

- listar usuarios e chaves;
- criar usuarios;
- editar usuarios;
- ativar ou inativar usuario;
- ativar ou inativar contrato;
- gerar e controlar chaves de acesso.

## 16. WhatsApp no produto

### 16.1 Intencao funcional

O WhatsApp foi introduzido como instrumento de proximidade operacional com o cliente. A intencao nao parece ser montar uma central omnichannel complexa, e sim apoiar comunicacoes essenciais do contexto do lava-rapido.

### 16.2 Usos principais observados

- aviso de ordem pronta;
- envio de resumo financeiro;
- apoio a experiencia de relacionamento rapido com o cliente.

### 16.3 Limite funcional atual

O recurso depende de um processo de vinculacao por QR em uma bridge separada. Portanto, o funcionamento do WhatsApp no prototipo esta condicionado a:

- bridge ativa;
- sessao autenticada;
- numero remetente configurado;
- conectividade da infraestrutura local ou do ambiente publicado.

## 17. Fluxo funcional recomendado de uso

Para uso diario, a sequencia mais natural do sistema e:

1. entrar no sistema;
2. checar o dashboard;
3. localizar ou cadastrar cliente;
4. criar nova ordem;
5. acompanhar mudanca de status;
6. avisar o cliente quando a ordem estiver pronta;
7. ao fim do periodo, consultar o financeiro;
8. usar o admin apenas para configuracoes e controles criticos.

## 18. Intencao global do produto

Observando as paginas, os requisitos e o modelo de dados, a intencao mais forte do produto parece ser esta:

- transformar a operacao do lava-rapido em fluxo organizado e rastreavel;
- reduzir improviso no atendimento;
- dar controle basico de licenciamento e acesso;
- gerar uma base reaproveitavel para evoluir para SaaS multiempresa;
- criar um produto enxuto, mas ja orientado a uso real.

## 19. Limites atuais percebidos pelo manual

Mesmo com boa cobertura funcional, o prototipo ainda deve ser apresentado com transparencia quanto a alguns limites:

- o WhatsApp atual depende de bridge baseada em WhatsApp Web;
- o onboarding do cliente ainda nao esta totalmente empacotado como experiencia final de SaaS maduro;
- parte da operacao ainda demanda atencao tecnica para deploy e ambiente;
- a evolucao para larga escala ainda depende de endurecimento de arquitetura e operacao.

## 20. Conclusao funcional

Do ponto de vista funcional, o Washapp V2 ja entrega um percurso coerente para uma empresa de lava-rapido operar clientes, ordens, servicos, comunicacao e acompanhamento financeiro em um unico sistema. A construcao indica claramente a intencao de virar um SaaS vertical. O que existe hoje ja e mais do que uma simples demonstracao de telas, mas ainda deve ser tratado como MVP validado, em fase de consolidacao para operacao produtiva mais madura.
