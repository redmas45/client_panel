# Client Panel Deployment Runbook

Use this for the current public-IP server setup.

```text
Client Panel project: /var/www/client_panel
Client Panel local:   http://127.0.0.1:5177/client-panel/ai_kart
Client Panel public:  http://143.198.5.97/client-panel/ai_kart
Hub API public:       http://143.198.5.97/aihub
Shared venv:          /Data/www/aikartvenv
```

Public routing is owned by AI-KART's shared Nginx config in `/var/www/Vercel_website/aikart.md`:

```text
/                         -> AI-KART frontend on 127.0.0.1:5175
/api/                     -> AI-KART backend on 127.0.0.1:8000
/aihub/                   -> AI Hub app on 127.0.0.1:5176
/client-panel/<client_id> -> Client Panel on 127.0.0.1:5177
```

## Rules

- Deploy AI Hub first so the Client Panel API exists.
- Apply AI-KART shared Nginx if the public `/client-panel/` route is missing.
- The shared host Python venv is `/Data/www/aikartvenv`. Client Panel is Node-only, but this keeps the server venv standard consistent for helper scripts and future work.
- `.env.local`, `.node`, `node_modules`, `dist`, and `.deploy-backups` are ignored runtime files.
- The Git step stashes tracked server edits before pulling. It does not stash ignored runtime files.
- Do not run `git stash pop` as part of deployment.

## Deploy Order

Run these sections in order. Each block is intentionally small so you can see where a failure happens.

## 1. Safe Git Pull

This stashes tracked server-local edits before pulling. Ignored runtime files such as `.env.local`, `.node`, `node_modules`, and `dist` stay on the server.

```bash
set -e
cd /var/www/client_panel

echo "== safe git pull =="
git fetch origin
if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash push -m "pre-client-panel-deploy-$(date +%Y%m%d-%H%M%S)"
fi
git pull --ff-only

git status --short
```

Expected result: no pull conflict. Ignored runtime files may exist locally and are fine.

## 2. Fast Permissions

This avoids `chown -R` on the whole project. Full recursive project ownership can be slow because it walks `node_modules`, `.node`, build output, and cache folders.

```bash
set -e
cd /var/www/client_panel

sudo mkdir -p /Data/www
mkdir -p .deploy-backups

sudo chown "$(whoami):$(whoami)" /var/www/client_panel /Data/www
sudo chown -R "$(whoami):$(whoami)" .deploy-backups

if [ -e .env.local ]; then
  sudo chown "$(whoami):$(whoami)" .env.local
fi

fix_tree_if_top_owner_is_wrong() {
  path="$1"
  if [ -e "$path" ] && [ "$(stat -c '%u' "$path")" != "$(id -u)" ]; then
    sudo chown -R "$(whoami):$(whoami)" "$path"
  fi
}

fix_tree_if_top_owner_is_wrong .node
fix_tree_if_top_owner_is_wrong node_modules
fix_tree_if_top_owner_is_wrong dist
fix_tree_if_top_owner_is_wrong /Data/www/aikartvenv
```

## 3. Ensure Shared Python Venv

Client Panel does not run on Python. This step only ensures the shared server venv exists and is the same venv used by the other projects.

```bash
set -e
cd /var/www/client_panel

if [ ! -x /Data/www/aikartvenv/bin/python ]; then
  python3 -m venv /Data/www/aikartvenv
fi

. /Data/www/aikartvenv/bin/activate
which python
python -m pip install --upgrade pip
```

## 4. Ensure Project-Local Node

This installs Node under the project at `.node/current`, so deployment does not depend on system Node.

```bash
set -e
cd /var/www/client_panel

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) NODE_ARCH="x64" ;;
  aarch64) NODE_ARCH="arm64" ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

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
set -e
export PATH="/var/www/client_panel/.node/current/bin:$PATH"

if ! command -v pm2 >/dev/null 2>&1; then
  sudo /var/www/client_panel/.node/current/bin/npm install -g pm2
fi

pm2 -v
```

## 6. Ensure Env File

This creates `.env.local` only if missing. It does not overwrite an existing file.

```bash
set -e
cd /var/www/client_panel

if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
VITE_AI_HUB_API_BASE=http://143.198.5.97/aihub
VITE_CLIENT_PANEL_BASE_PATH=/client-panel/
VITE_DEFAULT_CLIENT_ID=ai_kart
EOF
fi

cat .env.local
```

Expected values:

```text
VITE_AI_HUB_API_BASE=http://143.198.5.97/aihub
VITE_CLIENT_PANEL_BASE_PATH=/client-panel/
VITE_DEFAULT_CLIENT_ID=ai_kart
```

## 7. Build Client Panel

```bash
set -e
cd /var/www/client_panel
export PATH="/var/www/client_panel/.node/current/bin:$PATH"

npm install
npm run build
```

## 8. Restart Client Panel With PM2

```bash
set -e
cd /var/www/client_panel
export PATH="/var/www/client_panel/.node/current/bin:$PATH"

pm2 delete client-panel || true
pm2 start /var/www/client_panel/.node/current/bin/npm \
  --name client-panel \
  --cwd /var/www/client_panel \
  -- run preview -- --host 127.0.0.1 --port 5177

pm2 save
pm2 list
```

## 9. Local Smoke

Run this before checking the public URL.

```bash
set -e
curl -fsS http://127.0.0.1:5177/client-panel/ai_kart | grep -E 'assets/index-.*\.js' >/dev/null
echo "Client Panel local deploy OK."
```

## 10. Public Smoke

Run this after AI-KART's shared Nginx route has been applied.

```bash
set -e
curl -fsS http://143.198.5.97/client-panel/ai_kart | grep -E 'assets/index-.*\.js' >/dev/null
echo "Client Panel public route OK."
```

If local `127.0.0.1:5177/client-panel/ai_kart` works but public `/client-panel/ai_kart` fails, apply `/var/www/Vercel_website/aikart.md`.

## 11. Optional Hub API Contract Check

Use this only if the panel loads but charts or analytics look wrong.

```bash
set -e
cd /var/www/AI_salesman_plugin
set -a
. ./.env
set +a

curl -fsS "http://143.198.5.97/aihub/v1/admin/analytics?range=7d" \
  -H "x-crm-admin-token: ${CRM_ADMIN_TOKEN}" \
  | grep -E '"latency_buckets"|"transport_mix"|"action_rate"' >/dev/null

echo "Hub analytics contract OK."
```

## Hub Requirement

AI Hub `.env` must include these values before users can log in:

```text
CLIENT_PANEL_DEFAULT_PASSWORD=choose_client_panel_password
CLIENT_PANEL_TOKEN_SECRET=choose_client_panel_token_secret
```

If either value changes, redeploy AI Hub from `/var/www/AI_salesman_plugin/aihub.md`.

## Git Recovery

Useful inspection commands:

```bash
cd /var/www/client_panel
git status --short
git stash list --grep=pre-client-panel-deploy
```

If `git pull --ff-only` says the branch has diverged, the server has local commits. Do not force reset from a deploy paste. Inspect with:

```bash
git log --oneline --left-right HEAD...@{u}
```

## Failure Map

```text
Local smoke fails
  -> Check PM2 logs with: pm2 logs client-panel --lines 100

Public URL is 502
  -> PM2 app is not running or Nginx cannot reach 127.0.0.1:5177.

Public URL is 404
  -> Shared Nginx route is missing. Apply /var/www/Vercel_website/aikart.md.

UI still looks old
  -> Rerun steps 7 and 8; build first, then restart PM2.

Login fails
  -> Check AI Hub CLIENT_PANEL_DEFAULT_PASSWORD and CLIENT_PANEL_TOKEN_SECRET, then redeploy AI Hub.
```
