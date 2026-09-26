# Cloudflare Tunnel

- Remotely-managed tunnel, `cloudflared` running as a systemd service on the EC2 instance.
- Ingress: `tunnel.strikemap.space` → `http://localhost:3000` (the NOVA Express app on loopback).
- `cloudflared` keeps several outbound connections to different Cloudflare data centers (e.g. SIN11/15/17/20);
  the console reads them from the local metrics endpoint (`127.0.0.1:20241/metrics`).
- No inbound port is needed for this path. Production recommendation: a second connector in another AZ.
