# Checklist Pre-Deploy

## Infra e Configuracao

- Confirmar `backend/.env` com `JWT_SECRET_KEY` forte e diferente de `change-me`.
- Confirmar `CORS_ORIGINS` com os dominios reais de homologacao/producao.
- Confirmar `WHATSAPP_BRIDGE_URL` acessivel pelo backend.
- Confirmar portas e processos unicos para frontend, backend e bridge.

## Banco e Dados

- Validar backup do banco antes de publicar.
- Rodar smoke de login, dashboard, nova ordem e financeiro em base limpa.
- Validar isolamento entre empresas em clientes, produtos, ordens e equipe.
- Confirmar que nao existem usuarios/chaves de teste expostos em ambiente publico.

## Qualidade

- Rodar `pytest` no backend.
- Rodar `npm run build` no frontend.
- Rodar `npm run test:e2e` com `E2E_BASE_URL`, `E2E_USER_EMAIL` e `E2E_USER_PASSWORD` configurados.
- Revalidar fluxo WhatsApp: status, gerar QR, avisar cliente, financeiro por WhatsApp.

## Seguranca e Operacao

- Revisar logs para erros 4xx/5xx recorrentes.
- Confirmar que o celular e o desktop acessam o mesmo ambiente sem falha de CORS.
- Confirmar logout e expiracao/invalidacao de token.
- Definir plano de rollback: restaurar banco e voltar para a versao anterior do frontend/backend.