# NOVA — Cloudflare SE technical project

**NOVA** is a fictional Singapore digital-asset / trading platform. Its application is a deliberately simple
Node.js service on **AWS EC2 in ap-southeast-1**; Cloudflare becomes the security and connectivity control plane
around it.

> NOVA is a made-up company used to frame the demo. No real trading, balances or market data.

## URL map

| Purpose | URL |
|---|---|
| **Public NOVA application** (Express on EC2) | https://nova.strikemap.space · [`/headers`](https://nova.strikemap.space/headers) · [`/healthz`](https://nova.strikemap.space/healthz) · [`/api/orders`](https://nova.strikemap.space/api/orders) |
| **Private staff application** (Access → Worker → Tunnel → EC2) | https://tunnel.strikemap.space · https://tunnel.strikemap.space/secure |
| **NOVA Edge Console** (presentation layer) | https://app.strikemap.space |

## Architecture

```
                    GLOBAL USERS
                         │
                         ▼
 ┌───────────────────── CLOUDFLARE ───────────────────────┐
 │ DNS / proxy · Full (strict) TLS · WAF · DDoS            │
 │ Rate limiting (/api/orders, /headers) · Access · Worker │
 └──────────┬──────────────────────────────┬──────────────┘
            │ nova.strikemap.space         │ tunnel.strikemap.space
            │ HTTPS, Let's Encrypt origin  │ Access (whole host) → Worker (/secure*)
            │                              │   └─► private R2 (nova-country-flags)
            ▼                              ▼ outbound-only Cloudflare Tunnel
 ┌──────────── AWS EC2 t3.micro · ap-southeast-1 ─────────────┐
 │ Security group: 443 from Cloudflare IP ranges · SSH admin IP │
 │ Nginx :443 ─► Express 127.0.0.1:3000 ◄─ cloudflared          │
 └──────────────────────────────────────────────────────────────┘
```

## What each piece does

| Requirement | Implementation |
|---|---|
| Origin returning request headers | `app/routes/headers.js` — `curl` gets JSON of every header; browsers get the NOVA Request Inspector (Ray ID, edge, country, TLS, origin, raw headers) |
| Proxy through Cloudflare | `nova` A record, orange-clouded ([cloudflare/dns.md](cloudflare/dns.md)) |
| Full (strict) with a non-Cloudflare cert | Let's Encrypt via DNS-01, Nginx terminates TLS ([cloudflare/tls.md](cloudflare/tls.md)) |
| Rate limiting | `/api/orders`: 5 req / 10 s per IP → 429 ([cloudflare/rate-limit.md](cloudflare/rate-limit.md)) |
| Cloudflare Tunnel | `tunnel.strikemap.space` → `localhost:3000` ([cloudflare/tunnel.md](cloudflare/tunnel.md)) |
| SSO / Access | One-time PIN; policy **NOVA Staff** = owner or `@cloudflare.com` ([cloudflare/access.md](cloudflare/access.md)) |
| Worker | `worker/src/index.js` — verifies the Access JWT, renders `${EMAIL} authenticated at ${TIMESTAMP} from ${COUNTRY}` (HTML), calls EC2 **through the Tunnel** for live origin/tunnel status (the origin re-verifies the JWT), `/secure/<CC>` streams the flag |
| Private R2 | `nova-country-flags`, keys `SG.svg` …, no public access ([cloudflare/r2.md](cloudflare/r2.md)) |
| Origin lockdown | Direct `http(s)://<origin-ip>` times out; apps listen on loopback only |

## Seven-step live demo

1. **Public application** — open https://nova.strikemap.space/headers (request, Ray ID, country, TLS, origin, status).
2. **Full (strict) TLS** — Browser → HTTPS → Cloudflare → HTTPS (validated Let's Encrypt cert) → EC2.
3. **Rate limiting** — `for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" https://nova.strikemap.space/api/orders; done` → `200 ×5`, then `429`.
4. **Tunnel + Access** — open https://tunnel.strikemap.space → Access login.
5. **Worker identity** — after login: email, country, timestamp (SGT), policy, live Tunnel/origin status.
6. **Private R2** — click the country → Worker reads `SG.svg` from the private bucket.
7. **Origin bypass** — `curl -m 5 http://<origin-ip>` → times out.

## The Edge Console (app.strikemap.space)

React + Vite + TypeScript (Tailwind, Lucide, Recharts), Cloudflare-inspired charcoal/orange design. It visualises the
real controls — every interactive demo (request trace, WAF 403, rate-limit 429, TLS, tunnel health, Access identity,
origin log) is **live**. KPI totals, traffic mix, globe RTTs, the failover drill and the attack animation are labelled
**Simulated / Demo**. Includes Security, Resiliency and Production-readiness panels and **Edge Economics**: an
illustrative edge-handled vs origin-bound traffic model with an AWS-native vs Cloudflare + AWS comparison that names
no winner.

## Repository layout

```
app/          NOVA public application (Express): server.js, routes/, lib/edge.js, public/
worker/       /secure* Worker (Wrangler)
r2/flags/     country flags (flag-icons, MIT) → uploaded to the private bucket
cloudflare/   dns · tls · rate-limit · tunnel · access · r2 runbooks
web/          NOVA Edge Console (React/Vite)
origin/       Edge Console API (Node), Nginx + systemd config, EC2 user-data
scripts/      deploy-origin.sh (build + ship app, console, Nginx, certs), upload-flags.sh
```

## Deploy

```bash
cd web && npm install && cd ..
ORIGIN_IP=<elastic-ip> ./scripts/deploy-origin.sh      # app/ + console + Nginx + certs
cd worker && npx wrangler deploy                        # /secure Worker
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… ./scripts/upload-flags.sh
```

Secrets (API tokens, tunnel token, TLS private keys, SSH keys) are never committed.
