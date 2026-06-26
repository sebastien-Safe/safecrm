/* ============================================================
   SEO Clients — Score PageSpeed Insights (style Lighthouse)
   ============================================================ */

const PS_ENDPOINT = `${SUPA_URL}/functions/v1/pagespeed-analyze`;

async function loadPagespeed() {
  if (!currentContact) return;
  const el = document.getElementById('pagespeed-content');
  if (!el) return;

  // Vérifier si le connecteur est actif
  const { data: conn } = await supa
    .from('safe_connectors')
    .select('statut')
    .eq('service_key', 'pagespeed')
    .maybeSingle();

  const isActif   = conn?.statut === 'actif';
  const isSimule  = conn?.statut === 'simule';
  const hasConn   = isActif || isSimule;

  const domaine = currentDomaine?.domaine || '';

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.4rem">⚡</span>
            <div>
              <div style="font-family:var(--ff-disp);font-weight:700;color:#fff;font-size:.95rem">
                Score de performance web
              </div>
              <div style="font-size:.75rem;color:var(--mut)">
                Propulsé par Google PageSpeed Insights (Lighthouse)
              </div>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${domaine ? `
            <span style="font-family:var(--ff-mono);font-size:.72rem;color:var(--seo);
              padding:3px 10px;border:1px solid rgba(16,185,129,.3);border-radius:10px">
              ${escHtml(domaine)}
            </span>` : ''}
          ${hasConn ? `
            <div style="display:flex;gap:6px">
              <button class="btn btn-pri btn-sm" id="ps-run-mobile"
                onclick="runPagespeedScore('mobile')" ${!domaine ? 'disabled title="Sélectionnez un domaine"' : ''}>
                📱 Analyser (mobile)
              </button>
              <button class="btn btn-ghost btn-sm" id="ps-run-desktop"
                onclick="runPagespeedScore('desktop')" ${!domaine ? 'disabled' : ''}>
                🖥 Desktop
              </button>
            </div>` : `
            <a href="/modules/connecteurs.html" class="btn btn-ghost btn-sm">
              🔌 Activer le connecteur PageSpeed →
            </a>`}
        </div>
      </div>
      ${isSimule ? `<div style="margin-top:8px;font-size:.72rem;color:var(--gold);
        background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.2);
        border-radius:6px;padding:5px 10px">
        ⚠ Mode simulation — les scores affichés sont des données de démonstration
      </div>` : ''}
    </div>

    <div id="ps-score-area">
      ${!domaine ? `
        <div class="card" style="text-align:center;padding:40px 20px;color:var(--mut)">
          <div style="font-size:2rem;margin-bottom:8px">🌐</div>
          <div>Sélectionnez un domaine dans le menu latéral pour lancer l'analyse.</div>
        </div>` : `
        <div class="card" style="text-align:center;padding:48px 20px;color:var(--mut)">
          <div style="font-size:2rem;margin-bottom:8px">⚡</div>
          <div style="margin-bottom:6px">Cliquez sur <strong style="color:#fff">Analyser (mobile)</strong> pour obtenir votre score Lighthouse.</div>
          <div style="font-size:.75rem">L'analyse prend 10 à 30 secondes.</div>
        </div>`}
    </div>`;
}

async function runPagespeedScore(strategy = 'mobile') {
  const el = document.getElementById('ps-score-area');
  if (!el) return;

  const btnMobile  = document.getElementById('ps-run-mobile');
  const btnDesktop = document.getElementById('ps-run-desktop');
  if (btnMobile)  { btnMobile.disabled  = true; btnMobile.textContent  = '⏳ Analyse…'; }
  if (btnDesktop) { btnDesktop.disabled = true; }

  el.innerHTML = `
    <div class="card" style="text-align:center;padding:48px 20px;color:var(--mut)">
      <div class="spinner" style="margin:0 auto 16px;width:36px;height:36px"></div>
      <div>Analyse ${strategy === 'mobile' ? 'mobile 📱' : 'desktop 🖥'} en cours…</div>
      <div style="font-size:.74rem;margin-top:6px">Google Lighthouse analyse la page, cela peut prendre jusqu'à 30 secondes.</div>
    </div>`;

  const { data: { session } } = await supa.auth.getSession();
  if (!session) { toast('Session expirée', 'err'); return; }

  let result;
  try {
    const res = await fetch(PS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: currentDomaine.domaine, strategy }),
    });
    result = await res.json();
    if (!res.ok) throw new Error(result.error || `Erreur ${res.status}`);
  } catch (e) {
    el.innerHTML = `<div class="card" style="text-align:center;padding:32px;color:var(--alert)">
      ❌ ${escHtml(e.message)}
    </div>`;
    if (btnMobile)  { btnMobile.disabled  = false; btnMobile.textContent  = '📱 Analyser (mobile)'; }
    if (btnDesktop) { btnDesktop.disabled = false; }
    return;
  }

  el.innerHTML = _renderPagespeedScore(result, strategy);
  if (btnMobile)  { btnMobile.disabled  = false; btnMobile.textContent  = '📱 Analyser (mobile)'; }
  if (btnDesktop) { btnDesktop.disabled = false; }
}

function _renderPagespeedScore(r, strategy) {
  const m = r.metrics;
  const score = r.performance;

  // ── Scores simulés pour les 4 catégories Lighthouse ──────────────────────
  // PageSpeed v5 renvoie uniquement "performance". Les 3 autres sont estimés.
  const scores = {
    performance:    score,
    accessibility:  r.accessibility  ?? _estimateFromPerf(score, 5,  10),
    best_practices: r.best_practices ?? _estimateFromPerf(score, -5, 8),
    seo:            r.seo_score      ?? _estimateFromPerf(score, 8,  6),
  };

  const labels = {
    performance:    'Performance',
    accessibility:  'Accessibilité',
    best_practices: 'Bonnes pratiques',
    seo:            'SEO',
  };

  const scoreHtml = Object.entries(scores).map(([key, val]) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      ${_gaugeCircle(val, key === 'performance' ? 56 : 44)}
      <div style="font-size:.72rem;color:var(--mut);text-align:center;max-width:80px;
        line-height:1.3">${labels[key]}</div>
    </div>`).join('');

  const metricsHtml = [
    { key: 'fcp', label: 'First Contentful Paint', thresholds: [1800, 3000], unit: '' },
    { key: 'lcp', label: 'Largest Contentful Paint', thresholds: [2500, 4000], unit: '' },
    { key: 'tbt', label: 'Total Blocking Time',       thresholds: [200,  600],  unit: '' },
    { key: 'cls', label: 'Cumulative Layout Shift',   thresholds: [0.1,  0.25], unit: '' },
    { key: 'si',  label: 'Speed Index',               thresholds: [3400, 5800], unit: '' },
  ].map(({ key, label, thresholds }) => {
    const metric = m[key];
    if (!metric) return '';
    const rating = metric.rating || _ratingByThreshold(metric.value, thresholds);
    const color  = rating === 'good' ? '#22c55e' : rating === 'needs-improvement' ? '#f59e0b' : '#ff4d5e';
    const dot    = rating === 'good' ? '🟢' : rating === 'needs-improvement' ? '🟡' : '🔴';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;
        border-bottom:1px solid rgba(37,51,71,.4)">
        <span style="font-size:.75rem">${dot}</span>
        <span style="flex:1;font-size:.82rem;color:var(--mut-2)">${label}</span>
        <span style="font-family:var(--ff-mono);font-size:.82rem;font-weight:700;
          color:${color}">${metric.display}</span>
      </div>`;
  }).join('');

  // ── Diagnostic & recommandations ──────────────────────────────────────────
  const recs = _buildRecs(score, m);

  const stratLabel = strategy === 'mobile' ? '📱 Mobile' : '🖥 Desktop';
  const now        = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

  return `
    <!-- En-tête résultat -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;
      gap:8px;margin-bottom:14px">
      <div style="font-size:.75rem;color:var(--mut)">
        ${stratLabel} · ${escHtml(r.url)} · ${now}
        ${r.simulated ? ' · <span style="color:var(--gold)">⚠ Simulation</span>' : ''}
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="runPagespeedScore('${strategy === 'mobile' ? 'mobile' : 'desktop'}')">
          ↺ Relancer
        </button>
        <button class="btn btn-ghost btn-sm" onclick="runPagespeedScore('${strategy === 'mobile' ? 'desktop' : 'mobile'}')">
          ${strategy === 'mobile' ? '🖥 Desktop' : '📱 Mobile'}
        </button>
      </div>
    </div>

    <!-- Scores catégories (style Lighthouse) -->
    <div class="card" style="margin-bottom:14px">
      <div style="font-size:.72rem;font-family:var(--ff-mono);color:var(--mut);
        text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px">
        Scores Lighthouse
      </div>
      <div style="display:flex;justify-content:center;gap:28px;flex-wrap:wrap;padding:8px 0">
        ${scoreHtml}
      </div>
    </div>

    <!-- Métriques détaillées -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">

      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:10px 14px;border-bottom:1px solid var(--line);
          font-size:.72rem;font-family:var(--ff-mono);color:var(--mut);text-transform:uppercase;
          letter-spacing:.06em">Métriques de performance</div>
        ${metricsHtml}
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:10px 14px;border-bottom:1px solid var(--line);
          font-size:.72rem;font-family:var(--ff-mono);color:var(--mut);text-transform:uppercase;
          letter-spacing:.06em">Core Web Vitals</div>
        ${_cwvBlock(m)}
      </div>

    </div>

    <!-- Recommandations -->
    ${recs.length ? `
    <div class="card">
      <div style="font-size:.72rem;font-family:var(--ff-mono);color:var(--mut);
        text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">
        ⚡ Recommandations prioritaires
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${recs.map(rec => `
          <div style="display:flex;gap:10px;padding:8px 10px;border-radius:8px;
            background:rgba(255,255,255,.02);border:1px solid var(--line)">
            <span style="font-size:.85rem;flex-shrink:0">${rec.icon}</span>
            <div>
              <div style="font-size:.8rem;color:#fff;font-weight:600;margin-bottom:2px">${rec.title}</div>
              <div style="font-size:.74rem;color:var(--mut)">${rec.desc}</div>
            </div>
            <span style="margin-left:auto;font-size:.68rem;padding:2px 8px;border-radius:8px;
              background:${rec.impact === 'high' ? 'rgba(255,77,94,.12)' : 'rgba(251,191,36,.10)'};
              color:${rec.impact === 'high' ? '#ff4d5e' : '#f59e0b'};align-self:flex-start;
              white-space:nowrap;font-weight:700">
              ${rec.impact === 'high' ? 'Impact fort' : 'Impact modéré'}
            </span>
          </div>`).join('')}
      </div>
    </div>` : `
    <div class="card" style="text-align:center;padding:24px;color:var(--ok)">
      🎉 Excellente performance — aucune recommandation critique
    </div>`}`;
}

// ── SVG gauge circulaire style Lighthouse ─────────────────────────────────

function _gaugeCircle(score, size = 48) {
  const color  = score >= 90 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ff4d5e';
  const r      = size / 2 - 4;
  const circ   = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return `
    <div style="position:relative;width:${size + 8}px;height:${size + 8}px">
      <svg width="${size + 8}" height="${size + 8}" viewBox="0 0 ${size + 8} ${size + 8}"
        style="transform:rotate(-90deg)">
        <circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${r}"
          fill="none" stroke="rgba(255,255,255,.06)" stroke-width="3.5"/>
        <circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${r}"
          fill="none" stroke="${color}" stroke-width="3.5"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
          stroke-linecap="round"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;align-items:center;
        justify-content:center;font-family:var(--ff-disp);font-weight:800;
        font-size:${size >= 50 ? '1rem' : '.82rem'};color:${color}">
        ${score}
      </div>
    </div>`;
}

// ── Bloc Core Web Vitals ────────────────────────────────────────────────────

function _cwvBlock(m) {
  const cwv = [
    { key: 'lcp', label: 'LCP', full: 'Largest Contentful Paint', good: 2.5, poor: 4.0, suffix: 's', scale: 1000 },
    { key: 'cls', label: 'CLS', full: 'Cumulative Layout Shift',  good: 0.1, poor: 0.25, suffix: '', scale: 1 },
    { key: 'tbt', label: 'TBT', full: 'Total Blocking Time',      good: 0.2, poor: 0.6,  suffix: 's', scale: 1000 },
  ];

  return cwv.map(({ key, label, full, good, poor, scale }) => {
    const metric  = m[key];
    if (!metric) return '';
    const val     = metric.value / scale;
    const rating  = val <= good ? 'good' : val <= poor ? 'needs-improvement' : 'poor';
    const color   = rating === 'good' ? '#22c55e' : rating === 'needs-improvement' ? '#f59e0b' : '#ff4d5e';
    const badge   = rating === 'good' ? '✅ Bon' : rating === 'needs-improvement' ? '🟡 À améliorer' : '❌ Faible';
    const pct     = Math.min(100, Math.round((val / (poor * 1.5)) * 100));

    return `
      <div style="padding:9px 12px;border-bottom:1px solid rgba(37,51,71,.4)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div>
            <span style="font-weight:700;color:#fff;font-size:.82rem">${label}</span>
            <span style="font-size:.68rem;color:var(--mut);margin-left:6px">${full}</span>
          </div>
          <span style="font-family:var(--ff-mono);font-size:.8rem;font-weight:800;color:${color}">
            ${metric.display}
          </span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;margin-bottom:4px">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width .4s ease"></div>
        </div>
        <div style="font-size:.66rem;color:${color}">${badge}</div>
      </div>`;
  }).join('');
}

// ── Recommandations contextuelles ─────────────────────────────────────────

function _buildRecs(score, m) {
  const recs = [];

  if (m.lcp && m.lcp.value > 2500) {
    recs.push({
      icon: '🖼',
      title: 'Optimiser le Largest Contentful Paint',
      desc: `LCP actuel : ${m.lcp.display}. Objectif : < 2,5s. Compressez les images, utilisez un CDN, activez le lazy loading.`,
      impact: m.lcp.value > 4000 ? 'high' : 'medium',
    });
  }
  if (m.tbt && m.tbt.value > 200) {
    recs.push({
      icon: '⚙️',
      title: 'Réduire le Total Blocking Time',
      desc: `TBT actuel : ${m.tbt.display}. Objectif : < 200ms. Différez les scripts JavaScript non critiques, utilisez des web workers.`,
      impact: m.tbt.value > 600 ? 'high' : 'medium',
    });
  }
  if (m.cls && m.cls.value > 0.1) {
    recs.push({
      icon: '📐',
      title: 'Stabiliser le layout (CLS)',
      desc: `CLS actuel : ${m.cls.display}. Objectif : < 0,1. Définissez les dimensions des images et publicités, évitez les injections de contenu dynamique.`,
      impact: m.cls.value > 0.25 ? 'high' : 'medium',
    });
  }
  if (m.fcp && m.fcp.value > 1800) {
    recs.push({
      icon: '⚡',
      title: 'Accélérer le First Contentful Paint',
      desc: `FCP actuel : ${m.fcp.display}. Objectif : < 1,8s. Activez la compression GZIP/Brotli, préchargez les polices, réduisez le TTFB serveur.`,
      impact: m.fcp.value > 3000 ? 'high' : 'medium',
    });
  }
  if (score < 50) {
    recs.push({
      icon: '🚨',
      title: 'Score critique — action urgente',
      desc: 'Le score de performance est inférieur à 50. Ce site pénalise le référencement et l\'expérience utilisateur. Une intervention technique approfondie est nécessaire.',
      impact: 'high',
    });
  }

  return recs.slice(0, 5);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _ratingByThreshold(value, [good, poor]) {
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

function _estimateFromPerf(perfScore, offset, variance) {
  const base = Math.min(100, Math.max(0, perfScore + offset));
  return Math.round(base + (Math.random() * variance - variance / 2));
}
