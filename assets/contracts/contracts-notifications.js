// ==========================================================================
// S@FE CRM — Notifications du module Contrats
// Extrait de app.js
// ==========================================================================

async function loadNotifContracts() {
  if (!isAdmin()) return;
  const block = document.getElementById('notif-contracts-alert');
  if (!block) return;

  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .eq('type', 'new_contract')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data?.length) { block.style.display = 'none'; return; }

  block.style.display = 'block';
  const list = document.getElementById('notif-contracts-list');
  list.innerHTML = data.map(n => {
    const d  = n.data || {};
    const dt = formatDate(n.created_at.slice(0, 10));
    const montant = d.montant ? ` — ${Number(d.montant).toLocaleString('fr-FR')} € HT` : '';
    return `<div class="mini-item">
      <div>
        <div class="t">${escapeHtml(n.message || '')}${escapeHtml(montant)}</div>
        <div class="s mut" style="font-size:.75rem">${dt}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;margin-left:8px">
        ${d.contact_id ? `<button class="btn btn-out btn-sm" style="font-size:.72rem;padding:4px 8px"
          onclick="switchView('contacts');openContactModal('${d.contact_id}')">
          👤 Voir
        </button>` : ''}
        <button class="btn btn-ok btn-sm" style="font-size:.72rem;background:var(--ok);color:#fff;border:none;padding:4px 8px"
          onclick="marquerNotifLue('${n.id}')">
          ✅ Lu
        </button>
      </div>
    </div>`;
  }).join('');
}

async function marquerNotifLue(id) {
  await sb.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  await loadNotifContracts();
}

async function marquerToutesLues() {
  await sb.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('type', 'new_contract')
    .is('read_at', null);
  await loadNotifContracts();
}
