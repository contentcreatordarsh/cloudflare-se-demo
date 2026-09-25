#!/usr/bin/env bash
# Push origin app, Nginx config and TLS cert to the EC2 host and (re)start services.
# Usage: ORIGIN_IP=1.2.3.4 SSH_KEY=~/.ssh/cf-se-demo.pem ./scripts/deploy-origin.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ORIGIN_IP:?set ORIGIN_IP}"; SSH_KEY="${SSH_KEY:-$HOME/.ssh/cf-se-demo.pem}"
CERT_DIR=".secrets/le/config/live/app.strikemap.space"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new ubuntu@$ORIGIN_IP"

scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
  origin/server.js origin/siampay.service origin/nginx-siampay.conf \
  "$CERT_DIR/fullchain.pem" "$CERT_DIR/privkey.pem" "ubuntu@$ORIGIN_IP:/tmp/"

$SSH 'sudo bash -s' <<'REMOTE'
set -euo pipefail
test -f /var/lib/cloud/instance/siampay-bootstrap-done || { echo "bootstrap not finished yet"; exit 1; }
install -o siampay -g siampay -m 0644 /tmp/server.js /opt/siampay/server.js
install -m 0644 /tmp/siampay.service /etc/systemd/system/siampay.service
install -d -m 0750 /etc/ssl/siampay
install -m 0644 /tmp/fullchain.pem /etc/ssl/siampay/fullchain.pem
install -m 0600 /tmp/privkey.pem   /etc/ssl/siampay/privkey.pem
install -m 0644 /tmp/nginx-siampay.conf /etc/nginx/sites-available/siampay
ln -sf /etc/nginx/sites-available/siampay /etc/nginx/sites-enabled/siampay
rm -f /tmp/server.js /tmp/siampay.service /tmp/fullchain.pem /tmp/privkey.pem /tmp/nginx-siampay.conf
systemctl daemon-reload
systemctl enable --now siampay
systemctl restart siampay
nginx -t && systemctl reload nginx
sleep 1; curl -fsS http://127.0.0.1:8080/healthz && echo " <- app healthy"
REMOTE
