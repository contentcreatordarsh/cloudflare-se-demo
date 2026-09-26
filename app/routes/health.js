const { Router } = require("express");

// GET /healthz — fast, no dependencies on external services.
const router = Router();

router.get("/healthz", (req, res) => {
  res.set("cache-control", "no-store").json({ status: "ok", service: "nova-origin", region: "ap-southeast-1" });
});

module.exports = router;
