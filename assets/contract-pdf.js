// =========================================================
// S@FE CRM — Générateur de bons de commande PDF
// Génère un PDF pré-rempli à partir des données d'un contrat
// et d'un contact, dans le format des modèles officiels :
//   - Référencement Local Google (SAFE-BC-SEO)
//   - Click & Collect (SAFE-BC-CC)
//   - Cybersécurité & Résilience (SAFE-BC-CYBER)
//   - Conformité RGPD & DPO Externalisé (SAFE-BC-RGPD)
//
// Référentiels :
//   - Conditions Générales de Vente SAFE-CGV-2026-001
//   - Tarifs publiés sur safe-digitalisation.fr (vérifiés)
//
// Le PDF est téléchargé localement. L'envoi automatique au
// client (e-mail + signature à distance + dépôt kDrive) est
// en phase 2 — voir README "Tunnel de vente".
// =========================================================

window.ContractPDF = (function () {
  const { jsPDF } = window.jspdf || {};

  // --- Constantes prestataire ---
  const PRESTATAIRE = {
    nom: 'S@FE SASU',
    adresse: '66 av. des Champs-Élysées, 75008 Paris',
    siret: '104 699 558 00011',
    tva:   'FR76 104 699 558',
    representant: 'Michel Sébastien Alonso, Président',
    tel:   '01 84 16 26 89',
    email: 'contact@safe-digitalisation.fr',
    site:  'safe-digitalisation.fr',
  };

  // --- Mapping type de contrat → modèle de bon de commande ---
  const MODELES = {
    'Référencement Local':       { code: 'SEO',   titre: 'Bon de commande Référencement Local Google',     ref: 'SAFE-BC-SEO',   page: 'referencement-local.html' },
    'Click & Collect':           { code: 'CC',    titre: 'Bon de commande Click & Collect',                 ref: 'SAFE-BC-CC',    page: 'click-and-collect.html' },
    'Cybersécurité':             { code: 'CYBER', titre: 'Bon de commande Cybersécurité & Résilience',      ref: 'SAFE-BC-CYBER', page: 'cybersecurite.html' },
    'Mise en conformité RGPD':   { code: 'RGPD',  titre: 'Bon de commande Conformité RGPD',                 ref: 'SAFE-BC-RGPD',  page: 'conformite-rgpd.html' },
    'DPO externalisé':           { code: 'RGPD',  titre: 'Bon de commande DPO Externalisé',                 ref: 'SAFE-BC-RGPD',  page: 'conformite-rgpd.html' },
  };

  // --- Outils communs ---
  function money(n) { return (Number(n) || 0).toFixed(2).replace('.', ',') + ' €'; }
  function todayFr() {
    const d = new Date();
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  // --- Header + footer S@FE communs ---
  function drawHeader(doc, modele, refUnique) {
    doc.setDrawColor(245, 158, 11); // gold
    doc.setLineWidth(1.2);
    doc.line(15, 18, 195, 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(10, 22, 40);
    doc.text('S@FE Digitalisation', 15, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(modele.titre, 195, 14, { align: 'right' });
    doc.text(`Réf. : ${refUnique}`, 195, 24, { align: 'right' });
  }

  function drawFooter(doc) {
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.5);
    doc.line(15, h - 16, 195, h - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `${PRESTATAIRE.nom} — SIRET ${PRESTATAIRE.siret} — ${PRESTATAIRE.adresse} — ${PRESTATAIRE.tel} — ${PRESTATAIRE.email} — ${PRESTATAIRE.site}`,
      105, h - 11, { align: 'center' }
    );
    doc.text(`Page ${doc.internal.getNumberOfPages()}`, 195, h - 11, { align: 'right' });
  }

  // --- Section "Parties" : prestataire / client ---
  function drawParties(doc, contact, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(10, 22, 40);
    doc.text('Parties', 15, y);
    y += 7;

    doc.setFontSize(9);
    doc.text('Le Prestataire', 15, y);
    doc.text('Le Client (Responsable de Traitement)', 105, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);

    // Colonne gauche : prestataire
    const left = [
      PRESTATAIRE.nom,
      PRESTATAIRE.adresse,
      `SIRET : ${PRESTATAIRE.siret}`,
      `TVA : ${PRESTATAIRE.tva}`,
      `Rep. par : ${PRESTATAIRE.representant}`,
      `Tél. : ${PRESTATAIRE.tel}`,
      PRESTATAIRE.email,
    ];
    left.forEach((l, i) => doc.text(l, 15, y + i * 4.5));

    // Colonne droite : client (rempli si dispo, sinon ligne à compléter)
    const fill = v => (v && String(v).trim()) ? String(v).trim() : '_______________________________';
    const right = [
      `Dénomination : ${fill(contact?.entreprise || contact?.nom)}`,
      `Forme juridique : ${fill(contact?.forme_juridique)}`,
      `SIRET : ${fill(contact?.siret)}`,
      `Adresse : ${fill(contact?.adresse)}`,
      `Code postal / Ville : ${fill(contact?.code_postal_ville)}`,
      `Représentant : ${fill(contact?.nom)}`,
      `E-mail : ${fill(contact?.email)}`,
      `Tél. : ${fill(contact?.telephone)}`,
    ];
    right.forEach((l, i) => doc.text(l, 105, y + i * 4.5));

    y += Math.max(left.length, right.length) * 4.5 + 4;

    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'italic');
    const noteCGV = 'Le présent bon de commande est régi par les Conditions Générales de Vente S@FE (CGV SAFE-CGV-2026-001), remises au Client et acceptées par signature du présent document.';
    doc.text(doc.splitTextToSize(noteCGV, 180), 15, y);
    return y + 9;
  }

  // --- Section "Formule retenue" ---
  function drawFormule(doc, contract, modele, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(10, 22, 40);
    doc.text('Formule souscrite', 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Cocher la formule retenue. Caractéristiques complètes : safe-digitalisation.fr/${modele.page}.`, 15, y);
    y += 6;

    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(`☒ ${contract.formule || '(formule personnalisée)'}`, 15, y);
    doc.setFont('helvetica', 'normal');
    const ligne2 = [];
    if (contract.montant) ligne2.push(`${money(contract.montant)} HT${contract.recurrence === 'Mensuel' ? ' / mois' : ''}`);
    if (contract.frais_mise_en_place) ligne2.push(`+ ${money(contract.frais_mise_en_place)} HT frais de mise en place`);
    if (ligne2.length) {
      doc.text(ligne2.join('  ·  '), 15, y + 5);
      y += 5;
    }
    if (contract.engagement_mois) {
      doc.setFontSize(8.5);
      doc.text(`Engagement : ${contract.engagement_mois} mois puis résiliable avec 30 jours de préavis.`, 15, y + 5);
      y += 5;
    }
    return y + 8;
  }

  // --- Section "Récapitulatif financier" ---
  function drawRecap(doc, contract, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(10, 22, 40);
    doc.text('Récapitulatif financier', 15, y);
    y += 7;

    const ht = Number(contract.montant) || 0;
    const remise = contract.remise ? Number(contract.remise) : 0;
    const setup = Number(contract.frais_mise_en_place) || 0;
    const totalHt = Math.max(0, (ht - remise)) + setup;
    const tva = totalHt * 0.20;
    const totalTtc = totalHt + tva;

    const rows = [
      ['Prestation / abonnement HT', money(ht)],
      remise ? ['Remise accordée', '- ' + money(remise)] : null,
      setup  ? ['Frais de mise en place (1er mois)', money(setup)] : null,
      ['TOTAL HT', money(totalHt)],
      ['TVA 20 %', money(tva)],
      ['TOTAL TTC', money(totalTtc)],
    ].filter(Boolean);

    doc.setFontSize(9);
    rows.forEach((r, i) => {
      const yy = y + i * 6;
      const isTotal = r[0].startsWith('TOTAL');
      doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
      doc.setTextColor(isTotal ? 10 : 40, isTotal ? 22 : 40, isTotal ? 40 : 40);
      doc.text(r[0], 15, yy);
      doc.text(r[1], 195, yy, { align: 'right' });
      doc.setDrawColor(220, 220, 220);
      doc.line(15, yy + 1.5, 195, yy + 1.5);
    });
    y += rows.length * 6 + 4;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(
      'Mensualités suivantes : montant de l\'abonnement HT + TVA 20 %, facturées à terme échu en début de mois suivant. Paiement par virement bancaire.',
      15, y, { maxWidth: 180 }
    );
    return y + 12;
  }

  // --- Section "Signatures" ---
  function drawSignatures(doc, y) {
    if (y > 240) { doc.addPage(); y = 25; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(10, 22, 40);
    doc.text('Signatures — Bon pour accord', 15, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('S@FE — Le Prestataire', 15, y);
    doc.text('Le Client', 110, y);
    y += 5;
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text('Michel Sébastien Alonso, Président', 15, y);
    doc.text('Nom et qualité : _______________________', 110, y);
    y += 5;
    doc.text(`Date : ${todayFr()}`, 15, y);
    doc.text('Date : _______________________', 110, y);
    y += 5;
    doc.text('Signature et cachet :', 15, y);
    doc.text('Signature et cachet :', 110, y);
    y += 14;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.text('Précédée de la mention « Lu et approuvé »', 15, y);
    doc.text('Précédée de la mention « Lu et approuvé »', 110, y);
  }

  // --- Génération complète du PDF ---
  function generate(contract, contact, options = {}) {
    if (!jsPDF) {
      alert("La librairie de génération PDF n'est pas chargée. Rechargez la page.");
      return;
    }
    const modele = MODELES[contract.type] || {
      code: 'GEN', titre: `Bon de commande — ${contract.type || 'Prestation'}`,
      ref: 'SAFE-BC-GEN', page: 'index.html',
    };
    // Référence unique : SAFE-BC-XXX-YYMMDD-IDcourt
    const d = new Date();
    const refSuffix = [d.getFullYear().toString().slice(2), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('');
    const idShort = (contract.id || '').slice(0, 6).toUpperCase();
    const refUnique = `${modele.ref}-${refSuffix}-${idShort}`;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 30;
    drawHeader(doc, modele, refUnique);

    // Titre
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(10, 22, 40);
    doc.text(modele.titre, 15, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`Date : ${todayFr()} — Lieu : Paris`, 15, y);
    y += 8;

    y = drawParties(doc, contact, y);
    y = drawFormule(doc, contract, modele, y);
    if (y > 220) { doc.addPage(); y = 25; drawHeader(doc, modele, refUnique); }
    y = drawRecap(doc, contract, y);
    drawSignatures(doc, y);

    // Footer sur toutes les pages
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      drawFooter(doc);
    }

    const filename = options.filename || `${refUnique}.pdf`;
    if (options.preview) {
      // Ouvrir dans un nouvel onglet pour relecture avant envoi
      doc.output('dataurlnewwindow');
    } else {
      doc.save(filename);
    }
    return { refUnique, filename };
  }

  // --- Génération des CGV (référence unique 2026-001) ---
  function generateCGV() {
    if (!jsPDF) { alert('jsPDF non chargé'); return; }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const ref = 'SAFE-CGV-2026-001';
    drawHeader(doc, { titre: 'Conditions Générales de Vente' }, ref);
    let y = 28;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(10, 22, 40);
    doc.text('Conditions Générales de Vente', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Réf. : ${ref} — Version en vigueur au 10 juin 2026`, 15, y);
    y += 8;

    const articles = [
      ['Article 1 — Objet', "Les présentes CGV définissent les droits et obligations des parties dans le cadre de la fourniture par S@FE SASU des services suivants : référencement local Google Business Profile, conformité RGPD et DPO externalisé, cybersécurité, et solution Click & Collect. Chaque prestation fait l'objet d'un bon de commande spécifique qui précise la nature exacte des services, le tarif applicable, la durée d'engagement et les modalités propres à la formule choisie."],
      ['Article 2 — Entrée en vigueur et durée', "Le contrat prend effet à compter de la date de signature du bon de commande par les deux parties. Prestations ponctuelles : le contrat prend fin à la livraison du livrable final. Abonnements mensuels : durée initiale d'engagement stipulée sur le bon de commande (3 ou 6 mois selon la formule), puis renouvellement tacite mois par mois, résiliation par e-mail avec confirmation de lecture, préavis de 30 jours."],
      ['Article 3 — Tarifs et conditions financières', "Les tarifs sont exprimés en euros hors taxes (HT). La TVA au taux en vigueur (20 %) est applicable. Frais de mise en place : facturés dès le premier mois et non remboursables. Modalités de paiement : factures payables à réception par virement bancaire. Pour les abonnements, facturation mensuelle à terme échu. Retards de paiement : pénalités au taux BCE + 10 points et indemnité forfaitaire de 40 € (art. L.441-10 C. com.)."],
      ['Article 4 — Obligations du Prestataire', "Obligation de moyens. Le Prestataire s'engage à exécuter les prestations avec le soin et la diligence d'un professionnel compétent. Confidentialité des informations communiquées par le Client pendant 5 ans après la fin du contrat. Respect du RGPD pour les missions impliquant un accès à des données personnelles."],
      ['Article 5 — Obligations du Client', "Fournir en temps utile l'ensemble des informations, accès, identifiants et documents nécessaires. Désigner un référent unique, disponible pour répondre aux sollicitations dans un délai de 48h ouvrables. Ne pas diffuser les livrables à des tiers sans accord préalable écrit, sauf usage interne."],
      ['Article 6 — Responsabilité et limitation', "Responsabilité limitée aux dommages directs résultant d'une faute prouvée. Aucune responsabilité pour les dommages indirects (perte de CA, perte de clientèle, atteinte à l'image). Plafond : sommes HT effectivement encaissées au titre du contrat concerné au cours des 12 derniers mois. Les résultats présentés (positions Google, impressions, clics) sont des estimations indicatives."],
      ['Article 7 — Propriété intellectuelle', "Les livrables produits sont la propriété du Client après paiement intégral. Les méthodes, processus et outils du Prestataire restent sa propriété exclusive."],
      ['Article 8 — Protection des données personnelles (RGPD)', "Collecte et traitement des données personnelles du représentant du Client (nom, prénom, e-mail, téléphone) aux fins de gestion du contrat. Base légale : exécution du contrat (art. 6.1.b RGPD). Conservation : durée du contrat + 5 ans. Droit d'accès, de rectification et d'effacement à l'adresse contact@safe-digitalisation.fr. Lorsque le Prestataire agit en qualité de sous-traitant, un DPA (art. 28 RGPD) est conclu en complément."],
      ['Article 9 — Force majeure', "Pas de responsabilité en cas de force majeure (art. 1218 C. civ.) : catastrophe naturelle, cyberattaque externe de grande ampleur, pannes des plateformes tierces, défaillance des réseaux télécoms. Si la force majeure dure plus de 30 jours consécutifs, chaque partie peut résilier sans indemnité."],
      ['Article 10 — Résiliation', "Pour les abonnements : résiliation par e-mail avec confirmation de lecture, préavis 30 jours. Frais de mise en place non remboursés. En cas de manquement grave non remédié dans 15 jours suivant mise en demeure, résiliation de plein droit. Résiliation anticipée du Client pendant l'engagement initial : mensualités restantes dues à titre d'indemnité."],
      ['Article 11 — Droit applicable et règlement des litiges', "Droit français. Recherche d'une solution amiable dans les 30 jours. À défaut, compétence exclusive du Tribunal de Commerce de Paris."],
      ['Article 12 — Dispositions diverses', "La nullité d'une clause n'entraîne pas la nullité du contrat. Le Client reconnaît avoir reçu un exemplaire des présentes CGV avant la signature du bon de commande."],
    ];

    articles.forEach(([titre, contenu]) => {
      if (y > 260) { doc.addPage(); y = 25; drawHeader(doc, { titre: 'Conditions Générales de Vente' }, ref); }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(10, 22, 40);
      doc.text(titre, 15, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(contenu, 180);
      lines.forEach(l => {
        if (y > 275) { doc.addPage(); y = 25; drawHeader(doc, { titre: 'Conditions Générales de Vente' }, ref); }
        doc.text(l, 15, y);
        y += 4.2;
      });
      y += 3;
    });

    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) { doc.setPage(p); drawFooter(doc); }
    doc.save(`${ref}.pdf`);
    return { refUnique: ref };
  }

  return { generate, generateCGV };
})();
