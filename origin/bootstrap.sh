#!/usr/bin/env bash
# EC2 user-data: base packages for the SiamPay origin (Ubuntu 24.04).
# App code, TLS cert and tunnel token are installed afterwards by scripts/deploy-origin.sh.
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg nginx

# Node.js 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# cloudflared (Cloudflare apt repo)
mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  > /etc/apt/sources.list.d/cloudflared.list
apt-get update
apt-get install -y cloudflared

# App user + directory
id siampay >/dev/null 2>&1 || useradd --system --home /opt/siampay --shell /usr/sbin/nologin siampay
mkdir -p /opt/siampay && chown siampay:siampay /opt/siampay

# Nothing listens publicly except Nginx on 443 (configured later); drop the default site.
rm -f /etc/nginx/sites-enabled/default
systemctl reload nginx || true

touch /var/lib/cloud/instance/siampay-bootstrap-done
