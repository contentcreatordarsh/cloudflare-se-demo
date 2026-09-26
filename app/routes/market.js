const { Router } = require("express");
const market = require("../lib/market");

// GET /api/market — normalised, cached CoinMarketCap data. The only market endpoint the browser ever calls.
const router = Router();

router.get("/api/market", async (req, res, next) => {
  try {
    res.set("cache-control", "no-store").json(await market.current());
  } catch (e) {
    next(e);
  }
});

module.exports = router;
