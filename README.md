# Client Panel

Client-facing analytics panel for AI Salesman Hub tenants.

This app is separate from both projects:

- `AI_salesman_plugin` remains the Hub and owns the data/API.
- `Vercel_website` remains the client storefront/spoke.
- `client_panel` is the client portal that shows only one client's scoped Hub data.

## Local Run

```bash
npm install
npm run dev
```

Deployment steps are in `clientpanel.md`.

Default dev URL:

```text
http://127.0.0.1:5177/vercel_website
```

The first URL segment is used as the client ID hint. The login still requires the Hub-issued client panel password.

## Environment

Copy `.env.example` to `.env.local`:

```env
VITE_AI_HUB_API_BASE=http://143.198.5.97/aihub
```

For local Hub Docker, use the local Hub origin instead.

## Current Scope

- Client login by `site_id` and password.
- Dashboard metrics, token usage, remaining purchased tokens.
- Per-shopper/session token limit controls.
- Store-manager summary.
- Product and intent charts.
- Recent conversation review.
