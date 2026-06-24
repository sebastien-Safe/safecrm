// Fonctions pures extraites de helpers.js — importables en ES module (tests + futurs modules).
// helpers.js continue à déclarer ces fonctions en global pour le navigateur.

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

export function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(dateStr, statut) {
  return dateStr && statut !== 'Terminé' && dateStr < todayISO();
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function isThisMonth(dateStr) {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === monthKey();
}

export function gaugeColor(pct) {
  if (pct < 50) return '#2563eb';
  if (pct < 75) return '#3b82f6';
  return '#f59e0b';
}
