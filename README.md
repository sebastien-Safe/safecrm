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
- **Contacts** : fiche par prospect/client avec activités concernées (Digitalisation, RGPD, Assurance), statut, coordonnées.
- **Contrats** : liés à un contact, type de prestation (Référencement Local, DPO externe, Audit RGPD, Courtage Assurance, etc.), montant, récurrence, dates et statut.
  - **Formule pré-remplie** : pour les types « Référencement Local », « Click & Collect », « Mise en conformité RGPD » et « DPO externalisé », le menu "Formule" propose les offres et tarifs publiés sur safe-digitalisation.fr (Essentiel/Boost/Prestige, etc.). Sélectionner une formule remplit automatiquement le montant, la récurrence, et ajoute en note les éventuels frais de mise en place.
  - **Autres types** (Audit RGPD, Gestion Fiche Google Business, Courtage Assurance, Autre) : pas de tarif catalogue publié → la formule reste en saisie libre ("Personnalisé / Sur devis").
  - **Remise accordée** : case à cocher + montant (€ HT) déduit du tarif. Le montant net (après remise) s'affiche automatiquement et c'est lui qui est utilisé dans le calcul du CA récurrent (onglet Objectifs).
- **Tâches** : organisées en colonnes (À faire / En cours / Terminé), avec échéance, priorité et personne assignée. Les tâches en retard apparaissent en rouge.
- **Objectifs** : une jauge "compteur" par activité (Audit RGPD, Fiches Google, DPO, etc.) ainsi que des objectifs globaux (nouveaux clients, contrats signés, CA récurrent mensuel, tâches terminées).
  - **Jauges** : rouge si < 50 % de l'objectif, orange entre 50 et 75 %, vert au-delà de 75 %.
  - **Jours travaillés** : en début de mois, indiquez combien de jours vous comptez travailler — tous les objectifs "au prorata" sont automatiquement recalculés (objectif × jours travaillés / 20).
  - **"Modifier mes objectifs"** : ajustez à tout moment la valeur de référence (pour un mois plein de 20 jours) de chaque indicateur.
- **Profil** (en bas de la barre latérale) : cliquez sur votre avatar pour ajouter votre prénom et une photo de profil. Votre prénom remplace votre e-mail dans l'interface.

## 6. Évolutions possibles (sur demande)

- Pièces jointes (devis, contrats signés) via Supabase Storage
- Rappels par e-mail pour les tâches/échéances
- Export CSV des contacts/contrats
- Historique des échanges par contact
- Filtrage du tableau de bord par activité (Digitalisation / RGPD / Assurance)

---

*Document interne S@FE — usage non public.*
