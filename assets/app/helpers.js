// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(dateStr, statut) {
  return dateStr && statut !== 'Terminé' && dateStr < todayISO();
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === monthKey();
}

function gaugeColor(pct) {
  if (pct < 50) return '#2563eb';
  if (pct < 75) return '#3b82f6';
  return '#f59e0b';
}

function gaugeSvg(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
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
    <text x="50" y="50" class="gauge-text" style="fill:#fff">${Math.round(pct)}%</text>
  </svg>`;
}

const CONTACT_STATUT_BADGE = { 'Prospect': 'badge-blue', 'Client': 'badge-green', 'Inactif': 'badge-gray' };
const CONTRACT_STATUT_BADGE = {
  'En attente de signature': 'badge-gray', 'Envoyé': 'badge-blue', 'Contrat en cours': 'badge-gold',
  'Paiement échoué': 'badge-red', 'Terminé': 'badge-green', 'Résilié': 'badge-red'
};
const PRIORITY_BADGE = { 'Basse': 'badge-gray', 'Normale': 'badge-blue', 'Haute': 'badge-red' };
const ACTIVITE_BADGE = { 'Digitalisation': 'badge-blue', 'RGPD': 'badge-gold', 'Assurance': 'badge-green', 'Autre': 'badge-gray' };
const TASK_TYPE_BADGE = { 'Premier contact': 'badge-blue', 'RDV visio': 'badge-gold', 'RDV terrain': 'badge-green', 'Autre': 'badge-gray' };

