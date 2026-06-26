// =========================================================
// S@FE CRM — Composant toast de notification
// CSS : assets/css/composants/toast.css (.crm-toast, .is-hiding)
// =========================================================

function showCrmToast(html, duration = 8000) {
  const t = document.createElement('div');
  t.className = 'crm-toast';
  t.innerHTML = html;
  document.body.appendChild(t);
  setTimeout(() => {
    t.classList.add('is-hiding');
    setTimeout(() => t.remove(), 300);
  }, duration);
  return t;
}
