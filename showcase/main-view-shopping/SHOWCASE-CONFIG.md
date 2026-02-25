# Showcase — Main View Shopping: Configurações

## Ambiente

| Variável | Valor |
|----------|-------|
| `_TB_URL` | `https://dashboard.myio-bas.com` |
| `_DATA_API_HOST` | `https://api.data.apps.myio-bas.com` |
| `_GCDR_API_BASE_URL` | `https://gcdr-api.a.myio-bas.com` |

## Customer: Moxuara

| Variável | Valor |
|----------|-------|
| `_CUSTOMER_TB_ID` | `5085bf40-b4dd-11f0-be7f-e760d1498268` |
| `_CUSTOMER_ING_ID` | `211ae3f9-935d-43f7-8ffe-61801595f2a8` |
| `_CLIENT_ID` | `moxuaraa_mhdlrl92_zzf8pi` |
| `_CLIENT_SECRET` | `B4SzLCzWYaCBJzxY2wwxjmLW67N2IeHltLhZQV7FtXRPEUPb9x8HFhjylENbM23F` |

## GCDR — Moxuara

| Variável | Valor |
|----------|-------|
| `_GCDR_CUSTOMER_ID` | `84e0370e-636a-4741-9874-504b5e0b3577` |
| `_GCDR_TENANT_ID` | `11111111-1111-1111-1111-111111111111` |

## Alarms API

| Variável | Valor |
|----------|-------|
| `alarmsApiBaseUrl` | `https://alarms-api.a.myio-bas.com` |
| `alarmsApiKey` | `gcdr_cust_tb_integration_key_2026` |

## Autenticação

A showcase autentica automaticamente no `DOMContentLoaded` usando a conta de serviço:

| Campo | Valor |
|-------|-------|
| `_SERVICE_USER` | `alarmes@myio.com.br` |
| `_SERVICE_PASS` | `hubmyio@2025!` |
| Endpoint | `POST https://dashboard.myio-bas.com/api/auth/login` |

O token JWT retornado é salvo em `localStorage.jwt_token` e reutilizado por todos os componentes.
Para renovar manualmente: botão **Re-Auth** no painel lateral.

## Como Rodar

```bat
showcase\main-view-shopping\start-server.bat
```

Acesse: [http://localhost:3339](http://localhost:3339)

## Histórico de Customers

| Customer | `_CUSTOMER_TB_ID` |
|----------|-------------------|
| Moxuara *(atual)* | `5085bf40-b4dd-11f0-be7f-e760d1498268` |
| Mestre Alvaro *(anterior)* | `20b93da0-9011-11f0-a06d-e9509531b1d5` |
