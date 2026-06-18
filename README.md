# Client Panel

Client Panel is the tenant-facing portal for AI Salesman Hub clients. It shows scoped analytics, usage, catalog status, conversations, and token policy for one client at a time.

The app is intentionally separate from both the Hub and the storefront:

- `AI_salesman_plugin` owns the backend data, authentication API, analytics API, and token policy API.
- `Vercel_website` owns the AI-KART storefront and shared public Nginx route.
- `client_panel` owns only the client-facing React/Vite UI.

Client Panel is a Node/Vite frontend. It does not use a Python backend or host venv.

## Current Public URL

```text
http://143.198.5.97/client-panel/ai_kart
```

Current server project path:

```text
/var/www/client_panel
```

Local PM2 preview target:

```text
http://127.0.0.1:5177/client-panel/ai_kart
```

## Public Routing

Client Panel is served behind the shared Nginx config owned by AI-KART:

```text
/                         -> AI-KART frontend on 127.0.0.1:5175
/api/                     -> AI-KART backend on 127.0.0.1:8000
/aihub/                   -> AI Hub app on 127.0.0.1:5176
/client-panel/<client_id> -> Client Panel on 127.0.0.1:5177
```

If the local Client Panel works but the public URL fails, reapply the Nginx section in `Vercel_website/aikart.md`.

## Product Role

Client Panel gives store owners a limited view into their AI assistant:

- AI demand and engagement overview.
- Token usage and remaining purchased tokens.
- Per-shopper/session token limit controls.
- Product and intent trends.
- Conversation review.
- Catalog status and crawl visibility.
- Store-manager summary focused on one tenant.

It must not expose cross-tenant Hub data.

## Tenant Routing

The URL path includes the client ID hint:

```text
/client-panel/ai_kart
/client-panel/acme_store
```

Current active tenant:

```text
ai_kart
```

The login still requires the Hub-issued client panel password. The URL alone is not authentication.

## Hub API Contract

Client Panel reads and writes scoped data through AI Hub APIs under:

```text
/v1/client-panel/*
```

Hub is expected at:

```text
http://143.198.5.97/aihub
```

AI Hub must provide:

- Client login by `site_id` and password.
- Scoped analytics.
- Scoped usage and token policy.
- Scoped catalog summary.
- Scoped conversation list/details.

AI Hub `.env` must include:

```env
CLIENT_PANEL_DEFAULT_PASSWORD=choose_client_panel_password
CLIENT_PANEL_TOKEN_SECRET=choose_client_panel_token_secret
```

If either value changes, redeploy AI Hub before testing Client Panel login.

## Environment

Create `.env.local` from `.env.example`:

```env
VITE_AI_HUB_API_BASE=http://143.198.5.97/aihub
VITE_CLIENT_PANEL_BASE_PATH=/client-panel/
VITE_DEFAULT_CLIENT_ID=ai_kart
```

Environment ownership:

- `.env.local` belongs to this project and is ignored by Git.
- AI Hub secrets stay in `AI_salesman_plugin/.env`.
- AI-KART website admin credentials stay in `Vercel_website/backend/.env`.

## Repository Layout

```text
src/
  App.tsx       main workspace UI
  api.ts        AI Hub API client
  types.ts      frontend data contracts
  styles.css    UI styling

index.html      Vite HTML entry
vite.config.ts  Vite config
clientpanel.md  deployment runbook
```

## Local Development

Install dependencies:

```bash
npm install
```

Run local dev server:

```bash
npm run dev
```

Default dev URL:

```text
http://127.0.0.1:5177/client-panel/ai_kart
```

For local Hub Docker, point `.env.local` to the local Hub origin if needed.

## Build

```bash
npm run build
```

Preview:

```bash
npm run preview -- --host 127.0.0.1 --port 5177
```

## Server Deployment

Use [clientpanel.md](clientpanel.md).

The deployment runbook is split into small controlled steps:

1. Safe Git pull.
2. Fast permissions.
3. Project-local Node setup.
4. PM2 setup.
5. Env file check.
6. Build.
7. PM2 restart.
8. Local smoke.
9. Public smoke.
10. Optional Hub API contract check.

Server runtime rules:

- Client Panel is Node/Vite/PM2 only.
- It does not use a Python venv.
- It does not own public Nginx.
- It does not store Hub admin secrets.
- It does not store AI-KART admin credentials.

## Git And Runtime Safety

Ignored runtime paths include:

```text
.env.local
.node/
node_modules/
dist/
.deploy-backups/
```

Deployment uses `git pull --ff-only` and stashes only tracked server-local edits. Ignored runtime files are preserved.

Do not run `git stash pop` during normal deployment unless you intentionally inspect and recover a specific stash.

## Smoke Checks

Local:

```bash
curl -fsS http://127.0.0.1:5177/client-panel/ai_kart | grep -E 'assets/index-.*\.js' >/dev/null
```

Public:

```bash
curl -fsS http://143.198.5.97/client-panel/ai_kart | grep -E 'assets/index-.*\.js' >/dev/null
```

Optional Hub analytics contract:

```bash
cd /var/www/AI_salesman_plugin
set -a
. ./.env
set +a

curl -fsS "http://143.198.5.97/aihub/v1/admin/analytics?range=7d" \
  -H "x-crm-admin-token: ${CRM_ADMIN_TOKEN}" \
  | grep -E '"latency_buckets"|"transport_mix"|"action_rate"' >/dev/null
```

## Operational Notes

- The active default client is `ai_kart`.
- Future clients should use `/client-panel/<client_id>`.
- UI-only Client Panel changes require rebuilding this project and restarting PM2.
- Public route changes belong in AI-KART's Nginx runbook, not this project.
- Hub API shape changes must be deployed in AI Hub before the panel depends on them.

## Troubleshooting

Public URL returns 404:

```text
Shared Nginx route is missing. Apply Vercel_website/aikart.md.
```

Public URL returns 502:

```text
PM2 app is down or Nginx cannot reach 127.0.0.1:5177.
```

Local smoke fails:

```bash
pm2 logs client-panel --lines 100
```

Login fails:

```text
Check CLIENT_PANEL_DEFAULT_PASSWORD and CLIENT_PANEL_TOKEN_SECRET in AI Hub .env, then redeploy AI Hub.
```

UI looks old after deploy:

```text
Run npm run build, then restart PM2 using clientpanel.md.
```
