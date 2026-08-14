# Servidor próprio do tdm-angular-novo

Este diretório contém o backend/gateway **exclusivo** deste projeto Angular. Ele **não reutiliza nenhum código, dependência ou segredo** do projeto legado `portal-tdm-negocios`.

## Responsabilidades

1. **Autenticação corporativa do Portal** (`src/auth`)
   - `POST /auth/login` — recebe usuário/senha do Portal e retorna um JWT de sessão.
   - `POST /auth/logout`
   - `GET /auth/me`
   - Implementação inicial: usuários mockados em memória (`auth.service.ts`), isolados por trás de `AuthService` — pode ser substituído por SSO/Entra ID/LDAP sem impacto no restante do sistema.

2. **Integração com o Broadcom TDM** (`src/tdm`)
   - Único ponto do sistema que conhece `TDM_USERNAME`/`TDM_PASSWORD`/Bearer Token do TDM.
   - `POST /api/requests/submit-and-download`
   - `GET /api/jobs/:jobId/status`
   - `POST /api/jobs/:jobId/download-artifact`
   - Todas protegidas por `authMiddleware` (exige JWT de sessão do Portal).

3. **Observabilidade** (`src/logging`, `src/middleware/correlation.middleware.ts`)
   - Correlation ID propagado do Angular → este servidor → TDM.

## Fronteira de segurança

```
Angular  →  JWT do Portal (emitido por este servidor)  →  este servidor
este servidor  →  usuário/senha do TDM (só aqui!)  →  Broadcom TDM
```

O Angular **nunca** tem acesso a `TDM_USERNAME`/`TDM_PASSWORD` nem ao Bearer Token do TDM.

## Como rodar localmente

```bash
cd server
npm install
copy .env.example .env   # preencha TDM_USERNAME/TDM_PASSWORD reais
npm run dev               # porta 3000 por padrão
```

O Angular (`tdm-angular-novo`) já está configurado (`proxy.conf.json`) para redirecionar `/gw/*` para `http://localhost:3000/*` (com `pathRewrite` removendo o prefixo `/gw`).

## Usuário de teste (mock)

- usuário: `admin`
- senha: `admin123`

Substitua por integração real (SSO/LDAP) antes de produção — ver `src/auth/auth.service.ts`.
