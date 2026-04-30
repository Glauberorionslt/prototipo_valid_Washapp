# Documentacao Tecnica - Washapp V2

Versao do documento: 1.0
Data: 30/04/2026
Status do produto documentado: prototipo funcional de SaaS / MVP de SaaS vertical para lava-rapido

## 1. Classificacao do produto

O Washapp V2 se enquadra melhor como um MVP de SaaS vertical, ou um prototipo funcional de SaaS para operacao de lava-rapido. O produto ja possui autenticacao, persistencia em banco de dados, separacao multiempresa, licenciamento por chave, modulos operacionais, gestao administrativa e integracao opcional com WhatsApp. Ao mesmo tempo, ainda nao apresenta todos os elementos de maturidade de um SaaS pronto para escala, como onboarding totalmente padronizado, observabilidade mais robusta, esteira completa de producao e endurecimento operacional de longo prazo.

## 2. Objetivo do prototipo

O objetivo deste prototipo e validar um fluxo operacional completo para empresas de lava-rapido, cobrindo:

- autenticacao e primeiro acesso;
- controle de clientes;
- abertura e acompanhamento de ordens de lavagem;
- cadastro de produtos e servicos adicionais;
- consolidacao financeira e operacional;
- controles administrativos e de licenciamento;
- envio de mensagens por WhatsApp com apoio de uma bridge baseada em WhatsApp Web.

O produto foi desenhado para funcionar como sistema vertical de operacao diaria, nao apenas como demonstracao visual de telas.

## 3. Arquitetura geral

A arquitetura atual do Washapp V2 esta dividida em quatro blocos principais.

### 3.1 Front-end

Tecnologias principais:

- React 19;
- Vite;
- TanStack Router;
- Tailwind CSS;
- componentes de interface reutilizaveis na pasta de componentes do projeto.

Responsabilidades do front-end:

- autenticar o usuario e manter sessao de uso;
- exibir os modulos operacionais do sistema;
- coletar dados de formularios;
- acionar a API do back-end;
- apresentar feedback de status, filtros, listagens e fluxos protegidos por senha gerencial.

Rotas principais do front-end:

- `/login`: entrada do usuario;
- `/`: dashboard operacional;
- `/clientes`: cadastro e consulta de clientes;
- `/nova-ordem`: abertura de nova ordem de lavagem;
- `/ordens`: visualizacao e manutencao de ordens;
- `/produtos`: cadastro de produtos/servicos adicionais;
- `/financeiro`: relatorio financeiro e exportacoes;
- `/equipe`: gestao de equipe e custos relacionados;
- `/custos-operacionais`: cadastro e lancamento de custos operacionais;
- `/admin`: painel administrativo operacional;
- `/admin-sistema`: painel master para administracao global do sistema.

### 3.2 Back-end

Tecnologias principais:

- FastAPI;
- SQLAlchemy ORM;
- PostgreSQL;
- autenticacao por token;
- modulos auxiliares de seguranca, licenciamento e integracao WhatsApp.

Responsabilidades do back-end:

- autenticar e autorizar usuarios;
- aplicar regras de negocio;
- garantir isolamento por empresa;
- persistir dados de clientes, produtos, ordens, custos, equipe e logs de WhatsApp;
- controlar licencas, chaves e status contratuais;
- servir dados do dashboard e do financeiro;
- intermediar chamadas para a bridge do WhatsApp.

Rotas principais da API:

- `/auth`: login, primeiro acesso, chave, senha gerencial, bootstrap do usuario master;
- `/dashboard`: estatisticas e ordens consolidadas para a tela inicial;
- `/customers`: operacoes de clientes;
- `/products`: operacoes de produtos;
- `/orders`: criacao e manutencao de ordens;
- `/finance`: apuracao, exportacao e envio de resumo financeiro;
- `/team`: equipe e custos da equipe;
- `/operational-costs`: tipos e lancamentos de custos operacionais;
- `/admin`: perfil gerencial, configuracao de WhatsApp e administracao do ambiente da empresa;
- `/whatsapp`: envio e apoio operacional ao fluxo de comunicacao.

### 3.3 Banco de dados

O banco de dados relacional concentra o modelo principal do dominio. O schema e criado no startup da aplicacao, e o back-end aplica migracoes leves ao iniciar.

Entidades centrais:

- `Company`: empresa/tenant principal do sistema;
- `User`: usuario autenticavel, master ou operacional;
- `AccessKey`: chave de acesso usada na ativacao e no controle de licenca;
- `AppSetting`: configuracoes gerais persistidas;
- `Customer`: cliente final do lava-rapido;
- `Product`: produtos e servicos adicionais;
- `Order`: ordem de lavagem;
- `OrderItem`: itens agregados a ordem;
- `WhatsAppLog`: historico de envio de mensagens;
- `TeamMember`: membros da equipe;
- `TeamCostEntry`: custos de equipe por data;
- `OperationalCostType`: tipos de custo operacional;
- `OperationalCostEntry`: lancamentos operacionais por data.

### 3.4 WhatsApp bridge

A integracao atual com WhatsApp nao usa a API oficial da Meta. O modelo validado utiliza um servico Node.js separado, chamado `whatsapp-bridge`, com Baileys.

Responsabilidades da bridge:

- iniciar sessao de WhatsApp Web;
- gerar QR code de vinculacao;
- manter sessao autenticada em disco;
- responder status da conexao;
- receber comandos simples de envio de mensagem;
- permitir reset e relink da sessao.

Esse componente e opcional do ponto de vista arquitetural, mas funcionalmente importante para os modulos que disparam notificacoes e resumos por WhatsApp.

## 4. Modelo de negocio refletido no dominio

O produto foi modelado para operar em contexto multiempresa. Cada empresa possui seus proprios usuarios, clientes, produtos, ordens, equipe e custos. Isso indica intencao de reutilizacao do sistema por varios clientes, caracteristica tipica de SaaS vertical.

O modelo de licenciamento combina os seguintes eixos:

- status do contrato da empresa;
- status do usuario;
- chave de acesso vinculada ao usuario;
- senha gerencial para acoes criticas;
- distincao entre usuario master e usuario operacional.

Essa combinacao sugere uma preocupacao com:

- controle comercial de acesso;
- primeiro acesso assistido por chave;
- seguranca interna para operacoes sensiveis;
- capacidade de bloquear usuarios ou contratos sem alterar o codigo do produto.

## 5. Fluxos principais do sistema

### 5.1 Autenticacao e primeiro acesso

O back-end oferece fluxo de login, validacao de bloqueio temporario por tentativas invalidas, ativacao por chave e definicao de senha gerencial. Existe tambem um endpoint de `bootstrap-master`, util para inicializar o primeiro usuario administrativo em ambiente novo.

### 5.2 Operacao diaria

A sequencia operacional principal esperada e:

1. usuario faz login;
2. visualiza o dashboard;
3. consulta pendencias por status;
4. abre nova ordem;
5. acompanha e atualiza o ciclo da ordem;
6. dispara aviso por WhatsApp quando aplicavel;
7. consulta o fechamento financeiro do periodo.

### 5.3 Operacao administrativa

O produto distingue dois niveis administrativos:

- administracao operacional da empresa: perfil gerencial, senha gerencial, numero remetente do WhatsApp e relink da bridge;
- administracao de sistema: usuarios, contratos, status de chaves e criacao de acessos.

## 6. Regras de negocio observadas

As regras abaixo aparecem no codigo, nas telas ou nos requisitos validados:

- bloqueio temporario apos tentativas invalidas de login;
- usuarios nao master dependem de contrato ativo e, quando aplicavel, chave ativa;
- primeiro acesso pode exigir validacao de chave;
- senha gerencial protege acoes criticas;
- ordens possuem ciclo de status padronizado: aguardando, em lavagem, pronto, entregue;
- o financeiro filtra por periodo e por status;
- exportacao e envio do resumo financeiro dependem de autorizacao gerencial;
- o numero de WhatsApp do remetente pertence ao contexto da empresa;
- o envio de WhatsApp atual depende da disponibilidade da bridge.

## 7. Modulos funcionais e responsabilidades

### 7.1 Dashboard

Responsavel por consolidar indicadores do dia, agrupamentos por status, receitas resumidas e a lista principal de ordens. Tambem funciona como ponto de entrada para abrir nova ordem, acessar outros modulos e acionar o aviso de cliente pronto.

### 7.2 Clientes

Responsavel pelo cadastro e consulta de clientes, com foco em nome, telefone, veiculo, placa e cor. Esse cadastro alimenta a abertura de novas ordens.

### 7.3 Nova Ordem

Responsavel pela entrada principal de trabalho do negocio. Consolida selecao de cliente, preenchimento de dados do veiculo, tipo de lavagem, itens adicionais, calculo do total e opcao de envio de WhatsApp ao salvar.

### 7.4 Ordens

Responsavel por visualizar detalhes, editar dados e evoluir o status operacional da ordem conforme regras do negocio.

### 7.5 Produtos

Responsavel pelo cadastro de servicos ou itens adicionais que podem compor o valor final de uma ordem.

### 7.6 Financeiro

Responsavel pela leitura de faturamento por periodo, quantidade de ordens finalizadas, custos operacionais, custo de equipe e lucro operacional. Tambem suporta exportacao para Excel e envio de resumo por WhatsApp.

### 7.7 Equipe

Responsavel pelo cadastro de membros da equipe e pelo controle de custos relacionados a mao de obra ou distribuicao interna.

### 7.8 Custos operacionais

Responsavel pelo cadastro de categorias de custo e pelo lancamento de despesas operacionais recorrentes ou eventuais, permitindo uma leitura mais proxima do resultado operacional real.

### 7.9 Admin Operacional

Responsavel pelo perfil do gestor, senha gerencial, configuracao do numero remetente do WhatsApp, visualizacao do estado da bridge e processo de relink por QR.

### 7.10 Admin Sistema

Responsavel pela governanca do SaaS: usuarios, empresas, contratos, chaves de acesso e estados de liberacao do ambiente.

## 8. Integracao com WhatsApp

A integracao atual e baseada em sessao de WhatsApp Web. O fluxo tecnico e o seguinte:

1. o `whatsapp-bridge` sobe em processo separado;
2. a bridge inicializa a autenticacao com Baileys;
3. o painel administrativo consulta status e QR code;
4. o usuario escaneia o QR com o numero remetente;
5. o back-end chama a bridge para envio de mensagens;
6. logs de envio podem ser persistidos no sistema.

Vantagens do modelo atual:

- baixo atrito inicial para prototipagem;
- simplicidade de prova de conceito;
- baixo custo de entrada.

Limites do modelo atual:

- dependencia de sessao Web;
- necessidade de QR e relink;
- acoplamento a uma bridge separada;
- ausencia de uso da API oficial da Meta;
- maior risco operacional em comparacao com integracao oficial.

## 9. Seguranca, autenticacao e autorizacao

O prototipo incorpora alguns mecanismos relevantes:

- autenticacao por token;
- controle de usuario master versus usuario operacional;
- bloqueio temporario por falhas de login;
- chave de acesso para ativacao;
- senha gerencial para acoes sensiveis;
- dependencia de contrato ativo e status do usuario;
- isolamento logico por empresa.

Pontos que ainda exigem atencao em producao:

- rotacao de segredos e senhas padrao;
- endurecimento de politicas de senha;
- tratamento de observabilidade e auditoria mais completo;
- separacao mais forte entre ambientes local, homologacao e producao.

## 10. Operacao local

A documentacao de uso local do projeto registra o seguinte arranjo validado:

- front-end em `http://localhost:8080`;
- back-end em `http://127.0.0.1:8011`;
- bridge em `http://127.0.0.1:3100`.

Ordem tipica de subida:

1. iniciar o back-end;
2. iniciar a bridge do WhatsApp;
3. iniciar o front-end.

O ambiente local foi preparado para aceitar acesso do celular na mesma rede quando o back-end sobe com `0.0.0.0`.

## 11. Deploy previsto

A arquitetura prevista para deploy utiliza quatro servicos:

- front-end;
- back-end;
- PostgreSQL;
- `whatsapp-bridge`.

O caminho recomendado validado anteriormente foi:

1. publicar primeiro front-end, back-end e banco;
2. ativar o `whatsapp-bridge` em uma segunda onda;
3. usar `DATABASE_URL` do banco gerenciado;
4. validar `/health` e bootstrap do usuario master;
5. so depois estabilizar dominio customizado e rotina de operacao.

## 12. Testes e validacao

As validacoes principais previstas no prototipo sao:

- `pytest` no back-end;
- `npm run build` no front-end;
- smoke funcional de login, dashboard, nova ordem e financeiro;
- testes E2E do front-end quando configurados;
- revalidacao do fluxo WhatsApp, incluindo QR, envio e resumo financeiro.

## 13. Limites atuais do prototipo

Os principais limites atuais sao:

- integracao WhatsApp nao oficial;
- ausencia de esteira de producao mais completa;
- onboarding ainda fortemente operacional;
- documentacao historicamente dispersa entre codigo, requisitos e checklists;
- maturidade parcial de observabilidade, backup e operacao de escala.

Esses limites nao invalidam o produto como MVP. Eles apenas indicam que a fase atual e de validacao funcional com base arquitetural consistente.

## 14. Recomendacoes para evolucao

Para avancar do estado atual para uma operacao mais madura, as evolucoes mais importantes sao:

- padronizar deploy de producao do front-end;
- consolidar governanca de usuarios e empresas;
- endurecer operacao de backup e logs;
- formalizar documentacao funcional e tecnica;
- decidir a estrategia de longo prazo para WhatsApp: bridge atual ou migracao futura para API oficial;
- estruturar onboarding mais claro para novos clientes do SaaS.

## 15. Conclusao tecnica

O Washapp V2 ja demonstra uma arquitetura coerente de sistema multiempresa para operacao de lava-rapido. Nao se trata apenas de um front-end demonstrativo. O conjunto atual valida que o produto pode ser operado como base de um SaaS vertical, embora ainda demande refinamentos antes de ser tratado como plataforma madura de producao em escala.
