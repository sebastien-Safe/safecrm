# S@FE CRM

Outil interne tout-en-un pour S@FE : **contacts**, **contrats** et **tâches**, couvrant les trois activités (Digitalisation/SEO local, RGPD, Assurance).

- Frontend statique (HTML/CSS/JS), hébergeable sur **GitHub Pages**
- Backend : **Supabase** (base PostgreSQL + authentification), gratuit
- Accès réservé : seules les personnes que vous créez manuellement (vous + futur collaborateur) peuvent se connecter

---

## 1. Créer le projet Supabase (5 min)

1. Allez sur [supabase.com](https://supabase.com) et créez un compte gratuit.
2. Cliquez sur **New project**.
   - Choisissez une région **Europe** (ex: Frankfurt) pour rester cohérent avec vos obligations RGPD.
   - Notez le mot de passe de la base (à conserver précieusement, vous n'en aurez normalement plus besoin).
3. Une fois le projet créé, allez dans **SQL Editor** (menu de gauche) → **New query**.
4. Copiez-collez l'intégralité du contenu du fichier [`supabase-schema.sql`](./supabase-schema.sql) puis cliquez sur **Run**.
   - Cela crée les tables `contacts`, `contracts`, `tasks` et active la sécurité (RLS) : seules les personnes connectées peuvent lire/écrire.
5. Faites de même avec le fichier [`supabase-schema-v2.sql`](./supabase-schema-v2.sql) (nouvelle requête → coller → **Run**).
   - Cela ajoute la table `profiles` (prénom, photo, jours travaillés/mois), la table `objectifs` (avec des objectifs par défaut pour chaque activité) et un espace de stockage `avatars` pour les photos de profil.
6. Faites de même avec le fichier [`supabase-schema-v3.sql`](./supabase-schema-v3.sql) (nouvelle requête → coller → **Run**).
   - Cela ajoute une colonne `remise` sur les contrats (remise € HT déduite du tarif catalogue).
7. Faites de même avec le fichier [`supabase-schema-v4.sql`](./supabase-schema-v4.sql) (nouvelle requête → coller → **Run**).
   - Ajoute `created_by` sur contacts et contrats (auteur de la fiche).
   - Ouvre la lecture des profils (prénom/photo) à tous les utilisateurs connectés, pour afficher "Ajouté par" — l'écriture reste limitée à son propre profil.
   - Remplace les objectifs par 3 jauges : **Entrées en contact**, **CA généré**, **Commissions reversées** (avec taux de commission éditable).
8. Faites de même avec le fichier [`supabase-schema-v5.sql`](./supabase-schema-v5.sql) (nouvelle requête → coller → **Run**).
   - Ajoute le type de tâche (Premier contact / RDV visio / RDV terrain / Autre) avec date, heure et lieu de RDV.
   - Ajoute la case **RGPD KO** sur les contacts (droit d'opposition).
9. Faites de même avec le fichier [`supabase-schema-v6.sql`](./supabase-schema-v6.sql) (nouvelle requête → coller → **Run**).
   - Met à jour le libellé de l'objectif "Commissions reversées" pour préciser le taux fixe de 12 %.
10. Faites de même avec le fichier [`supabase-schema-v7.sql`](./supabase-schema-v7.sql) (nouvelle requête → coller → **Run**).
    - **Statut super-administrateur** (`profiles.is_admin`) + fonction `is_admin()` utilisée par RLS.
    - **Objectifs par utilisateur** (`objectifs.user_id` + RLS stricte : chacun ne voit que ses propres objectifs, l'admin voit tout).
    - **Table `messages`** pour les pop-ups admin → utilisateur.
    - **Cases "Consentement"** sur les contacts (téléphone / e-mail / courrier).
    - **RPC d'administration** : `admin_list_users`, `admin_set_banned`, `admin_set_admin`, `admin_create_user`.
    - **⚠️ ACTION MANUELLE REQUISE** : à la fin du script, décommentez et exécutez la ligne `update profiles set is_admin = true ...` en y mettant votre e-mail, pour vous promouvoir super-administrateur.
11. Faites de même avec le fichier [`supabase-schema-v8.sql`](./supabase-schema-v8.sql) (nouvelle requête → coller → **Run**).
    - Ajoute **SIRET**, **forme juridique** et **code postal/ville** sur les contacts (mentions obligatoires des bons de commande).

## 2. Récupérer les clés d'API

1. Dans Supabase, allez dans **Project Settings** (icône ⚙️) → **API**.
2. Copiez :
   - **Project URL**
   - **anon public** (clé API publique)
3. Ouvrez le fichier [`assets/config.js`](./assets/config.js) et remplacez :

```js
const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
const SUPABASE_ANON_KEY = "VOTRE_CLE_ANON_PUBLIC";
```

> ℹ️ La clé "anon" est conçue pour être visible publiquement (elle est protégée par les règles RLS). Vos données restent privées car seuls les comptes que vous créez à l'étape suivante peuvent s'authentifier.

## 3. Créer vos comptes d'accès (vous + collaborateur)

Par défaut, Supabase autorise n'importe qui à créer un compte. Pour un usage interne, il est recommandé de **désactiver les inscriptions publiques** :

1. Dans Supabase : **Authentication** → **Providers** → **Email** → désactivez "Allow new users to sign up".
2. Toujours dans **Authentication** → **Users** → **Add user** :
   - Créez votre compte (votre e-mail + un mot de passe).
   - Plus tard, ajoutez de la même façon un compte pour votre collaborateur.

## 4. Déployer sur GitHub Pages

1. Placez tous les fichiers de ce dossier (`index.html`, `assets/`, `supabase-schema.sql`, `README.md`) à la racine de votre nouveau dépôt GitHub.
2. Dans le dépôt GitHub : **Settings** → **Pages** → Source = branche `main` (dossier `/root`).
3. Patientez quelques minutes : votre CRM sera accessible à l'URL fournie par GitHub Pages (ex : `https://sebastien-safe.github.io/nom-du-depot/`).

> ⚠️ Le site sera techniquement accessible publiquement (comme tout site GitHub Pages), mais **sans compte Supabase valide, impossible de se connecter ni de voir la moindre donnée**. Pour une confidentialité renforcée, vous pourrez plus tard envisager un dépôt privé + GitHub Pages avec restriction d'accès (fonctionnalité payante GitHub), ou un autre hébergeur supportant l'authentification d'accès.

## 5. Utilisation

- **Tableau de bord** : vue d'ensemble (nombre de contacts, clients actifs, contrats en cours, tâches en retard).
- **Contacts** : fiche par prospect/client avec activités concernées (Digitalisation, RGPD, Assurance), statut, coordonnées, et la personne de l'équipe qui a enregistré la fiche ("Ajouté par").
- **Contrats** : liés à un contact, type de prestation (Référencement Local, Click & Collect, Mise en conformité RGPD, DPO externe, Cybersécurité, Audit RGPD, Courtage Assurance, etc.), montant, récurrence, dates, statut et auteur ("Ajouté par").
  - **Formule pré-remplie** : pour « Référencement Local », « Click & Collect », « Mise en conformité RGPD », « DPO externalisé » et « Cybersécurité », le menu "Formule" propose les offres et tarifs publiés sur safe-digitalisation.fr. Sélectionner une formule remplit automatiquement le montant, la récurrence, et ajoute en note les frais de mise en place et l'engagement minimum éventuels :
    - Référencement Local : Essentiel 79 €/mois (+150 €, engagement 6 mois), Boost 149 €/mois (+250 €, 6 mois), Prestige 249 €/mois (mise en place offerte, 3 mois)
    - Click & Collect : Essentiel 39 €/mois (+150 €, 6 mois), Pro 79 €/mois (+250 €, 6 mois), Premium 129 €/mois (mise en place offerte, 3 mois)
    - Mise en conformité RGPD : Diagnostic offert (0 €) ou Mise en conformité (1 490 € forfait)
    - DPO externalisé : 149 €/mois, engagement 12 mois
    - Cybersécurité : Audit de vulnérabilité 490 €, Pack Sécurité Essentiel 990 €, Pack Résilience Pro 1 990 € (prestations ponctuelles)
  - **Autres types** (Audit RGPD, Gestion Fiche Google Business, Courtage Assurance, Autre) : pas de tarif catalogue publié → la formule reste en saisie libre ("Personnalisé / Sur devis").
  - **Remise accordée** : case à cocher + montant (€ HT) déduit du tarif. Le montant net (après remise) s'affiche automatiquement et c'est lui qui est utilisé dans les calculs de l'onglet Objectifs.
  - **Échéance calculée automatiquement** : dès que vous renseignez la date de début (et qu'une formule avec engagement ou délai de livraison est sélectionnée), l'échéance se calcule toute seule :
    - Référencement Local / Click & Collect / DPO externalisé : date de début + durée d'engagement (3, 6 ou 12 mois selon la formule).
    - Cybersécurité (Audit / Pack Essentiel / Pack Résilience Pro) : date de début + délai de livraison annoncé (5 / 10 / 15 jours ouvrés).
    - Le champ reste modifiable manuellement si besoin.
- **Tâches** : organisées en colonnes (À faire / En cours / Terminé), avec échéance, priorité et personne assignée. Les tâches en retard apparaissent en rouge.
- **Objectifs** : 3 jauges "compteur", ajustées selon vos jours travaillés du mois :
  - **Entrées en contact** : nombre de nouveaux contacts (prospects ou clients) enregistrés ce mois-ci.
  - **CA généré** : somme des montants nets (après remise) des contrats signés/en cours/terminés dont la date de début est ce mois-ci, tous types confondus.
  - **Commissions reversées** : CA généré × **12 %** (taux fixe, non modifiable — voir l'encadré "À propos du calcul des commissions" ci-dessous).
  - **Jauges** : rouge si < 50 % de l'objectif, orange entre 50 et 75 %, vert au-delà de 75 %.
  - **Jours travaillés** : en début de mois, indiquez combien de jours vous comptez travailler — les objectifs sont automatiquement recalculés (objectif × jours travaillés / 20).
  - **"Modifier mes objectifs"** : ajustez à tout moment la cible (en €, en nombre, etc.) de chaque indicateur. Le taux de commission n'est plus modifiable depuis cette modale (voir ci-dessous).

> #### À propos du calcul des commissions
> La page [Recrutement](https://www.safe-digitalisation.fr/recrutement.html) ne publie pas de grille de commissionnement détaillée par produit : elle indique seulement une fourchette de **10 à 15 % du CA généré** (source APAC France), la grille précise étant "définie lors de l'entretien de cadrage" avec chaque commercial.
>
> En l'absence de cette grille, le CRM applique le **taux médian de 12 %** sur l'ensemble du CA généré (tous produits confondus), de façon **fixe et non modifiable**.
>
> **Pour un calcul réellement "par produit vendu"**, il faudrait nous communiquer par exemple :
> - un taux de commission différent par offre (ex : Référencement Local, Click & Collect, RGPD, Cybersécurité, Assurance…) ;
> - une éventuelle **prime à la signature** (montant fixe par nouveau contrat, en plus du % récurrent) ;
> - si le taux diffère entre **commission à la signature** et **commission récurrente** sur abonnements actifs.
>
> Dès que vous avez ces informations, transmettez-les et le calcul sera affiné en conséquence (`assets/app.js`, constante `COMMISSION_RATE` et fonction `computeObjectifValue`).

- **Profil** (en bas de la barre latérale) : cliquez sur votre avatar pour ajouter votre prénom et une photo de profil. Votre prénom remplace votre e-mail dans l'interface.
- **Logo** : le logo S@FE (bouclier) remplace le texte "S@FE CRM" dans la barre latérale et sur les écrans de connexion.
- **Tableau de bord** : l'en-tête affiche désormais "Tableau de bord de [votre prénom]" ainsi que la date et l'heure de Paris, mises à jour automatiquement.
  - **Alerte échéances** : un bandeau apparaît en haut du tableau de bord dès qu'un contrat arrive à échéance dans les **15 prochains jours** (ou est déjà en retard), avec le contact, le type/formule et le nombre de jours restants.
- **Tâches** : un menu **Type de tâche** est désormais obligatoire :
  - **Premier contact** / **Autre** : aucun champ supplémentaire.
  - **RDV visio** / **RDV terrain** : affiche des champs **Date**, **Heure** et **Lieu / Lien** (le libellé s'adapte : "Lieu du RDV" pour le terrain, "Lieu / Lien visio" pour la visio). L'échéance de la tâche est automatiquement alignée sur la date du RDV.
  - Le type s'affiche en badge sur chaque carte du Kanban, avec les infos de RDV le cas échéant.
- **RGPD KO** (droit d'opposition) : dans la fiche contact, une case "RGPD KO" permet de signaler qu'un prospect/client ne souhaite plus être sollicité.
  - À la confirmation, l'**e-mail, le téléphone et l'adresse sont définitivement effacés**, et la fiche passe en **lecture seule**.
  - Dans la liste des contacts, la ligne s'affiche **en rouge** avec un badge "🚫 RGPD KO" à la place du statut.

## 6. Évolutions possibles (sur demande)

- Pièces jointes (devis, contrats signés) via Supabase Storage
- Rappels par e-mail pour les tâches/échéances
- Export CSV des contacts/contrats
- Historique des échanges par contact
- Filtrage du tableau de bord par activité (Digitalisation / RGPD / Assurance)

---

*Document interne S@FE — usage non public.*

## Nouveautés du tour actuel

### Sécurité

- **Déconnexion automatique par inactivité** : au bout de 5 minutes sans activité (clavier, souris, scroll, toucher), la session est terminée et l'utilisateur doit se reconnecter avec son mot de passe. La détection prend également en compte le retour sur l'onglet (si on revient après plus de 5 min, la session est expirée).
- **Super-administrateur** : un utilisateur promu `is_admin = true` accède à un onglet **Administration** dans la barre latérale (caché pour les autres). Il peut :
  - voir les chiffres de TOUS les utilisateurs (par utilisateur + total cumulé) ;
  - gérer les comptes (créer / révoquer / restaurer / promouvoir un autre admin) ;
  - **envoyer un message pop-up** qui s'affiche sur l'écran du destinataire à sa prochaine ouverture du dashboard ;
  - **contrôler les contacts RGPD KO** : onglet dédié pour ré-ouvrir une fiche verrouillée par erreur ;
  - consulter le **Registre RGPD Article 30** et l'exporter en PDF.
- **Objectifs strictement par utilisateur** : grâce à la RLS Postgres, un utilisateur ne voit QUE ses propres objectifs et chiffres. Aucune fuite possible vers les autres comptes. Seul un super-administrateur agrège.

### RGPD utilisateur

- **Consentements sur la fiche contact** : trois cases à cocher (téléphone / e-mail / courrier postal). Automatiquement décochées si la fiche passe en RGPD KO.
- **Bouton "🔐 Mes données (RGPD)"** sur le dashboard utilisateur : permet à chaque utilisateur de consulter et modifier ses propres données, et de formuler une demande d'effacement / portabilité par e-mail (lien `mailto:` préformaté avec son identifiant).
- **Registre RGPD Article 30** intégré : 5 traitements documentés (comptes utilisateurs, contacts, contrats, objectifs, messagerie interne), avec finalité / base légale / catégories / destinataires / durée / mesures de sécurité. Exportable en PDF paysage.

### Tunnel de vente (phase 1)

- **Génération de bons de commande PDF pré-remplis** depuis la modale Contrat (bouton "📄 Bon de commande PDF") :
  - 4 modèles couverts : SEO Local, Click & Collect, Cybersécurité & Résilience, Conformité RGPD & DPO Externalisé.
  - Référence unique générée automatiquement : `SAFE-BC-<TYPE>-<YYMMDD>-<ID>`.
  - Inclut les mentions légales du Prestataire **et** du Client (SIRET, forme juridique, adresse de facturation, représentant) si renseignées dans la fiche contact ; sinon ligne à compléter manuellement.
  - Récapitulatif financier complet (HT, remise, frais de mise en place, TVA 20 %, TTC).
  - Cadre signature "Bon pour accord" en bas de page.
- Le PDF est téléchargé localement et peut être envoyé manuellement au client par e-mail. La **phase 2** (signature électronique à distance, dépôt automatique sur kDrive, envoi automatique au client) nécessite des arbitrages externes : voir section ci-dessous.

### Ergonomie

- **Logo retiré de la page de connexion** (gardé sur la sidebar et l'écran de réinitialisation).
- **Favicon avec coche rouge** (variante du favicon en dégradé gris existant).
- **Bouton flottant d'assistance** (icône `?`) en bas à droite de toutes les pages : ouvre une modale qui permet d'envoyer un e-mail préformaté à `contact@safe-digitalisation.fr` avec l'identifiant utilisateur.
- **🏆 Feu d'artifice + pop-up de félicitations** dès qu'un utilisateur atteint son objectif "Commissions reversées" du mois courant. Une seule fois par mois et par utilisateur (mémoire `localStorage`).

## Phase 2 du tunnel de vente — arbitrages requis

Pour fermer le tunnel (signature électronique à distance + dépôt automatique sur kDrive + envoi e-mail au client), il faut me communiquer :

1. **Service de signature électronique** choisi (recommandation : **Yousign**, français, eIDAS Niveau 2, ~9 €/mois + 1-2 €/signature). Alternatives : DocuSign, PandaDoc, e-Signatures.io.
2. **Credentials kDrive Infomaniak** : token d'API (Manager → Sécurité → Application Token) + drive ID cible.
3. **Service d'envoi de mail transactionnel** : Resend (gratuit jusqu'à 3 000 mails/mois), Postmark, Brevo, ou directement votre SMTP Infomaniak.

Une fois ces trois éléments arbitrés, la phase 2 sera implémentée via une Edge Function Supabase (pour ne pas exposer les secrets côté navigateur).

## Double authentification TOTP — à activer dans Supabase

Pour activer la 2FA via QR code (compatible Google Authenticator, Authy, 1Password) :

1. **Dans votre projet Supabase** → Authentication → Providers → MFA → activer "TOTP".
2. Une fois activé, je code l'écran d'enrôlement (modale qui affiche le QR code à scanner) et la vérification au login (saisie du code à 6 chiffres).


## Tunnel de vente — phase 2 (signature électronique + dépôt kDrive + envoi mail)

### Architecture mise en place

```
Navigateur (CRM)                   Supabase Edge Function          APIs externes
─────────────────                  ──────────────────────          ─────────────
1. Bouton "Envoyer pour signature"  
2. Modale signature canvas
3. Capture signature PNG + horodat. Europe/Paris
4. Génération du PDF Blob (jsPDF)
   avec signature et bloc traçabilité
5. POST /functions/v1/send-contract ──► JWT vérifié
                                       Lecture secrets env vars
                                       Upload kDrive            ──► api.infomaniak.com
                                       Envoi mail au client     ──► smtp.mail.me.com
                              ◄────── { ok, kdrive: {...} }
6. Trace en DB (sent_for_signature_*)
7. Notification UI succès
```

### Mise en route — 3 étapes

1. **Exécutez** `supabase-schema-v9.sql` (ajoute `sent_for_signature_at`, `sent_for_signature_to`, `signed_pdf_kdrive_url` sur la table contracts).
2. **Configurez les secrets** dans Supabase (voir [`supabase/functions/send-contract/README.md`](./supabase/functions/send-contract/README.md)).
3. **Déployez l'Edge Function** : `supabase functions deploy send-contract` (ou via le dashboard).

### Valeur juridique

Cette implémentation est une **signature électronique simple** (art. 1367 du Code civil + art. 25 eIDAS) : suffisante pour un bon de commande commercial BtoB. Pour les engagements à enjeu élevé, basculez sur un service eIDAS niveau substantiel/qualifié (Yousign, Universign, DocuSign Advanced).

Le PDF généré comporte automatiquement un bloc de traçabilité avec : horodatage Europe/Paris, identité du signataire, nature du dispositif, textes applicables.

## Double authentification TOTP

Une fois la 2FA TOTP **activée dans Supabase** (Authentication → Providers → MFA → TOTP) :

1. Chaque utilisateur peut activer sa 2FA depuis **Profil → Activer la 2FA** : un QR code s'affiche, à scanner avec Google Authenticator / Authy / 1Password / Microsoft Authenticator.
2. Une fois activée, à chaque connexion (après le mot de passe), une modale demande le code à 6 chiffres.
3. L'utilisateur peut désactiver sa 2FA à tout moment depuis le même menu (sous réserve qu'il soit authentifié au niveau aal2).
4. La 2FA est **individuelle** : chaque utilisateur l'active ou non. Vous pouvez la rendre **obligatoire pour les admins** en ajoutant une politique RLS supplémentaire (à demander si vous le souhaitez).
