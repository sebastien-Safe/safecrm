// ==========================================================================
// S@FE CRM — Service Contacts (accès Supabase)
// Extrait de app.js
// ==========================================================================

async function loadContacts() {
  const { data, error } = await sb.from('contacts').select('*').order('created_at', { ascending: false });
  if (error) return alert('Erreur chargement contacts : ' + error.message);
  state.contacts = data || [];
}

async function saveContact() {
  const id = $('#c-id').value;
  const existing = id ? state.contacts.find(x => x.id === id) : null;
  const nom      = $('#c-nom').value.trim();
  const linkedin = ($('#c-linkedin')?.value || '').trim() || null;
  const prenom   = ($('#c-prenom')?.value || '').trim() || null;
  if (!nom) { alert('Le nom est obligatoire.'); return; }
  const payload = {
    nom,
    prenom: prenom || null,
    linkedin: linkedin || null,
    entreprise: $('#c-entreprise').value.trim() || null,
    email: $('#c-email').value.trim() || null,
    telephone: $('#c-telephone').value.trim() || null,
    adresse: $('#c-adresse').value.trim() || null,
    code_postal_ville: $('#c-code-postal-ville').value.trim() || null,
    forme_juridique: $('#c-forme-juridique').value.trim() || null,
    siret: $('#c-siret').value.trim() || null,
    statut: existing?.statut || 'Client',
    source: $('#c-source').value.trim() || state.profile?.prenom || null,
    notes: $('#c-notes').value.trim() || null,
    activites: $all('.c-activite').filter(cb => cb.checked).map(cb => cb.value),
    rgpd_ko: false,
    consent_telephone: $('#c-consent-telephone').checked,
    consent_email: $('#c-consent-email').checked,
    consent_courrier: $('#c-consent-courrier').checked,
  };
  if (!existing) {
    payload.devenu_client_at = new Date().toISOString();
  }
  let error;
  if (id) {
    ({ error } = await sb.from('contacts').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('contacts').insert({ ...payload, created_by: state.user.id }));
  }
  if (error) return alert('Erreur : ' + error.message);
  closeContactModal();
  await loadAll();
}

async function deleteContact() {
  const id = $('#c-id').value;
  if (!id) return;
  if (!confirm('Supprimer ce contact ? Les contrats et tâches associés seront aussi détachés ou supprimés.')) return;
  const { error } = await sb.from('contacts').delete().eq('id', id);
  if (error) return alert('Erreur : ' + error.message);
  closeContactModal();
  await loadAll();
}
