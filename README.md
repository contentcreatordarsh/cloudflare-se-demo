# SiamPay Edge Console — Cloudflare SE technical assignment

A fictional Thai fintech, **SiamPay**, runs a small origin on AWS and puts Cloudflare in front of it:

| Surface | URL | Cloudflare products |
|---|---|---|
| Partner **Request Inspector** — shows partners exactly what reached our origin | https://app.strikemap.space | DNS + proxy, SSL/TLS Full (strict), rate limiting |
| Staff **identity portal** — internal tool, no inbound ports | https://tunnel.strikemap.space/secure | Tunnel, Zero Trust Access, Workers, R2 |

> SiamPay is a made-up company used to frame the demo.

## Architecture

```
                         Browser
                            │ HTTPS
                            ▼
 ┌──────────────────── Cloudflare edge ─────────────────────┐
 │ app.strikemap.space            tunnel.strikemap.space     │
 │  • proxied A record             • Access app on /secure   │
 │  • rate limit: /headers         • Worker route /secure*   │
 │    5 req / 10 s / IP → 429          └─► R2 (private)      │
 │  • Full (strict) TLS                    flags/<cc>.svg    │
 └────────┬──────────────────────────────────┬──────────────┘
          │ HTTPS :443 (Let's Encrypt cert)  │ outbound-only tunnel
          ▼                                  ▼
 ┌──────────── AWS EC2 t3.micro · ap-southeast-1 ────────────┐
 │ Security group: 443 from Cloudflare IP ranges only        │
 │ Nginx :443 ──► Node.js 127.0.0.1:8080 ◄── cloudflared      │
 └───────────────────────────────────────────────────────────┘
```

## Repository layout

```
origin/     server.js (header-echo app, zero deps), nginx + systemd config, EC2 user-data
worker/     Wrangler project for the /secure Worker (Access JWT verification + R2)
r2/flags/   257 country flag SVGs (flag-icons, MIT) uploaded to the private bucket
scripts/    upload-flags.sh, deploy-origin.sh
```

## How each requirement is met

1. **Domain on Cloudflare** — `strikemap.space`, nameservers `monroe`/`remy.ns.cloudflare.com`.
2. **Origin returning all request headers** — `origin/server.js`. `GET /headers` renders every header (Cloudflare-added ones highlighted); `/headers?format=json` returns JSON.
3. **Proxied through Cloudflare** — `app` A record → EC2 Elastic IP, orange-clouded.
4. **Full (strict) with a non-Cloudflare certificate** — Let's Encrypt cert issued via the **DNS-01** challenge against Cloudflare DNS (no port 80 ever opened), terminated by Nginx.
5. **Rate limiting** — rule on `app.strikemap.space/headers`: 5 requests / 10 s per IP → block for 60 s with a JSON 429.
6. **Cloudflare Tunnel** — remotely-managed tunnel `siampay-origin`, `tunnel.strikemap.space` → `http://localhost:8080`.
7. **SSO IdP** — Cloudflare Zero Trust with One-time PIN (+ Google).
8. **Lock down `/secure`** — Access self-hosted app on `tunnel.strikemap.space/secure`; allow policy = the owner's email **or** any `@cloudflare.com` email.
   **No bypass:** the EC2 security group only admits Cloudflare IP ranges on 443 (SSH from one admin IP), Node listens on loopback, Nginx rejects TLS handshakes for any other hostname (e.g. the raw IP), and the Worker has `workers_dev = false`.
9. **Worker + private R2** — `worker/src/index.js`, deployed with `wrangler deploy`:
   - verifies the `Cf-Access-Jwt-Assertion` JWT (RS256 signature against the team JWKS, issuer, audience, expiry) instead of trusting a plain header;
   - `GET /secure` → HTML: `${EMAIL} authenticated at ${TIMESTAMP} from ${COUNTRY}` — timestamp is the Access login time (JWT `iat`), country is `request.cf.country`, and the country links to `/secure/${COUNTRY}`;
   - `GET /secure/${COUNTRY}` → the flag streamed from the private bucket with `content-type: image/svg+xml`.

## Try it

| Check | How |
|---|---|
| Headers through Cloudflare | open https://app.strikemap.space/headers |
| Rate limit | `for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code} " https://app.strikemap.space/headers; done` → `200 ×5` then `429` |
| Origin bypass blocked | `curl -k -m 5 https://46.137.224.57` → times out |
| Access + Worker + R2 | open https://tunnel.strikemap.space/secure, sign in with an `@cloudflare.com` email (One-time PIN), click the country |
| Spoofed identity rejected | `curl -H "cf-access-authenticated-user-email: x@cloudflare.com" …` never reaches the Worker without a valid Access JWT |

## Deploy it yourself

```bash
# Worker
cd worker && npm install && npx wrangler deploy

# Flags → private R2
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… ./scripts/upload-flags.sh

# Origin (after launching EC2 with origin/bootstrap.sh as user-data)
ORIGIN_IP=<elastic-ip> ./scripts/deploy-origin.sh
```

Secrets (API tokens, the tunnel token, the TLS private key, SSH keys) are never committed.
