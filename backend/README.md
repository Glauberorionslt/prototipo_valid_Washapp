# Washapp V2 Backend

Backend em FastAPI para suportar o frontend validado em `wash-hub`.

## O que cobre

- Autenticacao com chave de primeiro acesso e senha gerencial
- Dashboard com shape proximo ao `mock.json`
- CRUD de clientes
- CRUD de produtos
- CRUD de ordens com regras de status
- Financeiro com filtro, exportacao Excel e disparo opcional por WhatsApp
- Admin operacional e admin sistema (master)
- Ponte HTTP para um servico Baileys em Node.js

## Ambiente local validado

- PostgreSQL em `127.0.0.1:5433`
- Banco `washapp2`
- Python do ambiente `libs_saas`
- Backend em `http://127.0.0.1:8011`
- Frontend em `http://localhost:8080`
- WhatsApp bridge em `http://127.0.0.1:3100`

O arquivo `.env.example` ja reflete o setup funcional local, inclusive CORS para `8080` e `5173`.

## Subir o backend

```bash
cd prototipo_washapp_v2/backend
"C:/Users/Glauber Marques/OneDrive - UNIP/ONEDRIVE GLAUBER/PROJETOS/PYTHON/saas/libs_saas/Scripts/python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8011
```

## Seed a partir do frontend

```bash
cd prototipo_washapp_v2/backend
"C:/Users/Glauber Marques/OneDrive - UNIP/ONEDRIVE GLAUBER/PROJETOS/PYTHON/saas/libs_saas/Scripts/python.exe" seed_from_frontend.py
```

O seed importa `../wash-hub/src/data/mock.json` para manter a base consistente com o frontend validado.

No estado atual deste ambiente, a porta `8001` ficou com listeners residuais no Windows. A instancia limpa e validada foi executada em `8011`, que e a porta recomendada para continuar os testes locais.

## Dados de teste mantidos

Os dados de teste foram preservados. Credenciais operacionais atuais:

- Email: `owner.smoke@example.com`
- Senha: `Owner123!`
- Senha de sistema para `/auth/bootstrap-master`: `admin123`

## Observacao sobre WhatsApp

O bridge sobe e responde em `/health` e `/session/status`, mas a sessao Baileys ainda depende de pareamento para envio real. Enquanto isso, o status esperado e `connected=false` e `detail=reconnecting`.
