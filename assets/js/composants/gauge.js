// =========================================================
// S@FE CRM — Composant jauge SVG circulaire
// CSS : assets/style.css (.gauge-svg, .gauge-track, .gauge-fill, .gauge-text)
// =========================================================

function gaugeSvg(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  // stroke-dasharray/dashoffset sont des valeurs calculées : inline obligatoire.
  return `<svg viewBox="0 0 100 100" class="gauge-svg">
    <defs>
      <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a1628"/>
        <stop offset="40%" stop-color="#2563eb"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="${r}" class="gauge-track"></circle>
    <circle cx="50" cy="50" r="${r}" class="gauge-fill" style="stroke:url(#gaugeGrad);stroke-dasharray:${c.toFixed(2)};stroke-dashoffset:${offset.toFixed(2)}"></circle>
    <text x="50" y="50" class="gauge-text">${Math.round(pct)}%</text>
  </svg>`;
}
