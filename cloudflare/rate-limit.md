# Rate limiting

| Rule | Expression | Threshold | Action |
|---|---|---|---|
| NOVA orders API | `http.host eq "nova.strikemap.space" and http.request.method eq "POST" and http.request.uri.path eq "/api/orders"` | 5 req / 10 s per IP + data center | Block 60 s, JSON 429 |
| Console inspector | `http.host eq "app.strikemap.space" and http.request.uri.path eq "/headers"` | 5 req / 10 s per IP + data center | Block 60 s, JSON 429 |

## How to demonstrate it to a customer

1. **Browser (simplest):** sign in to <https://nova.strikemap.space/markets> and press **Submit demo order** six times
   within ten seconds. The first five return an order ID from the origin; the sixth shows Cloudflare's 429 with its
   Ray ID. Nothing in the frontend simulates the limit: it renders the real HTTP response.
2. **Terminal (authenticated):**

   ```bash
   cloudflared access login https://nova.strikemap.space
   export TOKEN=$(cloudflared access token -app=https://nova.strikemap.space)
   for i in {1..10}; do
     curl -s -o /dev/null -w "%{http_code}\n" -H "cf-access-token: $TOKEN" \
       -X POST https://nova.strikemap.space/api/orders \
       -H "Content-Type: application/json" -d '{"symbol":"BTC-USDT","side":"buy","quantity":0.01}'
   done
   # 200 200 200 200 200 429 429 429 429 429
   ```

3. **Terminal (anonymous):** the same loop without the token prints `302 302 302 302 302 429 429 …`. Rate limiting
   runs before Access, so even unauthenticated floods are cut off at the edge.
4. **Evidence:** Security → Events shows each blocked request with the rule name, the client IP and the Ray ID. The
   blocked requests never appear in the origin log.

Also deployed: a WAF custom rule blocking common probes (XSS / SQLi / `/.env` / `/.git` / `wp-login`) with a JSON 403,
and the Cloudflare Managed Ruleset.
