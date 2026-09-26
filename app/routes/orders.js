const { Router } = require("express");
const { edgeInfo } = require("../lib/edge");

// Demo trading endpoint — no real orders, balances or market data. It exists so the rate-limiting
// rule has a realistic, sensitive API to protect: nova.strikemap.space/api/orders.
const router = Router();
let seq = 0;

function accept(req, res) {
  const e = edgeInfo(req);
  seq = (seq % 999) + 1;
  res.json({
    status: "accepted",
    order_id: `NOVA-DEMO-${String(seq).padStart(3, "0")}`,
    symbol: "BTC-USDT",
    side: "buy",
    quantity: 0.01,
    environment: "demo",
    received_at: new Date().toISOString(),
    cf_ray: e.ray,
  });
}

router.get("/api/orders", accept);
router.post("/api/orders", accept);

module.exports = router;
