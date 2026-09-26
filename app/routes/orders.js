const { Router } = require("express");
const crypto = require("crypto");
const { edgeInfo } = require("../lib/edge");

// POST /api/orders — demo order API. No real trading, balances or market data.
// It exists so Cloudflare's rate-limiting rule has a realistic, sensitive endpoint to protect.
const router = Router();
const SYMBOLS = new Set(["BTC-USDT", "ETH-USDT", "SOL-USDT", "BTC-SGD"]);

router.post("/api/orders", (req, res) => {
  const { symbol = "BTC-USDT", side = "buy", quantity = 0.01 } = req.body || {};
  const qty = Number(quantity);
  const s = String(side).toLowerCase();
  if (!SYMBOLS.has(String(symbol))) return res.status(400).json({ error: "invalid_symbol", allowed: [...SYMBOLS] });
  if (s !== "buy" && s !== "sell") return res.status(400).json({ error: "invalid_side", allowed: ["buy", "sell"] });
  if (!Number.isFinite(qty) || qty <= 0 || qty > 1000) return res.status(400).json({ error: "invalid_quantity", range: "0 < quantity <= 1000" });

  res.json({
    status: "accepted",
    order_id: `NOVA-DEMO-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    symbol,
    side: s,
    quantity: qty,
    environment: "demo",
    origin: "AWS EC2 · ap-southeast-1",
    received_at: new Date().toISOString(),
    cf_ray: edgeInfo(req).ray,
  });
});

router.all("/api/orders", (req, res) => {
  res.set("allow", "POST").status(405).json({ error: "method_not_allowed", hint: "POST /api/orders with JSON {symbol, side, quantity}" });
});

module.exports = router;
