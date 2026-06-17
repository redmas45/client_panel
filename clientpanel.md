# Client Panel Deployment

Use this for the client-facing analytics portal.

```text
Project:      /var/www/client_panel
Local app:    http://127.0.0.1:5177
Public URL:   http://143.198.5.97/client-panel/ai_kart
Hub API:      http://143.198.5.97/aihub
```

All three projects share public port `80` and are separated by paths:

```text
/                  -> AI-KART website
/api/              -> AI-KART backend
/aihub/            -> AI Hub
/client-panel/<client_id> -> Client Panel
```

The client name comes after `/client-panel/`. For this setup, `/client-panel/ai_kart` maps to `site_id=ai_kart`. Future clients use the same pattern, for example `/client-panel/acme_store`.

The panel still requires the client-panel password issued from AI Hub.

## 1. Pull Code

```bash
cd /var/www/client_panel
git pull
```

## 2. Create Environment

```bash
cat > /var/www/client_panel/.env.local <<'EOF'
VITE_AI_HUB_API_BASE=http://143.198.5.97/aihub
VITE_CLIENT_PANEL_BASE_PATH=/client-panel/
VITE_DEFAULT_CLIENT_ID=ai_kart
EOF
```

Use HTTPS here after certificates are active:

```text
VITE_AI_HUB_API_BASE=https://143.198.5.97/aihub
```

Keep `VITE_CLIENT_PANEL_BASE_PATH=/client-panel/` while the panel is served on the same domain and port as the website.

## 3. Install And Build

```bash
cd /var/www/client_panel
npm install
npm run build
```

## 4. Start With PM2

```bash
cd /var/www/client_panel
pm2 describe client-panel >/dev/null \
  && pm2 restart client-panel \
  || pm2 start "npm run preview -- --host 127.0.0.1 --port 5177" --name client-panel --cwd /var/www/client_panel

pm2 save
pm2 list
```

## 5. Test

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5177/client-panel/ai_kart
```

Expected:

```text
200
```

Open:

```text
http://143.198.5.97/client-panel/ai_kart
```

If the public URL returns `404` or `502`, do not add Nginx config in this repo. Apply or reload the shared edge config from `/var/www/Vercel_website/aikart.md`.

Login with:

```text
Client ID: ai_kart
Password: value from AI Hub CLIENT_PANEL_DEFAULT_PASSWORD or the client-specific password
```

## 6. Public Routing Requirement

This project only owns the local panel app on `http://127.0.0.1:5177`.

The public `/client-panel/` route is edge/shared Nginx config. In the current same-IP setup, AI-KART owns `/` and `/api/`, so the shared Nginx block belongs in `/var/www/Vercel_website/aikart.md`.

Do not add AI-KART `/`, `/api/`, or AI Hub `/aihub/` proxy rules in this client panel guide. If you later use a dedicated hostname such as `panel.ergobite.com`, configure that hostname in Nginx to proxy directly to `http://127.0.0.1:5177`.

After AI-KART/shared Nginx is deployed, test:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://143.198.5.97/client-panel/ai_kart
```

Expected:

```text
200
```

## 7. Hub Requirements

AI Hub `.env` must include:

```text
CLIENT_PANEL_DEFAULT_PASSWORD=choose_client_panel_password
CLIENT_PANEL_TOKEN_SECRET=choose_client_panel_token_secret
```

After changing these values, rebuild/recreate the Hub app:

```bash
cd /var/www/AI_salesman_plugin
sudo docker compose up -d --build --force-recreate db app
```

## 8. HTTPS Later

For production, put this panel behind HTTPS with a clean hostname such as:

```text
https://panel.ergobite.com/ai_kart
```

Keep the path as the client name so each client gets a clear panel URL.
