// ==========================================================================
// S@FE CRM — Formules et calculs du module Contrats
// Extrait de app.js
// ==========================================================================

function populateFormuleSelect(type, currentFormule) {
  const sel = $('#ct-formule-select');
  const customInput = $('#ct-formule-custom');
  const presets = FORMULE_PRESETS[type] || [];

  let opts = presets.map(f => {
    const unit = f.recurrence === 'Mensuel' ? '/mois' : (f.recurrence === 'Annuel' ? '/an' : ' (forfait)');
    const setup = f.setup ? ` + ${f.setup} € mise en place` : '';
    return `<option value="${escapeHtml(f.label)}">${escapeHtml(f.label)} — ${f.montant} € HT${unit}${setup}</option>`;
  }).join('');
  opts += `<option value="${FORMULE_CUSTOM}">Personnalisé / Sur devis</option>`;
  sel.innerHTML = opts;

  const match = presets.find(f => f.label === currentFormule);
  if (match) {
    sel.value = match.label;
    customInput.style.display = 'none';
    customInput.value = '';
  } else {
    sel.value = FORMULE_CUSTOM;
    customInput.style.display = '';
    customInput.value = currentFormule || '';
  }
}

function onFormuleChange(applyPreset = true) {
  const sel = $('#ct-formule-select');
  const type = $('#ct-type').value.trim();
  const customInput = $('#ct-formule-custom');

  if (sel.value === FORMULE_CUSTOM) {
    customInput.style.display = '';
    updateNetDisplay();
    return;
  }
  customInput.style.display = 'none';
  customInput.value = '';

  if (!applyPreset) { updateNetDisplay(); return; }

  const preset = (FORMULE_PRESETS[type] || []).find(f => f.label === sel.value);
  if (preset) {
    $('#ct-montant').value = preset.montant;
    $('#ct-recurrence').value = preset.recurrence;
    const mepEl = $('#ct-frais-mise-en-place');
    const engEl = $('#ct-engagement-mois');
    if (mepEl) mepEl.value = preset.setup || 0;
    if (engEl) engEl.value = preset.engagement || 0;
    const note = $('#ct-notes');
    const extraNotes = [];
    if (preset.setup) {
      extraNotes.push(`Frais de mise en place : ${preset.setup} € HT (facturés au 1er mois, non remboursables).`);
    }
    if (preset.engagement) {
      extraNotes.push(`Engagement minimum : ${preset.engagement} mois.`);
    }
    extraNotes.forEach(n => {
      const key = n.split(' :')[0];
      if (!note.value.includes(key)) {
        note.value = note.value ? note.value + '\n' + n : n;
      }
    });
  }
  updateNetDisplay();
  autoCalcEcheance();
}

function updateNetDisplay() {
  const montant = Number($('#ct-montant')?.value) || 0;
  const remiseActive = $('#ct-remise-check')?.checked || false;
  const remise = remiseActive ? (Number($('#ct-remise')?.value) || 0) : 0;
  const frais = Number($('#ct-frais-mise-en-place')?.value) || 0;
  const net = Math.max(0, montant + frais - remise);
  // ct-net-wrap n'existe plus — ct-net-display est toujours visible
  const netWrap = $('#ct-net-wrap');
  if (netWrap) netWrap.style.display = (remiseActive && remise > 0) ? '' : 'none';
  const netDisplay = $('#ct-net-display');
  if (netDisplay) netDisplay.value = formatMoney(net);
}

function autoCalcEcheance() {
  const type = $('#ct-type').value.trim();
  const formuleSel = $('#ct-formule-select').value;
  const preset = (FORMULE_PRESETS[type] || []).find(f => f.label === formuleSel);
  const dateDebut = $('#ct-date-debut').value;
  if (!preset || !dateDebut) return;
  const d = new Date(dateDebut + 'T00:00:00');
  if (preset.engagement) {
    d.setMonth(d.getMonth() + preset.engagement);
  } else if (preset.deliveryDays) {
    d.setDate(d.getDate() + preset.deliveryDays);
  } else {
    return;
  }
  $('#ct-date-echeance').value = d.toISOString().slice(0, 10);
}

function getEffectiveContractType() {
  const sel = $('#ct-type');
  if (!sel) return '';
  if (sel.value === '__autre__') return ($('#ct-type-custom')?.value || '').trim();
  return sel.value.trim();
}

function onContractTypeChange() {
  const sel = $('#ct-type');
  const custom = $('#ct-type-custom');
  if (sel && custom) custom.style.display = sel.value === '__autre__' ? '' : 'none';
  populateFormuleSelect(getEffectiveContractType(), null);
  onFormuleChange(true);
}

function updateContractTypeIcon(input) {
  const icon = document.getElementById('ct-type-icon');
  if (icon) icon.textContent = getContractIcon(getEffectiveContractType() || input.value.trim());
}

function toggleRemise() {
  const checked = $('#ct-remise-check').checked;
  const remiseInput = $('#ct-remise');
  if (!remiseInput) return;
  remiseInput.style.display = checked ? '' : 'none';
  if (!checked) remiseInput.value = '';
  updateNetDisplay();
}
