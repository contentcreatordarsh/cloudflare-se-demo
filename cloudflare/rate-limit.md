# Rate limiting

| Rule | Expression | Threshold | Action |
|---|---|---|---|
| NOVA orders API | `http.host eq "nova.strikemap.space" and http.request.uri.path eq "/api/orders"` | 5 req / 10 s per IP + data center | Block 60 s, JSON 429 |
| Console inspector | `http.host eq "app.strikemap.space" and http.request.uri.path eq "/headers"` | 5 req / 10 s per IP + data center | Block 60 s, JSON 429 |

Demo:

```bash
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" https://nova.strikemap.space/api/orders; done
# 200 200 200 200 200 429 429 429 429 429
```

The blocked requests never reach the origin (they are absent from the origin's request log).

Also deployed: a WAF custom rule blocking common probes (XSS / SQLi / `/.env` / `/.git` / `wp-login`) with a JSON 403,
and the Cloudflare Managed Ruleset.
