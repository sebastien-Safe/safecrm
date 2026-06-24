/* Social Clients — Calendrier éditorial */

let _calPosts = [];
let _calYear  = new Date().getFullYear();
let _calMonth = new Date().getMonth(); // 0-indexed

async function loadCalendrier() {
  if (!currentContact) return;
  const el = document.getElementById('calendrier-content');
  if (!el) return;
  el.innerHTML = '<div class="loader"><div class="spinner"></div>Chargement…</div>';

  const { data } = await supa.from('social_posts')
    .select('id,reseau,texte,date_publication,heure_publication,statut')
    .eq('contact_id', currentContact.id)
    .not('date_publication', 'is', null)
    .order('date_publication');

  _calPosts = data || [];
  _calYear  = new Date().getFullYear();
  _calMonth = new Date().getMonth();
  renderCalendrier();
}

function renderCalendrier() {
  const el = document.getElementById('calendrier-content');
  if (!el) return;

  const y = _calYear, m = _calMonth;
  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const rawFirst    = new Date(y, m, 1).getDay();
  const firstDay    = rawFirst === 0 ? 6 : rawFirst - 1; // lundi=0

  const byDay = {};
  _calPosts.forEach(p => {
    const d = new Date(p.date_publication);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const day = d.getDate();
      (byDay[day] = byDay[day] || []).push(p);
    }
  });

  const now    = new Date();
  const isNow  = now.getFullYear() === y && now.getMonth() === m;
  const todayD = now.getDate();

  let cells = Array(firstDay).fill('<div class="cal-cell cal-empty"></div>').join('');
  for (let d = 1; d <= daysInMonth; d++) {
    const posts   = byDay[d] || [];
    const isToday = isNow && d === todayD;
    const iso     = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells += `
      <div class="cal-cell${isToday?' cal-today':''}">
        <div class="cal-day-num">${d}</div>
        <div class="cal-posts">
          ${posts.slice(0,3).map(p => {
            const net = RESEAUX[p.reseau] || { ico:'🌐' };
            return `<div class="cal-post-dot ${p.statut}" onclick="openPostModal('${p.id}')"
              title="${escHtml(p.texte||'')}">${net.ico} ${escHtml((p.texte||'').substring(0,16))}</div>`;
          }).join('')}
          ${posts.length > 3 ? `<div style="font-size:.56rem;color:var(--mut);padding-left:3px">+${posts.length-3} autres</div>` : ''}
        </div>
        <button class="cal-add-btn" onclick="openPostModalDate('${iso}')">＋</button>
      </div>`;
  }

  const totalMonth = Object.values(byDay).reduce((s, a) => s + a.length, 0);
  const pubMonth   = Object.values(byDay).flat().filter(p => p.statut === 'publie').length;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <button class="btn btn-ghost btn-sm" onclick="changeCalMonth(-1)">← Préc.</button>
      <div style="text-align:center">
        <div style="color:#fff;font-family:var(--ff-disp);font-size:1rem;font-weight:700">${MONTHS[m]} ${y}</div>
        <div style="font-size:.7rem;color:var(--mut)">${totalMonth} post${totalMonth>1?'s':''} · ${pubMonth} publié${pubMonth>1?'s':''}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="changeCalMonth(1)">Suiv. →</button>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="btn btn-pri btn-sm" onclick="openPostModal()">+ Nouveau post</button>
    </div>
    <div class="cal-grid">
      ${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=>`<div class="cal-head">${d}</div>`).join('')}
      ${cells}
    </div>
    <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
      ${Object.entries(STATUTS_SOCIAL).map(([k,s]) =>
        `<span style="display:flex;align-items:center;gap:5px;font-size:.7rem">
          <span class="badge ${s.cls}" style="font-size:.58rem">${s.label}</span>
        </span>`).join('')}
    </div>`;
}

function changeCalMonth(delta) {
  _calMonth += delta;
  if (_calMonth < 0) { _calMonth = 11; _calYear--; }
  if (_calMonth > 11) { _calMonth = 0;  _calYear++; }
  renderCalendrier();
}

function openPostModalDate(date) {
  openPostModal();
  setTimeout(() => {
    const el = document.getElementById('pm-date');
    if (el) el.value = date;
  }, 60);
}
