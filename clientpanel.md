# Client Panel Deployment

Use this for the client-facing analytics portal.

```text
Project:      /var/www/client_panel
Local app:    http://127.0.0.1:5177
Client URL:   http://143.198.5.97:5177/vercel_website
Hub API:      http://143.198.5.97/aihub
```

The first URL segment is the client ID hint. For this setup:

```text
/vercel_website -> site_id vercel_website
```

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
EOF
```

Use HTTPS here after certificates are active:

```text
VITE_AI_HUB_API_BASE=https://143.198.5.97/aihub
```

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
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5177/vercel_website
```

Expected:

```text
200
```

Open:

```text
http://143.198.5.97:5177/vercel_website
```

Login with:

```text
Client ID: vercel_website
Password: value from AI Hub CLIENT_PANEL_DEFAULT_PASSWORD or the client-specific password
```

## 6. Hub Requirements

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

## 7. HTTPS Later

For production, put this panel behind HTTPS with a clean hostname such as:

```text
https://panel.ergobite.com/vercel_website
```

Keep the path as the client name so each client gets a clear panel URL.
