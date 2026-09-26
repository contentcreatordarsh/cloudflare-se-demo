# DNS — zone `strikemap.space` (Cloudflare nameservers `monroe` / `remy`)

| Hostname | Type | Target | Proxy | Purpose |
|---|---|---|---|---|
| `nova.strikemap.space` | A | EC2 Elastic IP (ap-southeast-1) | Proxied | Public NOVA application (Express) |
| `app.strikemap.space` | A | EC2 Elastic IP | Proxied | NOVA Edge Console (presentation layer) |
| `tunnel.strikemap.space` | CNAME | `<tunnel-id>.cfargotunnel.com` | Proxied | Private staff app via Cloudflare Tunnel |

All records are orange-clouded: clients only ever see Cloudflare anycast IPs, never the origin IP.
