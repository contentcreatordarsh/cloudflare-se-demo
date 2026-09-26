// NOVA public app — small progressive enhancements. Nothing here simulates Cloudflare behaviour:
// the rate-limit state below is rendered from the real HTTP 429 that the Cloudflare edge returns.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // ---- simulated market ticker: tiny drift around the demo price ----
  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!reduced) {
    setInterval(() => {
      if (document.hidden) return;
      $$("[data-market]").forEach((m) => {
        const base = Number(m.dataset.price);
        const p = base * (1 + (Math.random() - 0.5) * 0.0012);
        const out = $("[data-price-out]", m);
        out.textContent = `${m.dataset.ccy}${fmt(p)}`;
        out.classList.remove("tick-up", "tick-down");
        void out.offsetWidth;
        out.classList.add(p >= base ? "tick-up" : "tick-down");
      });
    }, 3500);
  }

  // ---- demo order form -> POST /api/orders (real request, real edge rate limit) ----
  const form = $("#order-form");
  const out = $("#order-result");
  if (form && out) {
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
          out.innerHTML = `<div class="state okst"><p class="kicker ok">Order accepted</p><h3 class="mono">${esc(j.order_id)}</h3>
            <div class="kvs"><div><small>Symbol</small>${esc(j.symbol)}</div><div><small>Side</small>${esc(String(j.side).toUpperCase())}</div><div><small>Quantity</small><span class="num">${esc(j.quantity)}</span></div>
            <div><small>Origin</small>AWS Singapore</div><div><small>Status</small>${esc(String(j.status).toUpperCase())}</div><div><small>Ray ID</small><span class="mono">${esc(ray || "—")}</span></div></div>
            <p class="warn-note">Demo — no real trade executed.</p></div>`;
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
