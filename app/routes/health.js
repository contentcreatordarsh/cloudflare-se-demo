const { Router } = require("express");
const { edgeInfo } = require("../lib/edge");

const router = Router();
const started = Date.now();

router.get("/healthz", (req, res) => {
  const e = edgeInfo(req);
  res.json({
    status: "ok",
    service: "nova-origin",
    region: "ap-southeast-1",
    uptime_s: Math.round((Date.now() - started) / 1000),
    edge: e.proxied ? { ray: e.ray, colo: e.colo } : null,
  });
});

module.exports = router;
