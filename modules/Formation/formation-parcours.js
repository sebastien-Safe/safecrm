/* ═══════════════ Formation DDA — Mon parcours (lecteur + minuteur strict) ═ */

let lastActivity = Date.now();
['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(evt => {
  window.addEventListener(evt, () => { lastActivity = Date.now(); }, { passive: true });
});

function fmtMinSec(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function stopTimer() {
  if (FormationState.heartbeatInterval) {
    clearInterval(FormationState.heartbeatInterval);
    FormationState.heartbeatInterval = null;
  }
}

function startTimer(uniteId, dureeMin) {
  stopTimer();
  FormationState.heartbeatInterval = setInterval(async () => {
    const idleFor = Date.now() - lastActivity;
    const isPaused = document.visibilityState !== 'visible' || idleFor > 2 * 60 * 1000;
    const pausedEl = document.getElementById('timer-paused');
    if (pausedEl) pausedEl.classList.toggle('show', isPaused);
    if (isPaused) return;

    const { data, error } = await sb.rpc('dda_heartbeat', {
      p_session_id: FormationState.sessionId, p_unite_id: uniteId,
      p_duree_minimale_min: dureeMin, p_delta_sec: 20,
    });
    if (error) { console.error('heartbeat', error); return; }
    applyHeartbeatResult(uniteId, data);
  }, 20000);
}

function applyHeartbeatResult(uniteId, data) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return;
  FormationState.progressionByUnit[uniteId] = {
    ...(FormationState.progressionByUnit[uniteId] || {}),
    temps_passe_sec: row.temps_passe_sec, unite_validee: row.unite_validee,
  };
  updateTimerUI(uniteId, FormationState.sections[FormationState.currentIndex].duree_minimale_min);
  updatePrevNextButtons();
  renderTabs();
  maybeRefreshOnCompletion();
}

async function maybeRefreshOnCompletion() {
  const isLast = FormationState.currentIndex === FormationState.sections.length - 1;
  const section = FormationState.sections[FormationState.currentIndex];
  const prog = FormationState.progressionByUnit[section.id];
  if (isLast && prog && prog.unite_validee) await refreshObligation();
}

async function refreshObligation() {
  const { data } = await sb.from('dda_obligations')
    .select('heures_requises, heures_realisees, statut')
    .eq('id', FormationState.obligation.id).maybeSingle();
  if (data) { Object.assign(FormationState.obligation, data); renderSidebarHours(); }
}

function updateTimerUI(uniteId, dureeMin) {
  const prog = FormationState.progressionByUnit[uniteId] || { temps_passe_sec: 0 };
  const totalSec = dureeMin * 60;
  const pct = Math.min(100, Math.round((prog.temps_passe_sec / totalSec) * 100));
  const fill = document.getElementById('timer-fill');
  const label = document.getElementById('timer-label');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = fmtMinSec(prog.temps_passe_sec) + ' / ' + dureeMin + ' min';
}

function computeMaxUnlockedIndex() {
  for (let i = 0; i < FormationState.sections.length; i++) {
    const prog = FormationState.progressionByUnit[FormationState.sections[i].id];
    if (!prog || !prog.unite_validee) return i;
  }
  return FormationState.sections.length - 1;
}

function renderTabs() {
  const tabList = document.getElementById('tabList');
  if (!tabList) return;
  tabList.innerHTML = '';
  const maxUnlocked = computeMaxUnlockedIndex();
  FormationState.sections.forEach((s, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    const prog = FormationState.progressionByUnit[s.id];
    const done = !!(prog && prog.unite_validee);
    btn.className = 'tab-btn' + (i === FormationState.currentIndex ? ' active' : '') + (done ? ' done' : '');
    btn.disabled = i > maxUnlocked;
    btn.innerHTML = '<span class="tab-dot"></span>' + s.tab;
    btn.onclick = () => { if (i <= maxUnlocked) renderSection(i); };
    li.appendChild(btn);
    tabList.appendChild(li);
  });
}

function renderSidebarHours() {
  const el = document.getElementById('sidebar-hours');
  const o = FormationState.obligation;
  if (!el || !o) return;
  el.innerHTML = 'Heures réalisées : <b>' + Number(o.heures_realisees).toFixed(1) + ' / ' + o.heures_requises + 'h</b>';
}

function updateStepCount() {
  const el = document.getElementById('stepCount');
  if (el) el.textContent = (FormationState.currentIndex + 1) + ' / ' + FormationState.sections.length;
}

function updateNextButton() {
  const nextBtn = document.getElementById('nextBtn');
  if (!nextBtn) return;
  const section = FormationState.sections[FormationState.currentIndex];
  const prog = FormationState.progressionByUnit[section.id];
  const validated = !!(prog && prog.unite_validee);
  nextBtn.disabled = !validated || FormationState.currentIndex >= FormationState.sections.length - 1;
}

function updatePrevNextButtons() {
  const prevBtn = document.getElementById('prevBtn');
  if (prevBtn) prevBtn.disabled = FormationState.currentIndex === 0;
  updateNextButton();
}

function renderLesson(panel, section) {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="eyebrow">${section.tab}</div>
    <h2>${section.title}</h2>
    ${section.objectif ? `<p style="color:var(--ink-soft);max-width:60ch;margin:0 0 20px;line-height:1.55;">${section.objectif}</p>` : ''}
    <div class="card"><ul>${section.contenu.map(b => `<li>${b}</li>`).join('')}</ul></div>
    <div class="timer-block">
      <div class="timer-row"><span>Temps requis pour valider cette unité</span><b id="timer-label"></b></div>
      <div class="timer-bar"><div class="timer-fill" id="timer-fill"></div></div>
      <div class="timer-paused" id="timer-paused">⏸ Minuteur en pause (onglet inactif ou en arrière-plan)</div>
    </div>
  `;
  panel.appendChild(div);

  if (section.qcm_formatif && section.qcm_formatif.length) {
    const block = document.createElement('div');
    block.className = 'quiz-block';
    block.innerHTML = '<div class="qtitle">Vérification rapide (non notée) · cliquez une réponse</div>';
    section.qcm_formatif.forEach((item, qi) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'question';
      const p = document.createElement('p');
      p.textContent = (qi + 1) + '. ' + item.q;
      qDiv.appendChild(p);
      const optsDiv = document.createElement('div');
      optsDiv.className = 'opts';
      item.opts.forEach((optText, oi) => {
        const b = document.createElement('button');
        b.className = 'opt';
        b.textContent = optText;
        b.onclick = () => {
          if (optsDiv.dataset.answered) return;
          optsDiv.dataset.answered = '1';
          Array.from(optsDiv.children).forEach((el, idx) => {
            el.disabled = true;
            if (idx === item.correct) el.classList.add('correct');
          });
          if (oi !== item.correct) b.classList.add('incorrect');
        };
        optsDiv.appendChild(b);
      });
      qDiv.appendChild(optsDiv);
      block.appendChild(qDiv);
    });
    panel.appendChild(block);
  }

  updateTimerUI(section.id, section.duree_minimale_min);
  startTimer(section.id, section.duree_minimale_min);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tire au hasard `count` questions dans la banque, et mélange l'ordre des options de chacune
// (en réindexant `correct` en conséquence). Le tirage n'est jamais déterministe côté serveur :
// c'est un jeu d'options d'affichage, la validité de la réponse est toujours vérifiée côté client
// contre la banque de référence au moment de la soumission (pas d'enjeu de sécurité, seul le score compte).
function drawQuizQuestions(section, count) {
  const pool = shuffle(section.questions);
  return pool.slice(0, Math.min(count, pool.length)).map(item => {
    const optIndexes = shuffle(item.opts.map((_, i) => i));
    return {
      q: item.q,
      opts: optIndexes.map(i => item.opts[i]),
      correct: optIndexes.indexOf(item.correct),
    };
  });
}

async function submitQuizScore(uniteId, pct, quizDetails) {
  const dureeMin = FormationState.sections[FormationState.currentIndex].duree_minimale_min;
  // s'assure que la ligne de progression existe (normalement déjà créée par le minuteur)
  await sb.rpc('dda_heartbeat', { p_session_id: FormationState.sessionId, p_unite_id: uniteId, p_duree_minimale_min: dureeMin, p_delta_sec: 0 });
  await sb.from('dda_progression_unites').update({ quiz_score: pct, quiz_details: quizDetails })
    .eq('session_id', FormationState.sessionId).eq('unite_id', uniteId);
  const { data, error } = await sb.rpc('dda_heartbeat', { p_session_id: FormationState.sessionId, p_unite_id: uniteId, p_duree_minimale_min: dureeMin, p_delta_sec: 0 });
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    FormationState.progressionByUnit[uniteId] = {
      ...(FormationState.progressionByUnit[uniteId] || {}),
      quiz_score: pct, quiz_details: quizDetails, temps_passe_sec: row?.temps_passe_sec, unite_validee: row?.unite_validee,
    };
  }
}

function renderEvaluation(panel, section) {
  const prog = FormationState.progressionByUnit[section.id] || {};
  const head = document.createElement('div');
  head.innerHTML = `
    <div class="eyebrow">${section.tab}</div>
    <h2>${section.title}</h2>
    <p style="color:var(--ink-soft);max-width:60ch;margin:0 0 20px;line-height:1.55;">${section.description || ''}</p>
    <div class="timer-block">
      <div class="timer-row"><span>Temps minimal avant validation</span><b id="timer-label"></b></div>
      <div class="timer-bar"><div class="timer-fill" id="timer-fill"></div></div>
      <div class="timer-paused" id="timer-paused">⏸ Minuteur en pause (onglet inactif ou en arrière-plan)</div>
    </div>
  `;
  panel.appendChild(head);

  let submitted = prog.quiz_score !== undefined && prog.quiz_score !== null;
  // Après soumission, on réaffiche exactement les questions réellement servies (quiz_details persisté).
  // Avant soumission, on tire 20 questions au hasard dans la banque (~40), mémorisées en mémoire
  // le temps de la tentative — jamais persistées tant que le QCM n'est pas validé.
  let questions;
  if (submitted && prog.quiz_details && Array.isArray(prog.quiz_details.questions)) {
    questions = prog.quiz_details.questions;
  } else {
    if (!FormationState.quizSelection[section.id]) {
      FormationState.quizSelection[section.id] = drawQuizQuestions(section, 20);
    }
    questions = FormationState.quizSelection[section.id];
  }
  const examAnswers = submitted && prog.quiz_details ? { ...(prog.quiz_details.answers || {}) } : {};
  const block = document.createElement('div');
  block.className = 'quiz-block';

  function renderQuestions() {
    block.innerHTML = '<div class="qtitle">' + questions.length + ' questions · seuil de réussite 70% · un seul essai compte pour le score</div>';
    questions.forEach((item, qi) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'question';
      const p = document.createElement('p');
      p.textContent = (qi + 1) + '. ' + item.q;
      qDiv.appendChild(p);
      const optsDiv = document.createElement('div');
      optsDiv.className = 'opts';
      item.opts.forEach((optText, oi) => {
        const b = document.createElement('button');
        b.className = 'opt';
        b.textContent = optText;
        if (submitted) {
          b.disabled = true;
          if (oi === item.correct) b.classList.add('correct');
          else if (examAnswers[qi] === oi) b.classList.add('incorrect');
        }
        b.onclick = () => {
          if (submitted) return;
          examAnswers[qi] = oi;
          Array.from(optsDiv.children).forEach(el => el.style.outline = 'none');
          b.style.outline = '2px solid var(--gold)';
        };
        optsDiv.appendChild(b);
      });
      qDiv.appendChild(optsDiv);
      block.appendChild(qDiv);
    });

    if (!submitted) {
      const submitBtn = document.createElement('button');
      submitBtn.className = 'navbtn primary';
      submitBtn.style.marginTop = '20px';
      submitBtn.textContent = 'Valider le QCM';
      submitBtn.onclick = async () => {
        let score = 0;
        questions.forEach((item, qi) => { if (examAnswers[qi] === item.correct) score++; });
        const pct = Math.round(score / questions.length * 100);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours…';
        await submitQuizScore(section.id, pct, { questions, answers: examAnswers });
        submitted = true;
        renderQuestions();
        updatePrevNextButtons();
        renderTabs();
        maybeRefreshOnCompletion();
      };
      block.appendChild(submitBtn);
    } else {
      const pct = FormationState.progressionByUnit[section.id]?.quiz_score ?? prog.quiz_score;
      const resultDiv = document.createElement('div');
      resultDiv.className = 'callout';
      resultDiv.innerHTML = '<span class="tag">Résultat</span><p><strong>' + pct + '%</strong> de bonnes réponses. ' +
        (pct >= 70
          ? 'Seuil de réussite atteint.'
          : 'En dessous du seuil de 70% — contactez votre formateur pour organiser une nouvelle session.') + '</p>';
      block.appendChild(resultDiv);
    }
  }
  renderQuestions();
  panel.appendChild(block);

  updateTimerUI(section.id, section.duree_minimale_min);
  startTimer(section.id, section.duree_minimale_min);
}

function renderSection(index) {
  stopTimer();
  FormationState.currentIndex = index;
  const section = FormationState.sections[index];
  updateStepCount();
  const panel = document.getElementById('panel');
  panel.innerHTML = '';

  if (section.kind === 'lesson') renderLesson(panel, section);
  else if (section.kind === 'evaluation') renderEvaluation(panel, section);

  renderTabs();
  updatePrevNextButtons();
}

function renderParcours() {
  document.getElementById('programme-nom').textContent = FormationState.programme?.nom || '';
  renderSidebarHours();
  document.getElementById('footer-nav').style.display = 'flex';
  document.getElementById('prevBtn').onclick = () => { if (FormationState.currentIndex > 0) renderSection(FormationState.currentIndex - 1); };
  document.getElementById('nextBtn').onclick = () => { if (FormationState.currentIndex < FormationState.sections.length - 1) renderSection(FormationState.currentIndex + 1); };
  if (!FormationState.sections.length) { renderNoProgramme(); return; }
  renderSection(0);
}
