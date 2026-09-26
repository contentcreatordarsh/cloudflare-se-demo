# TLS — Full (strict)

```
Browser ──HTTPS (edge cert, Universal SSL)──▶ Cloudflare ──HTTPS (Let's Encrypt, validated)──▶ Nginx on EC2
```

- Zone SSL/TLS mode: **Full (strict)** · minimum TLS 1.2 · Always Use HTTPS.
- Origin certificates are **not Cloudflare-issued**: Let's Encrypt, one per hostname (`nova.`, `app.`), issued with the
  ACME **DNS-01** challenge against Cloudflare DNS, so port 80 never has to be opened.
- Nginx rejects TLS handshakes for any other SNI (`ssl_reject_handshake on` default server) — e.g. `https://<origin-ip>`.
- Verify: `curl -sI https://nova.strikemap.space` (200) · Cloudflare would return 526 if the origin cert were invalid.
