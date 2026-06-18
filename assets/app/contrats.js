// ==========================================================================
// TABLE CENTRALISÉE ICÔNES TYPES DE CONTRATS
// ==========================================================================
const CONTRACT_ICONS = {
  'SEO':            '🔍',
  'Référencement':  '🔍',
  'Local':          '🔍',
  'RGPD':           '🛡',
  'Conformité':     '🛡',
  'DPO':            '⚖️',
  'Cyber':          '🔐',
  'Cybersécurité':  '🔐',
  'Sécurité':       '🔐',
  'Assurance':      '🏦',
  'Courtage':       '🏦',
  'Web':            '🌐',
  'Site':           '🌐',
  'Digital':        '🌐',
  'Formation':      '🎓',
  'Audit':          '🔎',
  'DPO externalisé':'⚖️',
};

function getContractIcon(type) {
  if (!type) return '📋';
  for (const [key, icon] of Object.entries(CONTRACT_ICONS)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '📋';
}

const FORMULE_PRESETS = {
  'Référencement Local': [
    { label: 'Essentiel', montant: 79,  recurrence: 'Mensuel',  setup: 190, engagement: 6, comm_signature_fix: 75,  comm_bonus_fidelite: 75,  comm_recurrent_pct: 0.15 },
    { label: 'Boost',     montant: 149, recurrence: 'Mensuel',  setup: 290, engagement: 6, comm_signature_fix: 100, comm_bonus_fidelite: 100, comm_recurrent_pct: 0.15 },
    { label: 'Prestige',  montant: 249, recurrence: 'Mensuel',  setup: 0,   engagement: 3, comm_signature_fix: 0,   comm_bonus_fidelite: 0,   comm_recurrent_pct: 0.15 },
  ],
  'Mise en conformité RGPD': [
    { label: 'Diagnostic (offert)',     montant: 0,    recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0,    comm_recurrent_pct: 0 },
    { label: 'Audit RGPD TPE',          montant: 1490, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_fix: 298,  comm_recurrent_pct: 0 },
    { label: 'Audit RGPD+ PME',         montant: 2990, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_fix: 598,  comm_recurrent_pct: 0 },
    { label: 'Audit ETI (sur devis)',   montant: 5500, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.20, comm_recurrent_pct: 0 },
  ],
  'DPO externalisé': [
    { label: 'Abonnement DPO', montant: 189, recurrence: 'Mensuel', setup: 0, engagement: 12, comm_signature_fix: 50, comm_recurrent_pct: 0.10 },
  ],
  'Cybersécurité': [
    { label: 'Audit de vulnérabilité',  montant: 490,  recurrence: 'Ponctuel', setup: 0, engagement: 0, deliveryDays: 5,  comm_signature_fix: 98,  comm_recurrent_pct: 0 },
    { label: 'Pack Sécurité Essentiel', montant: 990,  recurrence: 'Ponctuel', setup: 0, engagement: 0, deliveryDays: 10, comm_signature_fix: 198, comm_recurrent_pct: 0 },
    { label: 'Pack Résilience Pro',     montant: 1990, recurrence: 'Ponctuel', setup: 0, engagement: 0, deliveryDays: 15, comm_signature_fix: 398, comm_recurrent_pct: 0 },
  ],
  'Options à la carte': [
    { label: 'Landing page SEO',         montant: 390, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Google Ads setup',         montant: 290, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Formation GBP 2h',         montant: 220, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Audit concurrentiel',      montant: 290, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Sensibilisation phishing', montant: 290, recurrence: 'Ponctuel', setup: 0, engagement: 0, comm_signature_pct: 0.10, comm_recurrent_pct: 0 },
    { label: 'Veille menaces',           montant: 89,  recurrence: 'Mensuel',  setup: 0, engagement: 0, comm_signature_pct: 0,    comm_recurrent_pct: 0.10 },
  ],
};
const FORMULE_CUSTOM = '__custom__';

// Fallback pour les formules personnalisées ou sans grille rattachée
const COMMISSION_FALLBACK = { comm_signature_pct: 0.10, comm_recurrent_pct: 0.10 };

function contactName(id) {
  const c = state.contacts.find(c => c.id === id);
  if (!c) return '—';
  return c.entreprise ? `${c.nom} (${c.entreprise})` : c.nom;
}

function contractLabel(ct) {
  return `${contactName(ct.contact_id)} — ${ct.type}${ct.formule ? ' / ' + ct.formule : ''}`;
}

