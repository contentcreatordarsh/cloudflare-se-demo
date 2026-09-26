# Rate limiting

| Rule | Expression | Threshold | Action |
|---|---|---|---|
| NOVA orders API | `http.host eq "nova.strikemap.space" and http.request.method eq "POST" and http.request.uri.path eq "/api/orders"` | 5 req / 10 s per IP + data center | Block 60 s, JSON 429 |
| Console inspector | `http.host eq "app.strikemap.space" and http.request.uri.path eq "/headers"` | 5 req / 10 s per IP + data center | Block 60 s, JSON 429 |

Demo:

```bash
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://nova.strikemap.space/api/orders \
    -H "Content-Type: application/json" -d '{"symbol":"BTC-USDT","side":"buy","quantity":0.01}'
done
# 200 200 200 200 200 429 429 429 429 429
```

The blocked requests never reach the origin. The NOVA UI (`/markets` → Submit demo order) renders the real 429 with its Ray ID; nothing in the frontend simulates the limit.

Also deployed: a WAF custom rule blocking common probes (XSS / SQLi / `/.env` / `/.git` / `wp-login`) with a JSON 403,
and the Cloudflare Managed Ruleset.
