# Cloudflare Access

Every NOVA hostname is a self-hosted Access application sharing one reusable policy.

| Application | Covers | Policy | Login |
|---|---|---|---|
| NOVA Public App | `nova.strikemap.space` (entire host) | **NOVA Staff**: the owner's email **or** any `@cloudflare.com` email | One-time PIN |
| NOVA Edge Console | `app.strikemap.space` (entire host) | **NOVA Staff** | One-time PIN |
| NOVA Staff Portal | `tunnel.strikemap.space` (entire host, incl. `/secure` and `/secure/<CC>`) | **NOVA Staff** | One-time PIN |

- **Identity provider:** Zero Trust → Settings → Authentication → **One-time PIN**. Access emails a 6-digit code;
  a code is only sent to addresses that match the policy, so other addresses never get in.
- **Session:** 24 h per application; signing in to one NOVA app gives a seamless redirect into the others.
- **Order of evaluation:** WAF custom rules and rate limiting run *before* Access, so anonymous traffic is filtered
  (403 / 429) before it ever reaches the login page.
- **Defence in depth on the staff path:** the Worker verifies the `Cf-Access-Jwt-Assertion` JWT itself (RS256
  signature against the team JWKS at `/cdn-cgi/access/certs`, issuer, audience, expiry), and the origin verifies it
  **again** before returning staff data from `/internal/staff-status`.
- **Terminal access** (API demos): `cloudflared access login https://nova.strikemap.space`, then send
  `cf-access-token: $(cloudflared access token -app=https://nova.strikemap.space)` with each request.
- **Audit trail:** Zero Trust → Logs → Access.
