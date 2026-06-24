/* Social Clients — Gestion des posts */

let _postsData  = [];
let _filterR    = 'all';
let _filterS    = 'all';

async function loadPosts() {
  if (!currentContact) return;
  const el = document.getElementById('posts-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const { data } = await supa.from('social_posts')
    .select('*')
    .eq('contact_id', currentContact.id)
    .order('date_publication', { ascending: false, nullsFirst: false });

  _postsData = data || [];
  renderPosts();
}

function renderPosts() {
  const el = document.getElementById('posts-content');
  if (!el) return;

  let filtered = _postsData.filter(p =>
    (_filterR === 'all' || p.reseau === _filterR) &&
    (_filterS === 'all' || p.statut === _filterS)
  );

  const stats = { brouillon:0, planifie:0, publie:0, annule:0 };
  _postsData.forEach(p => { if (p.statut in stats) stats[p.statut]++; });

  const filterBtns = [
    `<button class="filter-btn${_filterR==='all'?' active':''}" onclick="setFilterR('all',this)">Tous</button>`,
    ...Object.entries(RESEAUX).map(([k,v]) =>
      `<button class="filter-btn${_filterR===k?' active':''}" onclick="setFilterR('${k}',this)">${v.ico} ${v.label}</button>`)
  ].join('');

  el.innerHTML = `
    <div class="posts-header">
      <div>
        <div class="filter-row">${filterBtns}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${Object.entries(STATUTS_SOCIAL).map(([k,s]) =>
            `<span class="badge ${s.cls}" style="cursor:pointer${_filterS===k?';outline:2px solid currentColor;outline-offset:2px':''}"
              onclick="_filterS='${k}';renderPosts()">${s.label} (${stats[k]||0})</span>`
          ).join('')}
          ${_filterS!=='all' ? `<span class="badge badge-gray" style="cursor:pointer" onclick="_filterS='all';renderPosts()">✕ Tout</span>` : ''}
        </div>
      </div>
      <button class="btn btn-pri btn-sm" onclick="openPostModal()">+ Nouveau post</button>
    </div>

    ${filtered.length === 0
      ? `<div class="empty-state">
           <div class="ico">📱</div>
           <p>${_filterR !== 'all' || _filterS !== 'all' ? 'Aucun post pour ce filtre.' : 'Aucun post créé pour ce client.'}</p>
           <button class="btn btn-pri btn-sm" onclick="openPostModal()" style="margin-top:10px">Créer le premier post</button>
         </div>`
      : `<div class="posts-list">${filtered.map(_renderPostRow).join('')}</div>`}`;
}

function _renderPostRow(p) {
  const net = RESEAUX[p.reseau] || { label:p.reseau, ico:'🌐', color:'var(--mut)', bg:'rgba(148,163,184,.1)' };
  const st  = STATUTS_SOCIAL[p.statut] || { label:p.statut, cls:'st-brouillon' };
  const txt = (p.texte || '').substring(0, 140) + ((p.texte||'').length > 140 ? '…' : '');
  return `
    <div class="post-item">
      <div class="post-reseau" style="color:${net.color}">${net.ico}</div>
      <div class="post-body">
        ${txt
          ? `<div class="post-text">${escHtml(txt)}</div>`
          : '<div class="post-text" style="color:var(--mut);font-style:italic">Aucun texte</div>'}
        <div class="post-meta">
          <span style="background:${net.bg};color:${net.color};padding:1px 8px;border-radius:10px;font-size:.65rem">${net.ico} ${net.label}</span>
          ${p.hashtags ? `<span style="color:var(--social)">${escHtml(p.hashtags)}</span>` : ''}
          ${p.date_publication ? `<span>📅 ${fmtDate(p.date_publication)}${p.heure_publication ? ' ' + p.heure_publication.slice(0,5) : ''}</span>` : ''}
          ${p.statut === 'publie' && p.perf_likes ? `<span>❤️ ${p.perf_likes} · 👁 ${p.perf_reach||0}</span>` : ''}
        </div>
      </div>
      <div class="post-actions">
        <span class="badge ${st.cls}">${st.label}</span>
        <div style="display:flex;gap:3px">
          <button class="btn btn-ghost btn-sm" onclick="openPostModal('${p.id}')">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="deletePost('${p.id}')">🗑</button>
        </div>
      </div>
    </div>`;
}

function setFilterR(val, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _filterR = val;
  renderPosts();
}

function openPostModal(id = null) {
  const p = _postsData.find(x => x.id === id) || null;
  const reseauOpts = Object.entries(RESEAUX).map(([k,v]) =>
    `<option value="${k}"${p?.reseau===k?' selected':''}>${v.label}</option>`).join('');
  const statutOpts = Object.entries(STATUTS_SOCIAL).map(([k,s]) =>
    `<option value="${k}"${(p?.statut||'brouillon')===k?' selected':''}>${s.label}</option>`).join('');

  openModal(p ? 'Modifier le post' : 'Nouveau post', `
    <div class="field"><label>Réseau</label>
      <select id="pm-reseau">${reseauOpts}</select></div>
    <div class="field">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <label style="margin:0">Texte du post</label>
        <button type="button" class="btn btn-ghost btn-sm" id="pm-ia-btn"
          onclick="suggestPostWithIA()" style="font-size:.75rem;padding:4px 10px">
          ✨ Générer avec IA
        </button>
      </div>
      <div id="pm-ia-status" style="font-size:.74rem;color:var(--mut);font-family:var(--ff-mono);margin-bottom:6px;display:none"></div>
      <textarea id="pm-texte" rows="5" placeholder="Contenu du post…" style="resize:vertical">${escHtml(p?.texte||'')}</textarea>
    </div>
    <div class="field"><label>Hashtags</label>
      <input id="pm-hashtags" type="text" placeholder="#marketing #social" value="${escHtml(p?.hashtags||'')}"></div>
    <div class="field"><label>Image (URL)</label>
      <input id="pm-image" type="url" placeholder="https://…" value="${escHtml(p?.image_url||'')}"></div>
    <div class="grid-2">
      <div class="field"><label>Date de publication</label>
        <input id="pm-date" type="date" value="${p?.date_publication||today()}"></div>
      <div class="field"><label>Heure</label>
        <input id="pm-heure" type="time" value="${p?.heure_publication?.slice(0,5)||'09:00'}"></div>
    </div>
    <div class="field"><label>Statut</label>
      <select id="pm-statut" onchange="togglePerfBlock(this.value)">${statutOpts}</select></div>
    <div id="pm-perf-block" style="${p?.statut==='publie'?'':'display:none'}">
      <div class="grid-2">
        <div class="field"><label>Likes</label><input id="pm-likes" type="number" min="0" value="${p?.perf_likes||0}"></div>
        <div class="field"><label>Reach</label><input id="pm-reach" type="number" min="0" value="${p?.perf_reach||0}"></div>
      </div>
    </div>
    <div class="field"><label>Notes internes</label>
      <textarea id="pm-notes" rows="2" placeholder="Notes…">${escHtml(p?.notes||'')}</textarea></div>`,
  `<button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
   <button class="btn btn-pri" onclick="savePost('${id||''}')">Enregistrer</button>`);
}

function togglePerfBlock(val) {
  const el = document.getElementById('pm-perf-block');
  if (el) el.style.display = val === 'publie' ? '' : 'none';
}

async function savePost(id) {
  const statut = document.getElementById('pm-statut')?.value;
  const payload = {
    contact_id:        currentContact.id,
    reseau:            document.getElementById('pm-reseau')?.value,
    texte:             document.getElementById('pm-texte')?.value.trim() || null,
    hashtags:          document.getElementById('pm-hashtags')?.value.trim() || null,
    image_url:         document.getElementById('pm-image')?.value.trim() || null,
    date_publication:  document.getElementById('pm-date')?.value || null,
    heure_publication: document.getElementById('pm-heure')?.value || null,
    statut,
    perf_likes:    statut === 'publie' ? parseInt(document.getElementById('pm-likes')?.value||'0') : 0,
    perf_reach:    statut === 'publie' ? parseInt(document.getElementById('pm-reach')?.value||'0') : 0,
    notes:         document.getElementById('pm-notes')?.value.trim() || null,
    updated_at:    new Date().toISOString(),
  };
  let err;
  if (!id) {
    ({ error: err } = await supa.from('social_posts').insert({ ...payload, created_at: new Date().toISOString() }));
  } else {
    ({ error: err } = await supa.from('social_posts').update(payload).eq('id', id));
  }
  if (err) { toast('Erreur : ' + err.message, true); return; }
  toast(id ? 'Post mis à jour ✓' : 'Post créé ✓');
  closeModal();
  await loadPosts();
}

async function suggestPostWithIA() {
  const btn    = document.getElementById('pm-ia-btn');
  const status = document.getElementById('pm-ia-status');
  const texte  = document.getElementById('pm-texte');
  const reseau = document.getElementById('pm-reseau')?.value || 'facebook';
  if (!btn || !texte) return;

  const activeKey = await getActiveIAConnector();
  if (!activeKey) {
    if (status) { status.style.display = ''; status.textContent = '⚠️ Aucun connecteur IA actif — configurez-en un dans les Connecteurs.'; }
    return;
  }

  const reseauLabel = { facebook:'Facebook', instagram:'Instagram', linkedin:'LinkedIn', google:'Google Business' }[reseau] || reseau;
  const clientNom   = currentContact?.entreprise || currentContact?.nom || 'ce client';
  const secteur     = currentContact?.activites || 'TPE/PME locale';
  const hashtags    = document.getElementById('pm-hashtags')?.value || '';

  btn.disabled = true;
  btn.textContent = '⏳ Génération…';
  if (status) { status.style.display = ''; status.textContent = `🤖 ${activeKey} — génération en cours…`; }

  // Mode simulation
  if (await isSimulated(activeKey)) {
    await new Promise(r => setTimeout(r, 900));
    const demos = {
      facebook:  `📣 Bonne nouvelle pour nos clients ! Chez ${clientNom}, nous mettons tout en œuvre pour vous offrir le meilleur service au quotidien. 💪\n\nVous avez des questions ? Contactez-nous dès aujourd'hui !\n\n${hashtags || '#local #TPE #qualité'}`,
      instagram: `✨ Une nouvelle journée, de nouvelles opportunités ! ${clientNom} est là pour vous accompagner dans vos projets. 🌟\n\n${hashtags || '#business #local #entrepreneurs'}`,
      linkedin:  `Dans un contexte économique exigeant, ${clientNom} continue d'innover pour mieux servir ses clients. Notre équipe reste mobilisée et engagée.\n\n💼 Besoin de nos services ? N'hésitez pas à nous contacter.\n\n${hashtags || '#business #croissance #innovation'}`,
      google:    `📍 ${clientNom} est ouvert et prêt à vous accueillir ! Retrouvez-nous pour découvrir nos services et profiter de nos offres du moment. 🙌`,
    };
    texte.value = demos[reseau] || demos.facebook;
    if (status) { status.textContent = '⚡ Post généré (simulation).'; }
    btn.disabled = false; btn.textContent = '✨ Générer avec IA';
    return;
  }

  try {
    const reply = await callIA({
      serviceKey: activeKey,
      system: "Tu es un community manager expert pour TPE/PME françaises. " +
              "Tu génères des posts courts, engageants et authentiques, adaptés au réseau social cible. " +
              "Inclus des emojis appropriés et des hashtags pertinents si demandé. " +
              "Réponds UNIQUEMENT avec le texte du post, sans explication ni guillemets.",
      messages: [{
        role: 'user',
        content: `Génère un post ${reseauLabel} pour "${clientNom}" (secteur : ${secteur}).` +
                 (hashtags ? ` Inclus ces hashtags : ${hashtags}.` : ' Propose 3-5 hashtags pertinents.') +
                 ` Le post doit être naturel, professionnel et engager la communauté locale. Maximum 280 mots.`,
      }],
    });
    texte.value = reply.trim();
    if (status) { status.textContent = `✅ Post généré par ${activeKey}.`; }
  } catch (err) {
    if (status) { status.textContent = `❌ Erreur : ${err.message}`; }
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Générer avec IA';
  }
}

async function deletePost(id) {
  if (!confirm('Supprimer ce post ?')) return;
  const { error } = await supa.from('social_posts').delete().eq('id', id);
  if (error) { toast('Erreur', true); return; }
  toast('Post supprimé');
  await loadPosts();
}
