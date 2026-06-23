// ==========================================================================
// S@FE CRM — Contenu du Centre d'Aide
// ==========================================================================

// ============================================================
// FICHES PAR VUE
// roles: 'all' | 'admin' | 'dci' | 'user'
// ============================================================
const HELP_VIEWS_DATA = {

  dashboard: {
    title: 'Tableau de bord',
    icon: '🏠',
    roles: 'all',
    description: 'Le tableau de bord est votre point de départ. Il présente une synthèse de votre activité commerciale : contacts récents, alertes d\'échéances, indicateurs de performance et notifications importantes.',
    sections: [
      {
        title: 'Ce que vous voyez',
        items: [
          'Alertes d\'échéances de contrats à venir (15 jours)',
          'Demandes de résiliation en attente (admin)',
          'Bordereaux de commission à envoyer (admin)',
          'Opportunités de montée en gamme (upsell)',
          'Risques de résiliation détectés',
          'Vos indicateurs personnels (CA, contrats, contacts)',
        ],
      },
    ],
    steps: [
      { title: 'Naviguer entre les modules', content: 'Utilisez le menu de gauche pour accéder à Contacts, Contrats, Tâches et Résultats.' },
      { title: 'Gérer les alertes', content: 'Les blocs oranges signalent des actions urgentes. Cliquez sur "Ouvrir" pour traiter directement.' },
      { title: 'Suivre vos objectifs', content: 'Les jauges affichent votre progression par rapport aux objectifs fixés par l\'administrateur.' },
    ],
    errors: [
      { q: 'Mes indicateurs sont à 0', a: 'Vérifiez que vous avez des contacts et des contrats créés. Rechargez la page si nécessaire.' },
      { q: 'Je ne vois pas les alertes admin', a: 'Ces alertes ne sont visibles que pour les administrateurs.' },
    ],
    related: ['contacts', 'contracts', 'admin'],
  },

  contacts: {
    title: 'Contacts',
    icon: '👥',
    roles: 'all',
    description: 'La vue Contacts centralise toute votre base clients et prospects. Chaque contact regroupe les coordonnées, les consentements RGPD, les activités, les échanges et les contrats associés.',
    sections: [
      {
        title: 'Informations gérées',
        items: [
          'Coordonnées : nom, prénom, entreprise, SIRET, email, téléphone, adresse',
          'Consentements RGPD : email, téléphone, courrier',
          'Activités : site web, réseaux sociaux, Click & Collect…',
          'Suivi commercial : échanges, suite à donner',
          'Statut RGPD (KO si consentement manquant)',
        ],
      },
    ],
    steps: [
      { title: 'Créer un contact', content: 'Cliquez sur "Nouveau contact" en haut à droite. Renseignez au minimum le nom. Cochez les consentements RGPD avant d\'enregistrer.' },
      { title: 'Modifier un contact', content: 'Cliquez sur le nom dans la liste pour ouvrir la fiche. Modifiez les champs puis cliquez sur "Enregistrer".' },
      { title: 'Filtrer la liste', content: 'Utilisez la barre de recherche (nom, entreprise) et le filtre "Activité" pour affiner la liste.' },
      { title: 'Ajouter un échange', content: 'Dans la fiche contact, section "Suivi commercial", cliquez sur "+ Échange". Renseignez le type, la date, l\'objet et le contenu.' },
      { title: 'Supprimer un contact', content: 'Ouvrez la fiche contact → cliquez sur "Supprimer". Attention : les contrats associés seront aussi supprimés. Action irréversible.' },
    ],
    errors: [
      { q: 'Le contact apparaît en "RGPD KO"', a: 'Un ou plusieurs consentements sont manquants. Ouvrez la fiche et cochez les cases de consentement appropriées.' },
      { q: 'Je ne trouve pas un contact', a: 'Utilisez la recherche par nom ou entreprise. Vérifiez que le contact n\'est pas assigné à un autre utilisateur si vous êtes DCI.' },
      { q: 'Impossible de supprimer', a: 'Vérifiez que vous êtes bien le créateur du contact. Seuls les admins peuvent supprimer les contacts d\'autres utilisateurs.' },
    ],
    related: ['contracts', 'tasks'],
  },

  contracts: {
    title: 'Contrats',
    icon: '📄',
    roles: 'all',
    description: 'Le module Contrats gère l\'intégralité du cycle de vie d\'un contrat : création, envoi du bon de commande, signature électronique, paiement Stripe, suivi et résiliation.',
    sections: [
      {
        title: 'Statuts du contrat',
        items: [
          '⚪ En attente de signature — bon de commande non encore envoyé',
          '🔵 Envoyé — lien de paiement transmis au client',
          '🟡 Contrat en cours — paiement confirmé par Stripe',
          '🔴 Paiement échoué — Stripe n\'a pas pu prélever',
          '🟠 Demande de résiliation — client a demandé à résilier',
          '🔴 Résilié — résiliation effective',
          '🟢 Terminé — contrat arrivé à terme',
        ],
      },
    ],
    steps: [
      { title: 'Créer un contrat', content: 'Dans la vue Contrats, cliquez sur "Nouveau contrat". Sélectionnez le contact, le type de prestation, la formule, le montant et la récurrence.' },
      { title: 'Envoyer le bon de commande', content: 'Dans la fiche contrat, cliquez sur "Envoyer le bon de commande". Un lien sécurisé est généré et votre client mail s\'ouvre avec le message pré-rempli.' },
      { title: 'Suivre le paiement', content: 'Le statut évolue automatiquement. Stripe envoie un webhook au CRM : le contrat passe en "Contrat en cours" dès confirmation du paiement.' },
      { title: 'Demander une résiliation (Niveau 1/2)', content: 'Ouvrez le contrat → cliquez sur "Demander une résiliation". La demande est transmise à l\'administrateur pour validation.' },
      { title: 'Valider une résiliation (Admin)', content: 'Dans le dashboard → bloc "Résiliations en attente" → cliquez sur "Résiliation validée". Un email de confirmation s\'ouvre et Stripe est notifié.' },
    ],
    errors: [
      { q: 'Le statut reste "En attente de signature" après paiement', a: 'Vérifiez que le webhook Stripe est bien configuré dans le dashboard Stripe. Le statut se met à jour automatiquement à réception du webhook.' },
      { q: 'Erreur lors de l\'envoi du bon de commande', a: 'Vérifiez que le contact a un email renseigné. Enregistrez le contrat avant d\'essayer d\'envoyer.' },
      { q: '"Paiement échoué" — que faire ?', a: 'Contactez le client pour régulariser son moyen de paiement. Stripe retentera automatiquement. Le statut se remettra en "Contrat en cours" dès succès.' },
      { q: 'Le lien de paiement est expiré', a: 'Les liens de paiement expirent après 7 jours. Renvoyez un nouveau bon de commande depuis la fiche contrat.' },
    ],
    related: ['contacts', 'dashboard'],
  },

  tasks: {
    title: 'Tâches',
    icon: '✅',
    roles: 'all',
    description: 'Le module Tâches permet de créer, assigner et suivre des actions commerciales ou administratives liées à vos contacts et contrats.',
    sections: [
      {
        title: 'Types de tâches',
        items: [
          'Rappel client',
          'Relance devis',
          'Suivi contrat',
          'Action administrative',
          'Autre',
        ],
      },
    ],
    steps: [
      { title: 'Créer une tâche', content: 'Cliquez sur "Nouvelle tâche". Renseignez le titre, la date d\'échéance, le contact lié et assignez-la à un membre de l\'équipe.' },
      { title: 'Marquer comme terminée', content: 'Cochez la case à gauche de la tâche ou ouvrez la tâche et changez son statut en "Terminée".' },
      { title: 'Filtrer par assigné', content: 'Utilisez le filtre "Assigné à" pour voir uniquement vos tâches ou celles d\'un collaborateur.' },
    ],
    errors: [
      { q: 'Je ne vois pas les tâches de mes collègues', a: 'Les tâches des autres ne sont visibles que pour les admins et DCI. Niveau 1/2 ne voit que ses propres tâches.' },
    ],
    related: ['contacts', 'contracts'],
  },

  objectifs: {
    title: 'Résultats',
    icon: '📊',
    roles: 'all',
    description: 'La vue Résultats affiche votre performance commerciale : CA mensuel, nombre de contrats signés, contacts créés, et progression par rapport aux objectifs fixés.',
    sections: [
      {
        title: 'Indicateurs affichés',
        items: [
          'CA mensuel (contrats signés ce mois)',
          'Nombre de nouveaux contacts',
          'Nombre de contrats créés',
          'Progression vs objectif',
          'Graphique d\'évolution mensuelle',
        ],
      },
    ],
    steps: [
      { title: 'Lire vos indicateurs', content: 'Les jauges colorées indiquent votre progression. Vert = objectif atteint, orange = en cours, rouge = en retard.' },
      { title: 'Changer la période', content: 'Utilisez le sélecteur de mois en haut pour naviguer dans l\'historique.' },
    ],
    errors: [
      { q: 'Mes résultats sont incorrects', a: 'Les résultats sont calculés à partir des contrats créés dans le mois sélectionné. Vérifiez la date de création des contrats.' },
    ],
    related: ['dashboard', 'admin'],
  },

  admin: {
    title: 'Administration',
    icon: '⚙️',
    roles: 'admin',
    description: 'L\'espace Administration est réservé aux administrateurs. Il regroupe la gestion des utilisateurs, la vue performance de l\'équipe, les contacts RGPD KO, le Registre RGPD, la sécurité et les réglages.',
    sections: [
      {
        title: 'Onglets disponibles',
        items: [
          'Vue d\'ensemble — synthèse de toute l\'équipe',
          'Résultats — performance par commercial',
          'Par utilisateur — détail individuel + bordereau',
          'Gestion des utilisateurs — créer/modifier/désactiver',
          '🔒 Sécurité — journal de connexion, alertes intrusion',
          '📒 Registre RGPD — Article 30, Journal, Droits, Rapports',
          '⚙️ Réglages — registre des fournisseurs tiers, niveaux de risque',
        ],
      },
    ],
    steps: [
      { title: 'Créer un utilisateur', content: 'Onglet "Gestion des utilisateurs" → "Nouvel utilisateur". Renseignez l\'email, le prénom et le rôle. L\'utilisateur recevra un email de bienvenue.' },
      { title: 'Générer un bordereau de commission', content: 'Onglet "Résultats" → cliquez sur un commercial → "Générer le bordereau". Un PDF est téléchargé automatiquement.' },
      { title: 'Accéder au Journal RGPD', content: 'Onglet "Registre RGPD" → sous-onglet "Journal RGPD". Toutes les opérations sur données personnelles sont tracées ici.' },
      { title: 'Valider une résiliation', content: 'Depuis le dashboard (bloc "Résiliations en attente"), cliquez sur "Résiliation validée". L\'action est irréversible.' },
      { title: 'Gérer le registre fournisseurs', content: 'Onglet "Réglages" → section "Registre des fournisseurs". Ajoutez, modifiez ou évaluez le niveau de risque de chaque sous-traitant (RGPD art. 28 et NIS2 supply chain).' },
    ],
    errors: [
      { q: 'Je ne peux pas créer d\'utilisateur', a: 'Seuls les super-admins peuvent créer des utilisateurs. Contactez votre gestionnaire de compte S@FE.' },
      { q: 'Un bordereau affiche 0 €', a: 'Vérifiez que des contrats ont été créés par cet utilisateur sur la période sélectionnée.' },
    ],
    related: ['dashboard', 'securite'],
  },

  pipeline: {
    title: 'Pipeline Kanban',
    icon: '🗂️',
    roles: 'all',
    description: 'Le Pipeline Kanban remplace les vues Contacts et Contrats séparées. Il offre une vision visuelle de votre portefeuille organisé en colonnes par statut commercial, avec checklist, pièces jointes et compteur de valeur global.',
    sections: [
      {
        title: 'Colonnes du pipeline',
        items: [
          'Prospect — premier contact, pas encore qualifié',
          'Qualifié — besoin identifié, projet confirmé',
          'Proposition — offre envoyée, bon de commande en attente',
          'Négociation — discussions tarifaires ou contractuelles en cours',
          'Gagné — contrat signé, client actif',
          'Perdu — opportunité non concrétisée',
        ],
      },
      {
        title: 'Fonctionnalités par carte',
        items: [
          'Glisser-déposer entre colonnes pour changer de statut',
          'Priorité : Haute / Normale / Basse (badge coloré)',
          'Checklist : ajout de tâches spécifiques à ce client',
          'Pièces jointes : dépôt de fichiers (contrats PDF, devis, factures…)',
          'Détail contrat : valeur, type, récurrence',
        ],
      },
    ],
    steps: [
      { title: 'Déplacer une carte', content: 'Cliquez-glissez la carte vers la colonne cible. Le statut du contact est mis à jour automatiquement en base de données.' },
      { title: 'Ajouter une tâche (checklist)', content: 'Cliquez sur la carte → section Checklist → "Ajouter une tâche". Cochez pour marquer comme terminée.' },
      { title: 'Déposer une pièce jointe', content: 'Cliquez sur l\'icône trombone de la carte → "Ajouter un fichier". Le fichier est stocké dans Supabase Storage (contrats-pdf/pj/{id}/).' },
      { title: 'Filtrer et rechercher', content: 'Utilisez la barre de recherche (nom, entreprise) et le filtre de statut en haut du pipeline. Le compteur de valeur totale s\'adapte automatiquement.' },
      { title: 'Voir le compteur global', content: 'La valeur totale affichée en haut correspond à la somme des montants de contrats actifs (non résiliés) correspondant aux filtres en cours.' },
    ],
    errors: [
      { q: 'Une carte ne se déplace pas', a: 'Vérifiez votre connexion. Le déplacement fait un appel Supabase en temps réel — si la connexion est coupée, la carte reviendra à sa position initiale.' },
      { q: 'La pièce jointe ne s\'upload pas', a: 'Taille maximale : 50 Mo. Formats acceptés : PDF, images, Word. Vérifiez que le fichier n\'est pas déjà ouvert dans une autre application.' },
    ],
    related: ['dashboard', 'contracts'],
  },

  securite: {
    title: 'Sécurité & Conformité',
    icon: '🔒',
    roles: 'all',
    description: 'S@FE CRM intègre plusieurs mécanismes de sécurité conformes aux recommandations CNIL, NIS2 et ISO 27001 : double authentification, sessions limitées, journalisation, isolation des données et gestion des incidents.',
    sections: [
      {
        title: 'Double authentification (MFA TOTP)',
        items: [
          'Obligatoire pour les rôles Admin, Super Admin et DCI',
          'Optionnel (fortement recommandé) pour les commerciaux Niveau 1',
          'Activation : Profil → "Double authentification" → Scanner le QR code avec Google Authenticator ou Authy',
          'Validité du code : 30 secondes. Appareil de confiance mémorisé 2h.',
          'En cas de perte d\'accès à l\'application TOTP : contactez votre administrateur S@FE',
        ],
      },
      {
        title: 'Gestion du mot de passe',
        items: [
          'Renouvellement obligatoire tous les 45 jours — une bannière apparaît à l\'approche de l\'échéance',
          'Changement depuis le profil : cliquez sur votre prénom en haut à droite → Profil → section "Mot de passe"',
          'Mot de passe oublié : cliquez sur "Mot de passe oublié ?" depuis l\'écran de connexion → saisissez votre e-mail → un lien sécurisé vous est envoyé par e-mail (valable 24 heures)',
          'Une confirmation par e-mail est automatiquement envoyée après chaque changement réussi',
          'Si vous ne recevez pas l\'e-mail, vérifiez vos courriers indésirables (expéditeur : noreply@safe-digitalisation.fr)',
        ],
      },
      {
        title: 'Sessions et verrouillage',
        items: [
          'Durée maximale de session : 4 heures (RGPD Art. 42)',
          'Alerte 15 minutes avant expiration automatique',
          'Verrouillage après 5 tentatives de connexion échouées',
          'Déblocage par un administrateur uniquement (Administration → Sécurité)',
        ],
      },
      {
        title: 'Incidents NIS2',
        items: [
          'Déclaration d\'incident : /work/incidents-nis2.html (admins uniquement)',
          'Champs : type d\'incident, systèmes affectés, description, mesures prises',
          'Indicateur 72h : délai de notification ANSSI (si entité assujettie NIS2)',
          'Timeline des incidents classés par statut : Ouvert / En cours / Clôturé',
        ],
      },
    ],
    steps: [
      { title: 'Changer mon mot de passe', content: 'Cliquez sur votre prénom en haut à droite → Profil → section "Mot de passe" → saisissez votre nouveau mot de passe deux fois → "Enregistrer". Un e-mail de confirmation vous est envoyé automatiquement.' },
      { title: 'Mot de passe oublié', content: 'Depuis l\'écran de connexion, cliquez sur "Mot de passe oublié ?" → saisissez votre adresse e-mail → cliquez sur le lien reçu par e-mail (valable 24h) → choisissez un nouveau mot de passe.' },
      { title: 'Activer le MFA TOTP', content: 'Cliquez sur votre prénom en haut à droite → Profil → section "Double authentification" → "Configurer". Scannez le QR code, saisissez le code à 6 chiffres pour confirmer l\'activation.' },
      { title: 'Voir le journal de sécurité', content: 'Administration → onglet "🔒 Sécurité". Liste des 50 dernières tentatives de connexion avec résultat, IP et indicateur de verrouillage.' },
      { title: 'Débloquer un utilisateur verrouillé', content: 'Administration → Sécurité → liste des comptes verrouillés → bouton "Débloquer". Le compteur d\'échecs est réinitialisé.' },
      { title: 'Déclarer un incident NIS2', content: 'Depuis WORK → menu "Incidents NIS2" ou directement via /work/incidents-nis2.html. Réservé aux administrateurs.' },
    ],
    errors: [
      { q: 'Je n\'ai pas reçu l\'e-mail de réinitialisation', a: 'Vérifiez vos courriers indésirables (spam). L\'expéditeur est noreply@safe-digitalisation.fr. Si l\'e-mail n\'arrive pas après 5 minutes, refaites la demande. En cas de persistance, contactez votre administrateur.' },
      { q: 'Mon lien de réinitialisation ne fonctionne plus', a: 'Le lien est valable 24 heures et ne peut être utilisé qu\'une seule fois. Si expiré, retournez sur l\'écran de connexion et faites une nouvelle demande "Mot de passe oublié ?".' },
      { q: 'Je n\'ai pas reçu l\'e-mail de confirmation de changement', a: 'La confirmation est envoyée automatiquement après un changement réussi. Si vous ne la recevez pas, vérifiez vos spams. L\'absence de cet e-mail alors que votre mot de passe a bien changé ne bloque pas l\'accès.' },
      { q: 'Je n\'ai plus accès à mon application TOTP', a: 'Contactez immédiatement votre administrateur S@FE. Il peut désactiver temporairement le MFA depuis la gestion des utilisateurs.' },
      { q: 'Ma session expire trop vite', a: 'La limite de 4h est fixée par la politique RGPD interne. Elle ne peut pas être modifiée. Sauvegardez votre travail régulièrement.' },
      { q: 'Mon compte est verrouillé', a: 'Après 5 tentatives échouées, seul un administrateur peut débloquer votre compte. Contactez votre responsable S@FE.' },
    ],
    related: ['admin', 'dashboard'],
  },

  automatisations: {
    title: 'Modules & Automatisations',
    icon: '⚡',
    roles: 'all',
    description: 'L\'espace WORK regroupe les modules opérationnels avancés : DPO externalisé, SEO, Cybersécurité, Click & Collect, Social. Chaque module peut déclencher des workflows automatisés à partir des données CRM.',
    sections: [
      {
        title: 'Modules disponibles',
        items: [
          'DPO Externalisé — audit RGPD, registre des traitements, réponses aux droits',
          'SEO — rapports de positionnement, actions techniques, livrables client',
          'Cybersécurité — rapport de vulnérabilités, plan de remédiation',
          'Click & Collect — configuration et suivi des commandes',
          'Social — pilotage des réseaux sociaux clients',
        ],
      },
      {
        title: 'Automatisations disponibles',
        items: [
          'Génération de rapports PDF client en un clic',
          'Envoi automatique par email (Brevo) à la génération',
          'Mise à jour du statut de mission dans le CRM',
          'Création de tâche de suivi automatique après livraison',
        ],
      },
    ],
    steps: [
      { title: 'Accéder aux modules', content: 'Depuis le CRM : menu WORK (sidebar) → sélectionnez le module. Depuis un navigateur : /work/index.html.' },
      { title: 'Lancer une automatisation', content: 'WORK → "Automatisations" → sélectionnez un client et un contrat → choisissez le workflow → cliquez sur "Lancer".' },
      { title: 'Suivre les actions lancées', content: 'WORK → "Journal des actions". Chaque automatisation est tracée avec horodatage, client concerné et résultat.' },
    ],
    errors: [
      { q: 'Le module n\'apparaît pas', a: 'Vérifiez que le client a un contrat actif pour ce service. Les modules ne sont disponibles que pour les contrats en statut "Contrat en cours".' },
      { q: 'L\'email n\'est pas envoyé après génération PDF', a: 'Vérifiez la configuration Brevo (template ID). Consultez le journal des actions WORK pour voir le détail de l\'erreur.' },
    ],
    related: ['dashboard', 'contracts'],
  },

};

// ============================================================
// FAQ PAR THÈME
// ============================================================
const HELP_FAQ_DATA = [
  {
    theme: 'Contacts',
    icon: '👥',
    items: [
      { q: 'Comment créer un contact ?', a: 'Vue Contacts → "Nouveau contact". Renseignez nom, email, téléphone et cochez les consentements RGPD avant d\'enregistrer.' },
      { q: 'Qu\'est-ce qu\'un contact RGPD KO ?', a: 'Un contact sans consentement valide. Le flag "RGPD KO" apparaît dans la liste et dans la vue Admin → Contacts RGPD KO.' },
      { q: 'Comment transférer un contact à un autre commercial ?', a: 'Ouvrez la fiche contact → bouton "Transférer". Cette fonction est réservée aux administrateurs et DCI.' },
      { q: 'Puis-je importer des contacts en masse ?', a: 'Pas encore disponible dans cette version. Créez les contacts un par un ou contactez l\'administrateur S@FE.' },
      { q: 'Comment enregistrer un échange téléphonique ?', a: 'Ouvrez la fiche contact → section "Suivi commercial" → "+ Échange" → Type "Téléphone". Notez l\'objet et le résumé.' },
    ],
  },
  {
    theme: 'Contrats',
    icon: '📄',
    items: [
      { q: 'Comment envoyer un bon de commande ?', a: 'Fiche contrat → "Envoyer le bon de commande". Un lien sécurisé est créé et votre client mail s\'ouvre avec le message pré-rempli.' },
      { q: 'Le client peut-il signer sans carte bancaire ?', a: 'Pour les abonnements mensuel (SEPA), le client renseigne son IBAN sur la page de paiement Stripe. Pour les paiements ponctuels, une carte bancaire est requise.' },
      { q: 'Comment annuler un contrat avant signature ?', a: 'Vous pouvez supprimer un contrat en statut "En attente de signature". Une fois le paiement effectué, utilisez le workflow de résiliation.' },
      { q: 'Combien de temps le lien de paiement est-il valide ?', a: '7 jours à compter de l\'envoi. Après expiration, renvoyez un nouveau bon de commande depuis la fiche contrat.' },
      { q: 'Comment appliquer une remise ?', a: 'Fiche contrat → cochez "Remise" → saisissez le montant HT à déduire. La remise s\'affiche sur le bon de commande client.' },
    ],
  },
  {
    theme: 'Facturation',
    icon: '💶',
    items: [
      { q: 'Quand le client est-il prélevé ?', a: 'Pour les abonnements SEPA : le jour de la signature électronique (1er mois) puis le même jour chaque mois. Pour les paiements ponctuels : immédiatement à la validation.' },
      { q: 'Que se passe-t-il si un paiement échoue ?', a: 'Le statut du contrat passe en "Paiement échoué". Une interaction est créée automatiquement dans le suivi client. Stripe retentera. Contactez le client pour régulariser.' },
      { q: 'Comment générer un bordereau de commission ?', a: 'Administration → Résultats → cliquez sur un commercial → "Générer le bordereau". Un PDF est téléchargé.' },
      { q: 'Les frais de mise en place sont-ils remboursables ?', a: 'Non, selon l\'Article 3 des CGV. Ils sont facturés au 1er mois et non remboursables même en cas de résiliation anticipée.' },
    ],
  },
  {
    theme: 'Stripe',
    icon: '💳',
    items: [
      { q: 'Le client peut-il résilier depuis Stripe directement ?', a: 'Non. Le portail client Stripe est désactivé. Toute résiliation passe par le workflow CRM (demande → validation admin).' },
      { q: 'Que signifie "Résiliation en attente Stripe" ?', a: 'L\'administrateur a validé la résiliation, la commande a été transmise à Stripe. La synchronisation est en cours (max 48h).' },
      { q: 'Comment mettre à jour le moyen de paiement d\'un client ?', a: 'Contactez votre chargé de compte S@FE pour générer un lien de mise à jour du moyen de paiement.' },
      { q: 'L\'état Stripe est-il synchronisé automatiquement ?', a: 'Oui. Le CRM reçoit les événements Stripe en temps réel via webhook : paiements, renouvellements, résiliations.' },
    ],
  },
  {
    theme: 'Pipeline Kanban',
    icon: '🗂️',
    items: [
      { q: 'Comment changer le statut d\'un contact ?', a: 'Glissez-déposez la carte du contact vers la colonne souhaitée. Le statut est mis à jour immédiatement en base de données.' },
      { q: 'Où sont stockées les pièces jointes ?', a: 'Dans Supabase Storage, dossier contrats-pdf/pj/{contact_id}/. Elles sont accessibles depuis la carte du contact dans le pipeline.' },
      { q: 'La checklist est-elle partagée avec l\'équipe ?', a: 'Oui. La checklist est liée au contact, pas à l\'utilisateur. Tous les membres ayant accès au contact voient les mêmes tâches.' },
      { q: 'Le compteur de valeur tient-il compte des filtres ?', a: 'Oui. Le total affiché en haut du pipeline correspond uniquement aux contrats actifs des contacts visibles selon votre recherche et filtre en cours.' },
    ],
  },
  {
    theme: 'Sécurité & MFA',
    icon: '🔒',
    items: [
      { q: 'Le MFA est-il obligatoire ?', a: 'Oui pour les rôles Admin, Super Admin et DCI. Fortement recommandé pour tous. L\'enrôlement est forcé à la connexion pour les rôles privilégiés.' },
      { q: 'Quelle application utiliser pour le TOTP ?', a: 'Google Authenticator, Microsoft Authenticator ou Authy. Toute application compatible RFC 6238 (TOTP standard) fonctionne.' },
      { q: 'Que faire si je perds mon téléphone ?', a: 'Contactez immédiatement votre administrateur S@FE. Il peut réinitialiser votre facteur MFA depuis la console Supabase. Ne partagez jamais votre code TOTP.' },
      { q: 'Qu\'est-ce qu\'un incident NIS2 ?', a: 'Tout événement qui affecte la sécurité des systèmes d\'information : cyberattaque, violation de données, indisponibilité prolongée. À déclarer dans WORK → Incidents NIS2.' },
    ],
  },
  {
    theme: 'RGPD',
    icon: '🔐',
    items: [
      { q: 'Quels consentements dois-je recueillir ?', a: 'Pour chaque contact : consentement email marketing, consentement téléphone et/ou consentement courrier. Cochez uniquement ce que le client a accepté.' },
      { q: 'Qui peut accéder au Journal RGPD ?', a: 'Uniquement les administrateurs, depuis Administration → Registre RGPD → Journal RGPD.' },
      { q: 'Comment exporter le registre RGPD ?', a: 'Administration → Registre RGPD → onglet "Registre des traitements" → bouton "Exporter PDF".' },
      { q: 'Que faire face à une demande d\'effacement ?', a: 'Administration → Registre RGPD → onglet "Demandes de droits". Enregistrez la demande. Vous avez 1 mois pour y répondre (Art. 17 RGPD).' },
      { q: 'Le Journal RGPD peut-il être modifié ?', a: 'Non. Le journal est immuable par conception. Toute tentative de modification est bloquée au niveau de la base de données.' },
      { q: 'Où signer la clause de confidentialité ?', a: 'À la première connexion, le CRM vous redirige automatiquement vers la page de signature. Vous pouvez aussi y accéder directement : /clause.html.' },
    ],
  },
  {
    theme: 'Administration',
    icon: '⚙️',
    items: [
      { q: 'Comment créer un nouveau commercial ?', a: 'Administration → Gestion des utilisateurs → "Nouvel utilisateur". Renseignez email, prénom et rôle. Un email d\'invitation est envoyé automatiquement.' },
      { q: 'Quelle est la différence entre les rôles ?', a: 'Niveau 1/2 : accès à ses propres contacts et contrats. DCI : accès à son équipe. Admin : accès complet. Super Admin : gestion globale.' },
      { q: 'Comment désactiver un utilisateur ?', a: 'Administration → Gestion des utilisateurs → cliquez sur l\'utilisateur → "Désactiver". Les données sont conservées.' },
      { q: 'Comment définir des objectifs ?', a: 'Administration → Vue d\'ensemble → section "Objectifs". Saisissez les cibles mensuelles par utilisateur et par indicateur.' },
    ],
  },
];

// ============================================================
// DOCUMENTATION RGPD
// ============================================================
const HELP_RGPD_DATA = [
  {
    title: 'Registre des traitements',
    icon: '📋',
    content: 'Le registre Article 30 RGPD liste toutes les activités de traitement des données personnelles réalisées par S@FE SAS. Accessible depuis Administration → Registre RGPD → "Registre des traitements". Exportable en PDF.',
    points: [
      'Responsable de traitement : S@FE SAS — SIRET 104 699 558 00011',
      'DPO interne : Sébastien Alonso — contact@safe-digitalisation.fr',
      'Traitements documentés : gestion commerciale, facturation, communication client',
    ],
  },
  {
    title: 'Journal RGPD',
    icon: '📝',
    content: 'Le Journal RGPD trace automatiquement toutes les opérations sur données personnelles : création, modification, suppression de contacts et contrats, exports, modifications de profil. Immuable et non modifiable.',
    points: [
      'Accès : Administrateurs uniquement',
      'Filtres : par utilisateur, date, module, criticité, résultat',
      'Exports : CSV, PDF, Excel, Impression',
      'Entrées non supprimables (trigger base de données)',
    ],
  },
  {
    title: 'Gestion des droits (RGPD)',
    icon: '⚖️',
    content: 'Les personnes concernées peuvent exercer leurs droits (Articles 15–22 RGPD) : accès, rectification, effacement, portabilité, opposition.',
    points: [
      'Délai de réponse : 1 mois (prorogeable de 2 mois)',
      'Enregistrer chaque demande dans Administration → Registre RGPD → Demandes de droits',
      'Pour une demande d\'effacement : supprimer le contact + ses données liées',
      'Conserver la preuve de traitement de la demande',
    ],
  },
  {
    title: 'Conservation des données',
    icon: '🗓️',
    content: 'Les données sont conservées selon les durées définies dans le registre des traitements.',
    points: [
      'Données commerciales (contacts, contrats) : durée du contrat + 5 ans',
      'Journal RGPD : conservation permanente (immuable)',
      'Données de facturation : 10 ans (obligation légale comptable)',
      'Consentements marketing : jusqu\'au retrait du consentement',
    ],
  },
  {
    title: 'Exports et suppressions',
    icon: '📤',
    content: 'Toute opération d\'export ou de suppression est tracée dans le Journal RGPD. Les exports sont horodatés et attribués à l\'utilisateur connecté.',
    points: [
      'Export registre RGPD (PDF) : Administration → Registre RGPD',
      'Export Journal (CSV/PDF/Excel) : Administration → Registre RGPD → Journal RGPD',
      'Suppression contact : irréversible — bien vérifier avant de supprimer',
      'Toute suppression génère une entrée "Critique" dans le Journal RGPD',
    ],
  },
];

// ============================================================
// DOCUMENTATION TECHNIQUE COMPLÈTE
// ============================================================
const HELP_DOCS_LINK = {
  url: '/documentation-crm.html',
  label: 'Documentation CRM complète',
  description: 'Architecture technique, schémas de base de données, registre RGPD complet, sécurité, modules Work, droits par rôle.',
};

// ============================================================
// TUTORIELS GUIDÉS PAR VUE
// target: sélecteur CSS de l'élément à mettre en avant
// position: where to place the bubble relative to target
// ============================================================
const HELP_TUTORIALS_DATA = {

  dashboard: [
    { target: null, title: 'Bienvenue sur S@FE CRM', content: 'Ce tutoriel vous guide en 5 étapes pour prendre en main votre CRM. Cliquez sur "Suivant" pour commencer.', position: 'center' },
    { target: '[data-view="contacts"]', title: 'Module Contacts', content: 'Gérez ici toute votre base clients et prospects. Cliquez pour accéder à la liste des contacts.', position: 'right' },
    { target: '[data-view="contracts"]', title: 'Module Contrats', content: 'Créez et suivez vos contrats, envoyez des bons de commande et gérez les paiements Stripe.', position: 'right' },
    { target: '[data-view="tasks"]', title: 'Module Tâches', content: 'Suivez vos actions commerciales et ne laissez rien passer grâce aux rappels et assignations.', position: 'right' },
    { target: '#profile-btn', title: 'Votre profil', content: 'Complétez votre profil (photo, coordonnées, SIRET) pour personnaliser vos documents et bons de commande.', position: 'right' },
    { target: null, title: 'Tutoriel terminé !', content: 'Vous êtes prêt à utiliser S@FE CRM. N\'hésitez pas à relancer ce tutoriel depuis le Centre d\'Aide (bouton "?" en bas à gauche).', position: 'center' },
  ],

  contacts: [
    { target: '#btn-new-contact', title: 'Créer un contact', content: 'Cliquez ici pour ouvrir le formulaire de création d\'un nouveau contact client ou prospect.', position: 'bottom' },
    { target: '#contacts-search', title: 'Rechercher', content: 'Tapez le nom ou l\'entreprise pour filtrer instantanément la liste des contacts.', position: 'bottom' },
    { target: '#contacts-filter-activite', title: 'Filtrer par activité', content: 'Filtrez vos contacts selon leur secteur d\'activité : site web, réseaux sociaux, Click & Collect…', position: 'bottom' },
    { target: null, title: 'Fiche contact', content: 'Cliquez sur un contact dans la liste pour ouvrir sa fiche complète : coordonnées, consentements RGPD, échanges et contrats associés.', position: 'center' },
  ],

  contracts: [
    { target: '#btn-new-contract', title: 'Créer un contrat', content: 'Cliquez ici pour créer un nouveau contrat. Sélectionnez le contact, le type de prestation et le montant.', position: 'bottom' },
    { target: '#contracts-filter-statut', title: 'Filtrer par statut', content: 'Filtrez vos contrats par statut : En attente, Envoyé, En cours, Paiement échoué, Résilié…', position: 'bottom' },
    { target: null, title: 'Cycle de vie d\'un contrat', content: 'Un contrat suit un cycle : Création → Envoi bon de commande → Signature client → Paiement Stripe → Contrat en cours → Résiliation ou Fin.', position: 'center' },
  ],

  tasks: [
    { target: '#btn-new-task', title: 'Créer une tâche', content: 'Cliquez ici pour créer une nouvelle tâche. Assignez-la à un membre de l\'équipe et fixez une date d\'échéance.', position: 'bottom' },
    { target: '#tasks-filter-assigne', title: 'Filtrer par assigné', content: 'Affichez uniquement vos tâches ou celles d\'un collaborateur spécifique.', position: 'bottom' },
  ],

};
