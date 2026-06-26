// =========================================================
// S@FE CRM — Utilitaires globaux
// Chargé avant app.js et tous les modules.
// Expose des fonctions globales (scripts classiques, pas de modules ES).
// =========================================================

// ----- Sélecteurs DOM -----
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

// ----- Échappement HTML -----
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// ----- Formatage -----
function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ----- Dates -----
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

// ----- Couleur jauge -----
function gaugeColor(pct) {
  if (pct < 50) return '#2563eb';
  if (pct < 75) return '#3b82f6';
  return '#f59e0b';
}
