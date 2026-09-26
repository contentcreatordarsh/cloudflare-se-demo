// NOVA public app — small progressive enhancements. Nothing here simulates Cloudflare behaviour or market prices:
// the rate-limit state is rendered from the real HTTP 429 the Cloudflare edge returns, and every price comes from
// GET /api/market (the NOVA origin's CoinMarketCap cache). If that fails we keep the last real values and say so.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);

  // ---- live status from /healthz ----
  async function health() {
    let ok = false;
    try { ok = (await (await fetch("/healthz", { cache: "no-store" })).json()).status === "ok"; } catch {}
    $$("[data-live-status]").forEach((el) => { el.classList.toggle("down", !ok); $("span", el).textContent = ok ? "System operational" : "Degraded"; });
    $$("[data-op]").forEach((el) => el.classList.toggle("down", !ok));
    const all = $("[data-all-status]");
    if (all) { all.classList.toggle("down", !ok); all.lastChild.textContent = ok ? "All systems operational" : "Service degraded"; }
  }
  health();
  setInterval(() => { if (!document.hidden) health(); }, 15000);

  // ---- live market data ----
  const DASH = "—";
  const isNum = Number.isFinite;
  const fmtPrice = (p) => {
    if (!isNum(p)) return DASH;
    const d = p >= 1 ? 2 : 4;
    return `$${p.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
  };
  const fmtChange = (c) => (isNum(c) ? `${c >= 0 ? "▲" : "▼"} ${Math.abs(c).toFixed(2)}%` : DASH);
  const dir = (c) => (isNum(c) ? (c >= 0 ? "up" : "down") : "");
  const fmtBig = (v) => (!isNum(v) ? DASH : v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString("en-US")}`);
  const fmtTime = (iso) => (iso ? `${new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} SGT` : DASH);
  const sparkPath = (pts, w = 120, h = 36, pad = 2) => {
    if (!pts || pts.length < 2) return "";
    const ts = pts.map((p) => p[0]), ps = pts.map((p) => p[1]);
    const t0 = Math.min(...ts), t1 = Math.max(...ts), lo = Math.min(...ps), hi = Math.max(...ps);
    const x = (t) => pad + ((t - t0) / (t1 - t0 || 1)) * (w - pad * 2);
    const y = (p) => h - pad - ((p - lo) / (hi - lo || 1)) * (h - pad * 2);
    return pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join("");
  };
  const STATE_TEXT = { live: "Live", updating: "Updating…", delayed: "Market data delayed", unavailable: "Market data unavailable" };

  let market = null; // last real /api/market document
  const setState = (state) => $$("[data-mkt-state]").forEach((el) => { el.className = `mkt-state ${state}`; $("span", el).textContent = STATE_TEXT[state]; });
  const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

  function paintAsset(a) {
    $$(`[data-asset="${a.symbol}"]`).forEach((root) => {
      const price = $("[data-price]", root);
      if (price) {
        const prev = Number(price.dataset.v);
        const next = fmtPrice(a.price);
        if (price.textContent !== next) {
          price.textContent = next;
          if (isNum(prev) && prev !== a.price) { price.classList.remove("tick-up", "tick-down"); void price.offsetWidth; price.classList.add(a.price > prev ? "tick-up" : "tick-down"); }
        }
        price.dataset.v = a.price;
      }
      const chg = $("[data-chg]", root);
      if (chg) { setText(chg, fmtChange(a.change24h)); chg.classList.remove("up", "down"); if (dir(a.change24h)) chg.classList.add(dir(a.change24h)); }
      setText($("[data-upd]", root), fmtTime(a.updatedAt));
      setText($("[data-vol]", root), fmtBig(a.volume24h));
      setText($("[data-cap]", root), fmtBig(a.marketCap));
      const line = $("[data-spark]", root);
      if (line) {
        const d = sparkPath(a.sparkline);
        line.setAttribute("d", d);
        $("[data-spark-area]", root)?.setAttribute("d", d ? `${d}L118 36L2 36Z` : "");
        const svg = line.ownerSVGElement;
        svg.classList.remove("up", "down");
        if (dir(a.change24h)) svg.classList.add(dir(a.change24h));
      }
    });
  }

  function paintVolume(assets) {
    const card = $("[data-vol-card]");
    if (!card) return;
    const vols = assets.filter((a) => isNum(a.volume24h));
    const total = vols.reduce((s, a) => s + a.volume24h, 0);
    const prev = vols.reduce((s, a) => s + (isNum(a.volumeChange24h) ? a.volume24h / (1 + a.volumeChange24h / 100) : a.volume24h), 0);
    const chg = total && prev ? (total / prev - 1) * 100 : null;
    setText($("[data-vol-total]", card), vols.length ? fmtBig(total) : DASH);
    const c = $("[data-vol-chg]", card);
    setText(c, isNum(chg) ? fmtChange(chg) : "");
    c.classList.remove("up", "down"); if (dir(chg)) c.classList.add(dir(chg));
    const max = Math.max(1, ...vols.map((a) => a.volume24h));
    vols.forEach((a) => {
      const bar = $(`[data-bar="${a.symbol}"]`, card);
      if (!bar) return;
      const h = Math.max(2, (a.volume24h / max) * 56);
      bar.setAttribute("height", h.toFixed(1));
      bar.setAttribute("y", (60 - h).toFixed(1));
    });
  }

  function paintOps(status) {
    $$("[data-mkt-op]").forEach((el) => {
      el.classList.toggle("down", status === "unavailable");
      el.classList.toggle("warn", status === "delayed");
      el.lastChild.textContent = status === "live" ? "Live" : status === "delayed" ? "Delayed" : "Unavailable";
    });
  }

  function paint(m) {
    m.assets.forEach(paintAsset);
    if (!m.assets.length) $$("[data-asset] [data-price]").forEach((el) => setText(el, DASH)); // never a made-up price
    paintVolume(m.assets);
    $$("[data-mkt-updated]").forEach((el) => setText(el, m.updatedAt ? `Updated ${fmtTime(m.updatedAt)}` : "Waiting for market data"));
    setState(m.status === "live" ? "live" : m.status === "delayed" ? "delayed" : "unavailable");
    paintOps(m.status);
    updateRef();
  }

  let loading = false;
  async function loadMarket() {
    if (loading || !$("[data-mkt-state], [data-asset], [data-mkt-op], [data-ref-price]")) return;
    loading = true;
    setState("updating");
    let m = null;
    try {
      const r = await fetch("/api/market", { cache: "no-store", headers: { accept: "application/json" } });
      if (r.ok) m = await r.json();
    } catch {}
    loading = false;
    if (m && Array.isArray(m.assets)) { market = m; paint(m); return; }
    // Could not reach NOVA: keep the last real values on screen, but never call them live.
    setState(market && market.assets.length ? "delayed" : "unavailable");
    paintOps(market && market.assets.length ? "delayed" : "unavailable");
  }
  loadMarket();
  setInterval(() => { if (!document.hidden) loadMarket(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loadMarket(); });

  // ---- demo order form -> POST /api/orders (real request, real edge rate limit, never executed) ----
  const form = $("#order-form");
  const out = $("#order-result");
  function updateRef() {
    if (!form) return;
    const sym = form.symbol.value.split("-")[0];
    const a = market?.assets.find((x) => x.symbol === sym);
    const qty = Number(form.quantity.value);
    setText($("[data-ref-price]", form), a ? fmtPrice(a.price) : DASH);
    setText($("[data-ref-value]", form), a && isNum(qty) && qty > 0 ? fmtPrice(a.price * qty) : DASH);
  }
  if (form && out) {
    form.symbol.addEventListener("change", updateRef);
    form.quantity.addEventListener("input", updateRef);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      const body = { symbol: form.symbol.value, side: form.side.value, quantity: Number(form.quantity.value) };
      try {
        const r = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body), cache: "no-store" });
        const ray = r.headers.get("cf-ray");
        const j = await r.json().catch(() => ({}));
        if (r.status === 429) {
          out.innerHTML = `<div class="state rl"><p class="kicker bad">Request rate limited</p><h3>Too many requests.</h3>
            <p>The NOVA API is protected by an edge rate limit. This request was rejected by Cloudflare before it reached the Node.js origin.</p>
            <div class="kvs"><div><small>HTTP</small><b class="num">429</b></div><div><small>Request ID</small><span class="mono">${esc(ray || "—")}</span></div></div>
            <a class="ghost small" href="/api">Return to API →</a></div>`;
        } else if (r.ok) {
          out.innerHTML = `<div class="state okst"><p class="kicker ok">Demo order accepted · not executed</p><h3 class="mono">${esc(j.order_id)}</h3>
            <div class="kvs"><div><small>Market</small>${esc(String(j.symbol).replace("-", " / "))}</div><div><small>Side</small>${esc(String(j.side).toUpperCase())}</div><div><small>Quantity</small><span class="num">${esc(j.quantity)}</span></div>
            <div><small>Reference price</small><span class="num">${j.reference_price_usd != null ? esc(fmtPrice(j.reference_price_usd)) : "Unavailable"}</span></div><div><small>Origin</small>AWS Singapore</div><div><small>Ray ID</small><span class="mono">${esc(ray || "—")}</span></div></div>
            <p class="warn-note">Demo environment · no real trade was executed.</p></div>`;
        } else {
          out.innerHTML = `<div class="state"><p class="kicker bad">Order rejected · HTTP ${r.status}</p><p class="mono">${esc(j.error || "error")}</p></div>`;
        }
      } catch {
        out.innerHTML = `<div class="state"><p class="kicker bad">Network error</p><p>Could not reach the NOVA API.</p></div>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---- copy buttons ----
  $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1400); } catch {}
  }));
})();
