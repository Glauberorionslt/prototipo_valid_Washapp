# Uso Local Washapp V2

Este ambiente foi deixado com os dados de teste preservados.

## Enderecos

- Frontend: `http://localhost:8080`
- Backend local no PC: `http://127.0.0.1:8011`
- Backend para celular na mesma rede: `http://IP_DO_PC:8011`
- WhatsApp bridge: `http://127.0.0.1:3100`

## Credenciais de teste

- Email: `owner.smoke@example.com`
- Senha: `Owner123!`
- System admin password: `admin123`

## Ordem de subida

### 1. Backend

```powershell
Set-Location "c:\Users\Glauber Marques\OneDrive - UNIP\ONEDRIVE GLAUBER\PROJETOS\PYTHON\saas\prototipo_washapp_v2\backend"
& "C:/Users/Glauber Marques/OneDrive - UNIP/ONEDRIVE GLAUBER/PROJETOS/PYTHON/saas/libs_saas/Scripts/python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8011
```

Se quiser testar no proprio PC, `127.0.0.1:8011` segue funcionando. Se quiser testar no celular, o backend precisa subir com `--host 0.0.0.0` para aceitar conexoes da rede local.

O frontend nao fica mais preso a `127.0.0.1`. Ele usa o host pelo qual a pagina foi aberta e troca apenas a porta para `8011`, o que permite login tanto no navegador do PC quanto no celular.

### 2. WhatsApp bridge

```powershell
Set-Location "c:\Users\Glauber Marques\OneDrive - UNIP\ONEDRIVE GLAUBER\PROJETOS\PYTHON\saas\prototipo_washapp_v2\whatsapp-bridge"
node server.js
```

### 3. Frontend

```powershell
Set-Location "c:\Users\Glauber Marques\OneDrive - UNIP\ONEDRIVE GLAUBER\PROJETOS\PYTHON\saas\prototipo_washapp_v2\wash-hub"
npm run dev
```

O frontend local foi configurado em `wash-hub/.env` com `VITE_API_PORT=8011`, entao a API e resolvida automaticamente a partir do host atual da pagina.

## Seed

So rode novamente se quiser recarregar os dados de teste a partir do mock do frontend.

```powershell
Set-Location "c:\Users\Glauber Marques\OneDrive - UNIP\ONEDRIVE GLAUBER\PROJETOS\PYTHON\saas\prototipo_washapp_v2\backend"
& "C:/Users/Glauber Marques/OneDrive - UNIP/ONEDRIVE GLAUBER/PROJETOS/PYTHON/saas/libs_saas/Scripts/python.exe" seed_from_frontend.py
```

## Estado atual do WhatsApp

O bridge esta ativo, mas o WhatsApp ainda nao foi pareado. Isso significa:

- A interface e os endpoints sobem normalmente.
- O envio real de mensagem depende do pareamento da sessao Baileys.
- Ate la, `/whatsapp/status` e `/session/status` podem mostrar `reconnecting`.