# Client Panel Deployment Runbook

Use this for the current no-DNS server setup.

```text
Client Panel project: /var/www/client_panel
Client Panel local:   http://127.0.0.1:5177/client-panel/ai_kart
Client Panel public:  http://143.198.5.97/client-panel/ai_kart
Hub API public:       http://143.198.5.97/aihub
```

Public routing is owned by AI-KART Nginx config:

```text
/                         -> AI-KART frontend on 127.0.0.1:5175
/api/                     -> AI-KART backend on 127.0.0.1:8000
/aihub/                   -> AI Hub app on 127.0.0.1:5176
/client-panel/<client_id> -> Client Panel on 127.0.0.1:5177
```

Deploy order:

1. Deploy AI Hub from `/var/www/AI_salesman_plugin/aihub.md`.
2. Confirm Hub analytics returns the new fields used by the richer Client Panel.
3. Deploy Client Panel with this file.
4. If public `/client-panel/ai_kart` fails but local `127.0.0.1:5177` works, reload shared Nginx from `/var/www/Vercel_website/aikart.md`.

## 1. Preflight

```bash
set -e

cd /var/www/client_panel

command -v git
command -v curl
command -v sudo

pwd
git status --short
```

Expected:

```text
/var/www/client_panel
```

If `git status --short` shows local changes on the server, stop and inspect them before pulling.

## 2. Pull Code

```bash
cd /var/www/client_panel
git pull
```

## 3. Fix Permissions

```bash
sudo chown -R $(whoami):$(whoami) /var/www/client_panel
sudo mkdir -p /Data/www
sudo chown -R $(whoami):$(whoami) /Data/www
```

## 4. Ensure Node For This Project

This keeps Node local to the project and avoids depending on system Node.

```bash
cd /var/www/client_panel

ARCH="$(uname -m)"
if [ "$ARCH" = "x86_64" ]; then
  NODE_ARCH="x64"
elif [ "$ARCH" = "aarch64" ]; then
  NODE_ARCH="arm64"
else
  echo "Unsupported arch: $ARCH"
  exit 1
fi

mkdir -p /var/www/client_panel/.node
cd /var/www/client_panel/.node

NODE_FILE="$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | grep "linux-${NODE_ARCH}.tar.xz" | awk '{print $2}' | head -n 1)"

if [ ! -f "$NODE_FILE" ]; then
  curl -fsSLO "https://nodejs.org/dist/latest-v22.x/${NODE_FILE}"
fi

tar -xf "$NODE_FILE"
ln -sfn "${NODE_FILE%.tar.xz}" current

export PATH="/var/www/client_panel/.node/current/bin:$PATH"
node -v
npm -v
```

## 5. Ensure PM2

```bash
if ! command -v pm2 >/dev/null 2>&1; then
  sudo /var/www/client_panel/.node/current/bin/npm install -g pm2
fi

command -v pm2
pm2 -v
```

## 6. Create Environment

```bash
cat > /var/www/client_panel/.env.local <<'EOF'
VITE_AI_HUB_API_BASE=http://143.198.5.97/aihub
VITE_CLIENT_PANEL_BASE_PATH=/client-panel/
VITE_DEFAULT_CLIENT_ID=ai_kart
EOF
```

Keep `VITE_CLIENT_PANEL_BASE_PATH=/client-panel/` while the app is served on the same IP and public port as AI-KART.

## 7. Build Client Panel

Run a fresh build after every UI change. Restarting PM2 without rebuilding can keep the old interface.

```bash
cd /var/www/client_panel
export PATH="/var/www/client_panel/.node/current/bin:$PATH"
npm install
npm run build
```

## 8. Start With PM2

This recreates the PM2 process so it uses the project-local npm path.

```bash
cd /var/www/client_panel

pm2 delete client-panel || true
pm2 start /var/www/client_panel/.node/current/bin/npm \
  --name client-panel \
  --cwd /var/www/client_panel \
  -- run preview -- --host 127.0.0.1 --port 5177

pm2 save
pm2 list
```

## 9. Test Local Client Panel

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5177/client-panel/ai_kart
curl -s http://127.0.0.1:5177/client-panel/ai_kart | grep -E 'assets/index-.*\.js'
```

Expected:

```text
200
current Client Panel bundle path
```

If this fails, check:

```bash
pm2 logs client-panel --lines 100
```

## 10. Confirm Hub API Contract

The redesigned panel is backward compatible, but the richer charts need the updated Hub analytics fields.

```bash
cd /var/www/AI_salesman_plugin
set -a
. ./.env
set +a

curl -s "http://143.198.5.97/aihub/v1/admin/analytics?range=7d" \
  -H "x-crm-admin-token: ${CRM_ADMIN_TOKEN}" \
  | grep -E '"latency_buckets"|"transport_mix"|"action_rate"'
```

Expected:

```text
analytics fields present
```

If this fails, deploy AI Hub first from `/var/www/AI_salesman_plugin/aihub.md`.

## 11. Test Public Client Panel

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://143.198.5.97/client-panel/ai_kart
curl -s http://143.198.5.97/client-panel/ai_kart | grep -E 'assets/index-.*\.js'
```

Expected:

```text
200
current Client Panel bundle path
```

If local `127.0.0.1:5177/client-panel/ai_kart` is `200` but public `/client-panel/ai_kart` is not `200`, apply shared Nginx from:

```text
/var/www/Vercel_website/aikart.md
```

## 12. Browser Smoke

Open:

```text
http://143.198.5.97/client-panel/ai_kart
```

Login:

```text
Client ID: ai_kart
Password: value from AI Hub CLIENT_PANEL_DEFAULT_PASSWORD or the client-specific password
```

Check:

- Header uses the AI-KART dark brand bar.
- Page shows voice commerce cockpit hero, KPI cards, demand trend, token policy, assistant health, product demand, intent mix, catalog health, and recent conversations.
- Per-shopper/session token limit saves successfully.

## 13. Hub Requirements

AI Hub `.env` must include:

```text
CLIENT_PANEL_DEFAULT_PASSWORD=choose_client_panel_password
CLIENT_PANEL_TOKEN_SECRET=choose_client_panel_token_secret
```

If those values changed, rebuild AI Hub:

```bash
cd /var/www/AI_salesman_plugin
sudo docker compose build --no-cache app
sudo docker compose up -d --force-recreate db app
```

## 14. Common Failure Map

```text
Client Panel public URL is 502
  -> PM2 app is not running or Nginx cannot reach 127.0.0.1:5177.

Client Panel public URL is 404
  -> Shared Nginx route is missing. Apply Vercel_website/aikart.md.

Client Panel shows old plain UI
  -> Run npm run build, then delete/start PM2 as in steps 7 and 8.

Login fails
  -> Check AI Hub CLIENT_PANEL_DEFAULT_PASSWORD and deploy/recreate Hub app.
```
