# Cloudflare Access

| Application | Covers | Policy | Login |
|---|---|---|---|
| NOVA Staff Portal | `tunnel.strikemap.space` (entire host) | **NOVA Staff** — the owner's email or any `@cloudflare.com` email | One-time PIN |

- Every path on the staff host (including `/secure`, `/secure/<CC>`, the internal status route) requires Access.
- The Worker verifies the `Cf-Access-Jwt-Assertion` JWT (RS256 signature against the team JWKS, issuer, audience,
  expiry); the origin verifies it **again** before returning staff data (defence in depth).
- Audit trail: Zero Trust → Logs → Access.
