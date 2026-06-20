/* ============================================================
   DPO Clients — Bibliothèque documentaire RGPD
   Génération automatique à partir des données CRM
   ============================================================ */

const DOC_TYPES = [
  { key: 'registre_rgpd',           label: 'Registre RGPD',               icon: '📋' },
  { key: 'politique_confidentialite',label: 'Politique de confidentialité', icon: '🔐' },
  { key: 'mentions_legales',         label: 'Mentions légales',             icon: '⚖️' },
  { key: 'contrat_sous_traitance',   label: 'Contrat de sous-traitance',    icon: '📄' },
  { key: 'procedure_interne',        label: 'Procédure interne',            icon: '📝' },
];

async function loadDocuments() {
  if (!currentContact) return;
  const el = document.getElementById('documents-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  const { data, error } = await supa.from('dpo_client_documents')
    .select('*').eq('contact_id', currentContact.id)
    .order('updated_at', { ascending: false });

  if (error) { el.innerHTML = `<p style="color:var(--alert)">${escHtml(error.message)}</p>`; return; }

  const typesPres = new Set((data || []).map(d => d.type_document));
  const manquants = DOC_TYPES.filter(t => !typesPres.has(t.key));

  el.innerHTML = `
    ${manquants.length ? `
      <div class="card" style="margin-bottom:12px;border-color:var(--warn-bd)">
        <div class="card-header"><span class="card-title" style="color:var(--warn)">— Documents manquants (${manquants.length})</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${manquants.map(t => `
            <button class="btn btn-ghost btn-sm" onclick="genererDocument('${t.key}')">
              ${t.icon} Générer "${t.label}"
            </button>`).join('')}
        </div>
      </div>` : `
      <div style="background:var(--ok-bg);border:1px solid var(--ok-bd);border-radius:var(--r-sm);
        padding:10px 14px;font-size:.82rem;color:var(--ok);margin-bottom:12px">
        ✅ Tous les types de documents sont présents.
      </div>`}

    <div class="card">
      <div class="card-header">
        <span class="card-title">— Documents (${(data || []).length})</span>
        <button class="btn btn-pri btn-sm" onclick="openDocumentModal()">+ Nouveau document</button>
      </div>
      ${(data || []).length ? renderDocList(data) : '<div class="empty-state"><div class="ico">📄</div><p>Aucun document généré.</p></div>'}
    </div>`;
}

function renderDocList(list) {
  return '<div class="item-list">' + list.map(d => {
    const type = DOC_TYPES.find(t => t.key === d.type_document) || { icon: '📄', label: d.type_document };
    return `
      <div class="item-row" onclick="openDocumentModal('${d.id}')">
        <span style="font-size:1.2rem;flex-shrink:0">${type.icon}</span>
        <div class="item-row-info">
          <div class="item-row-name">${escHtml(d.titre)}</div>
          <div class="item-row-meta">${escHtml(type.label)} · v${d.version} · Mis à jour le ${fmtDate(d.updated_at)}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();exportDocPDF('${d.id}')">PDF</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteDocument('${d.id}')">🗑</button>
      </div>`;
  }).join('') + '</div>';
}

async function genererDocument(typeKey) {
  if (!currentContact) return;
  const typeInfo = DOC_TYPES.find(t => t.key === typeKey);
  const [{ data: traits }, { data: contact }] = await Promise.all([
    supa.from('dpo_client_traitements').select('*').eq('contact_id', currentContact.id).eq('statut', 'Actif'),
    supa.from('contacts').select('*').eq('id', currentContact.id).single(),
  ]);

  const entreprise = contact?.entreprise || currentContact.nom;
  const contenu = buildDocContent(typeKey, entreprise, traits || [], contact);
  const { data: { user } } = await supa.auth.getUser();

  const { error } = await supa.from('dpo_client_documents').insert({
    contact_id:    currentContact.id,
    type_document: typeKey,
    titre:         typeInfo.label + ' — ' + entreprise,
    contenu,
    version:       1,
    generated_at:  new Date().toISOString(),
    created_by:    user?.id,
  });
  if (error) { toast('Erreur : ' + error.message, 'err'); return; }
  toast(typeInfo.label + ' généré', 'ok');
  loadDocuments();
}

function buildDocContent(type, entreprise, traitements, contact) {
  const date = new Date().toLocaleDateString('fr-FR');
  if (type === 'politique_confidentialite') {
    return `POLITIQUE DE CONFIDENTIALITÉ — ${entreprise}
Dernière mise à jour : ${date}

1. RESPONSABLE DU TRAITEMENT
${entreprise}${contact?.adresse ? '\n' + contact.adresse : ''}${contact?.email ? '\nContact : ' + contact.email : ''}

2. DONNÉES COLLECTÉES
Nous collectons les données suivantes : ${traitements.flatMap(t => t.categories_donnees || []).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || 'nom, email, téléphone'}.

3. FINALITÉS
${traitements.map((t,i) => `${i+1}. ${t.nom} : ${t.finalite || '—'} (${t.base_legale || '—'})`).join('\n') || 'Gestion de la relation client.'}

4. DURÉE DE CONSERVATION
${traitements.map(t => `• ${t.nom} : ${t.duree_conservation || 'Durée légale applicable'}`).join('\n') || 'Conformément aux durées légales applicables.'}

5. VOS DROITS
Vous disposez des droits d'accès, de rectification, d'effacement, de portabilité, d'opposition et de limitation.
Pour exercer vos droits : ${contact?.email || 'contact@entreprise.fr'}

6. SOUS-TRAITANTS
${traitements.flatMap(t => t.sous_traitants || []).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || 'Aucun sous-traitant identifié.'}

7. RÉCLAMATION
En cas de litige, vous pouvez adresser une réclamation à la CNIL : www.cnil.fr`;
  }
  if (type === 'mentions_legales') {
    return `MENTIONS LÉGALES — ${entreprise}
Généré le ${date}

Éditeur du site : ${entreprise}
${contact?.adresse || ''}
${contact?.email ? 'Contact : ' + contact.email : ''}
${contact?.siret ? 'SIRET : ' + contact.siret : ''}

Responsable de la publication : [À compléter]
Hébergeur : [À compléter]

Les présentes mentions légales sont susceptibles d'être modifiées à tout moment.`;
  }
  if (type === 'contrat_sous_traitance') {
    const sts = [...new Set(traitements.flatMap(t => t.sous_traitants || []))];
    return `CONTRAT DE SOUS-TRAITANCE — ${entreprise}
Généré le ${date}

Responsable de traitement : ${entreprise}
Sous-traitant(s) identifié(s) : ${sts.join(', ') || 'À identifier'}

Conformément à l'Article 28 du RGPD, le sous-traitant s'engage à :
• Traiter les données personnelles uniquement sur instruction documentée du responsable de traitement
• Garantir la confidentialité des données traitées
• Mettre en œuvre toutes les mesures requises par l'Art. 32 RGPD
• Respecter les conditions pour faire appel à un autre sous-traitant
• Aider le responsable de traitement à répondre aux demandes d'exercice des droits
• Supprimer ou restituer les données au terme des services

[Clause pénale et signatures à compléter]`;
  }
  if (type === 'procedure_interne') {
    return `PROCÉDURE INTERNE RGPD — ${entreprise}
Généré le ${date}

1. PROCÉDURE DE GESTION DES DEMANDES DE DROITS
   - Réception : par email ou formulaire
   - Délai de réponse : 1 mois (prorogeable de 2 mois)
   - Vérification d'identité : systématique
   - Traçabilité : dans le module DPO

2. PROCÉDURE EN CAS DE VIOLATION
   - Détection et qualification de l'incident
   - Notification CNIL sous 72h si nécessaire (Art.33)
   - Notification des personnes si risque élevé (Art.34)
   - Consignation dans le registre des violations

3. PROCÉDURE DE RÉVISION
   - Revue annuelle du registre des traitements
   - Mise à jour de la politique de confidentialité
   - Audit interne de conformité`;
  }
  // registre_rgpd
  return `REGISTRE DES TRAITEMENTS (Art.30 RGPD) — ${entreprise}
Généré le ${date}

Responsable de traitement : ${entreprise}

${traitements.map((t,i) => `
=== Traitement ${i+1} : ${t.nom} ===
Finalité : ${t.finalite || '—'}
Base légale : ${t.base_legale || '—'}
Catégories de données : ${(t.categories_donnees||[]).join(', ') || '—'}
Responsable : ${t.responsable_traitement || '—'}
Durée de conservation : ${t.duree_conservation || '—'}
Sous-traitants : ${(t.sous_traitants||[]).join(', ') || 'Aucun'}
Statut : ${t.statut}
`).join('\n') || 'Aucun traitement enregistré.'}`;
}

function openDocumentModal(id = null) {
  const form = `
    <div class="form-group">
      <label class="form-label">Type de document *</label>
      <select class="form-select" id="dc-type">
        ${DOC_TYPES.map(t => `<option value="${t.key}">${t.icon} ${t.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Titre *</label>
      <input class="form-input" id="dc-titre" placeholder="Ex : Politique de confidentialité — ACME SAS">
    </div>
    <div class="form-group">
      <label class="form-label">Contenu</label>
      <textarea class="form-textarea" id="dc-contenu" style="min-height:180px" placeholder="Contenu du document…"></textarea>
    </div>`;

  openModal(id ? 'Modifier le document' : 'Nouveau document', form, `
    ${id ? `<button class="btn btn-danger btn-sm" style="margin-right:auto" onclick="deleteDocument('${id}')">Supprimer</button>` : ''}
    <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
    <button class="btn btn-pri" onclick="saveDocument(${id ? `'${id}'` : 'null'})">Enregistrer</button>`);

  if (id) {
    supa.from('dpo_client_documents').select('*').eq('id', id).single().then(({ data: d }) => {
      if (!d) return;
      document.getElementById('dc-type').value   = d.type_document || '';
      document.getElementById('dc-titre').value  = d.titre         || '';
      document.getElementById('dc-contenu').value= d.contenu       || '';
    });
  }
}

async function saveDocument(id) {
  const titre = document.getElementById('dc-titre').value.trim();
  if (!titre) { toast('Titre requis', 'err'); return; }
  const { data: { user } } = await supa.auth.getUser();
  const payload = {
    contact_id:    currentContact.id,
    type_document: document.getElementById('dc-type').value,
    titre,
    contenu:      document.getElementById('dc-contenu').value || null,
    updated_at:   new Date().toISOString(),
  };
  let err;
  if (id) {
    const { data: old } = await supa.from('dpo_client_documents').select('version').eq('id', id).single();
    payload.version = (old?.version || 1) + 1;
    ({ error: err } = await supa.from('dpo_client_documents').update(payload).eq('id', id));
  } else {
    ({ error: err } = await supa.from('dpo_client_documents').insert({ ...payload, version: 1, created_by: user?.id }));
  }
  if (err) { toast('Erreur : ' + err.message, 'err'); return; }
  closeModal(); toast('Document enregistré', 'ok'); loadDocuments();
}

async function deleteDocument(id) {
  if (!confirm('Supprimer ce document ?')) return;
  const { error } = await supa.from('dpo_client_documents').delete().eq('id', id);
  if (error) { toast('Erreur', 'err'); return; }
  closeModal(); toast('Document supprimé'); loadDocuments();
}

async function exportDocPDF(id) {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDF) { toast('jsPDF non disponible', 'err'); return; }
  const { data: d } = await supa.from('dpo_client_documents').select('*').eq('id', id).single();
  if (!d) return;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(10, 22, 40);
  doc.text(d.titre, 14, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
  const lines = doc.splitTextToSize(d.contenu || '', 178);
  lines.forEach(line => {
    if (y > 278) { doc.addPage(); y = 14; }
    doc.text(line, 14, y); y += 4.5;
  });
  doc.save(`${d.titre.replace(/[^a-z0-9]/gi,'_')}.pdf`);
}
