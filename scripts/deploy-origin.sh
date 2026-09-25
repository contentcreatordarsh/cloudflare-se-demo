#!/usr/bin/env bash
# Deploy the SiamPay origin to EC2: React console (web/dist), Node API, Nginx config and TLS cert.
# Usage: ORIGIN_IP=1.2.3.4 SSH_KEY=~/.ssh/cf-se-demo.pem ./scripts/deploy-origin.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ORIGIN_IP:?set ORIGIN_IP}"; SSH_KEY="${SSH_KEY:-$HOME/.ssh/cf-se-demo.pem}"
CERT_DIR=".secrets/le/config/live/app.strikemap.space"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new ubuntu@$ORIGIN_IP"

echo "› building console"
npm --prefix web run build --silent >/dev/null

echo "› uploading"
COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata -C web -czf - dist | $SSH 'rm -rf /tmp/siampay-dist && mkdir -p /tmp/siampay-dist && tar -C /tmp/siampay-dist -xzf -'
scp -q -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
  origin/server.js origin/siampay.service origin/nginx-siampay.conf \
  "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem" "ubuntu@$ORIGIN_IP:/tmp/"

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
nginx -t 2>&1 | tail -1 && systemctl reload nginx
sleep 1; curl -fsS http://127.0.0.1:8080/healthz >/dev/null && echo "✓ API healthy"
test -f /var/www/siampay/dist/index.html && echo "✓ console deployed"
REMOTE
