// Shows this request's real Cloudflare Ray ID / edge and the origin's health.
(async () => {
  const el = document.getElementById("live-text");
  const box = document.getElementById("live");
  try {
    const r = await fetch("/healthz", { cache: "no-store" });
    const j = await r.json();
    const edge = j.edge ? `Ray ${j.edge.ray} · edge ${j.edge.colo}` : "direct to origin";
    el.textContent = `Origin ${j.status.toUpperCase()} · ${j.service} · ${j.region} · ${edge}`;
    box.classList.add("ok");
  } catch {
    el.textContent = "Origin unreachable";
    box.classList.add("bad");
  }
})();
