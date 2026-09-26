#!/usr/bin/env bash
# Deploy the origin to EC2: NOVA app (app/, Express), Edge Console (web/dist) + its API (origin/), Nginx config and TLS certs.
# Usage: ORIGIN_IP=1.2.3.4 SSH_KEY=~/.ssh/cf-se-demo.pem ./scripts/deploy-origin.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ORIGIN_IP:?set ORIGIN_IP}"; SSH_KEY="${SSH_KEY:-$HOME/.ssh/cf-se-demo.pem}"
CERT_DIR=".secrets/le/config/live/app.strikemap.space"
NOVA_CERT_DIR=".secrets/le/config/live/nova.strikemap.space"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new ubuntu@$ORIGIN_IP"

echo "› building console"
npm --prefix web run build --silent >/dev/null

echo "› uploading"
COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata -C web -czf - dist | $SSH 'rm -rf /tmp/siampay-dist && mkdir -p /tmp/siampay-dist && tar -C /tmp/siampay-dist -xzf -'
COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata --exclude node_modules -C . -czf - app | $SSH 'rm -rf /tmp/nova-app && mkdir -p /tmp/nova-app && tar -C /tmp/nova-app -xzf -'
scp -q -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$NOVA_CERT_DIR/fullchain.pem" "ubuntu@$ORIGIN_IP:/tmp/nova-fullchain.pem"
scp -q -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$NOVA_CERT_DIR/privkey.pem" "ubuntu@$ORIGIN_IP:/tmp/nova-privkey.pem"
scp -q -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
  origin/server.js origin/siampay.service origin/nginx-siampay.conf \
  "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem" "ubuntu@$ORIGIN_IP:/tmp/"

# CoinMarketCap key: read from the environment or ~/.cf-demo.env and written straight into a root-owned file on the
# host over SSH stdin. It is never echoed, committed or shipped to browsers.
CMC_KEY="${COINMARKETCAP_API_KEY:-$(sed -n -E 's/^(export )?COINMARKETCAP_API_KEY=//p' "$HOME/.cf-demo.env" 2>/dev/null | tail -1 | tr -d "\"' \r")}"
if [ -n "$CMC_KEY" ]; then
  printf 'COINMARKETCAP_API_KEY=%s\n' "$CMC_KEY" | $SSH 'id nova >/dev/null 2>&1 || sudo useradd --system --home /opt/nova --shell /usr/sbin/nologin nova; sudo install -d -m 0750 -o root -g nova /etc/nova && sudo tee /etc/nova/nova.env >/dev/null && sudo chown root:nova /etc/nova/nova.env && sudo chmod 0640 /etc/nova/nova.env'
  echo "› market-data key installed on host"
else
  echo "› COINMARKETCAP_API_KEY not set — market data will show as unavailable"
fi
unset CMC_KEY

echo "› installing"
$SSH 'sudo bash -s' <<'REMOTE'
set -euo pipefail
test -f /var/lib/cloud/instance/siampay-bootstrap-done || { echo "bootstrap not finished yet"; exit 1; }
# API
install -o siampay -g siampay -m 0644 /tmp/server.js /opt/siampay/server.js
rm -rf /opt/siampay/ui.js /opt/siampay/world-map.js /opt/siampay/flags
install -m 0644 /tmp/siampay.service /etc/systemd/system/siampay.service
# Console (atomic swap)
mkdir -p /var/www/siampay
rm -rf /var/www/siampay/dist.new && mv /tmp/siampay-dist/dist /var/www/siampay/dist.new
chown -R root:root /var/www/siampay/dist.new && chmod -R a+rX /var/www/siampay/dist.new
rm -rf /var/www/siampay/dist.old && { [ -d /var/www/siampay/dist ] && mv /var/www/siampay/dist /var/www/siampay/dist.old || true; }
mv /var/www/siampay/dist.new /var/www/siampay/dist
# NOVA app (Express) -> /opt/nova, dependencies installed on the host
id nova >/dev/null 2>&1 || useradd --system --home /opt/nova --shell /usr/sbin/nologin nova
mkdir -p /opt/nova && rsync -a --delete --exclude node_modules /tmp/nova-app/app/ /opt/nova/ 2>/dev/null || cp -a /tmp/nova-app/app/. /opt/nova/
(cd /opt/nova && npm ci --omit=dev --no-audit --no-fund --silent)
chown -R nova:nova /opt/nova
install -m 0644 /opt/nova/nova.service /etc/systemd/system/nova.service
install -d -m 0755 /etc/ssl/nova
install -m 0644 /tmp/nova-fullchain.pem /etc/ssl/nova/fullchain.pem
install -m 0600 /tmp/nova-privkey.pem /etc/ssl/nova/privkey.pem
rm -rf /tmp/nova-app /tmp/nova-fullchain.pem /tmp/nova-privkey.pem
# TLS (fullchain is public; the private key stays root-only)
install -d -m 0755 /etc/ssl/siampay
install -m 0644 /tmp/fullchain.pem /etc/ssl/siampay/fullchain.pem
install -m 0600 /tmp/privkey.pem   /etc/ssl/siampay/privkey.pem
install -m 0644 /tmp/nginx-siampay.conf /etc/nginx/sites-available/siampay
ln -sf /etc/nginx/sites-available/siampay /etc/nginx/sites-enabled/siampay
rm -f /tmp/server.js /tmp/siampay.service /tmp/fullchain.pem /tmp/privkey.pem /tmp/nginx-siampay.conf
rm -rf /tmp/siampay-dist
systemctl daemon-reload
systemctl enable --now siampay >/dev/null 2>&1
systemctl restart siampay
systemctl enable --now nova >/dev/null 2>&1
systemctl restart nova
nginx -t 2>&1 | tail -1 && systemctl reload nginx
sleep 1.5; curl -fsS http://127.0.0.1:8080/healthz >/dev/null && echo "✓ console API healthy"
curl -fsS http://127.0.0.1:3000/healthz >/dev/null && echo "✓ NOVA app healthy"
curl -fsS http://127.0.0.1:3000/api/market | python3 -c "import sys,json; m=json.load(sys.stdin); print(\"✓ market data:\", m[\"status\"], len(m[\"assets\"]), \"assets\")" || true
test -f /var/www/siampay/dist/index.html && echo "✓ console deployed"
REMOTE
