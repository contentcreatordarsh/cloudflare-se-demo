const { Router } = require("express");
const os = require("os");
const { edgeInfo, verifyAccessJwt, tunnelStatus } = require("../lib/edge");

// GET /internal/staff-status — called by the /secure Worker *through Cloudflare Tunnel*.
// It only answers requests that (a) arrived via cloudflared and (b) carry a valid Cloudflare Access JWT,
// so the staff data proves the full chain: Access -> Worker -> Tunnel -> EC2.
const router = Router();
const started = Date.now();

router.get("/internal/staff-status", async (req, res) => {
  const e = edgeInfo(req);
  if (!e.viaTunnel) return res.status(404).json({ error: "not_found" });
  let claims;
  try {
    claims = await verifyAccessJwt(req.headers["cf-access-jwt-assertion"]);
  } catch (err) {
    return res.status(403).json({ error: "access_required", detail: err.message });
  }
  const tunnel = await tunnelStatus();
  res.set("cache-control", "no-store").json({
    identity: { email: claims.email, verified_by: "Cloudflare Access (JWT verified on origin)" },
    origin: {
      service: "nova-origin",
      provider: "AWS EC2",
      region: "ap-southeast-1",
      host: os.hostname(),
      node: process.version,
      uptime_s: Math.round((Date.now() - started) / 1000),
      healthy: true,
    },
    connection: { via: "Cloudflare Tunnel (cloudflared)", tunnel },
    received_at: new Date().toISOString(),
  });
});

module.exports = router;
