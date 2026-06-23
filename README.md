# S@FE CRM

CRM interne tout-en-un pour S@FE Digitalisation : contacts, contrats, tâches, commissionnement, paiement Stripe, emails Brevo, IA, RGPD.

- **Frontend** : Vanilla JS SPA — hébergé sur GitHub Pages (`https://crm.safe-digitalisation.fr`)
- **Backend** : Supabase (PostgreSQL v28 + Auth + Edge Functions Deno)
- **Paiement** : Stripe (checkout + portail client + webhooks)
- **Emails** : Brevo (templates transactionnels)
- **IA** : Groq / Grok / Anthropic / Mistral via `call-ia`
- **CI/CD** : GitHub Actions (`.github/workflows/`)

---

## Variables d'environnement

### Frontend (`assets/config.js`)

```js
const SUPABASE_URL      = "https://<projet>.supabase.co";
const SUPABASE_ANON_KEY = "<clé anon publique>";
```

### Secrets Edge Functions (Supabase Dashboard → Project Settings → Edge Functions → Secrets)

| Secret | Utilisation |
|--------|-------------|
| `BREVO` | Clé API Brevo — emails transactionnels |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature webhook Stripe |
| `GROQ_API_KEY` | IA Groq (optionnel) |
| `GROK_API_KEY` | IA xAI/Grok (optionnel) |
| `ANTHROPIC_API_KEY` | IA Anthropic (optionnel) |
| `MISTRAL_API_KEY` | IA Mistral (optionnel) |

> Au moins un secret IA est requis pour le module `call-ia`. `GROQ_API_KEY` est recommandé (quota généreux gratuit).

---

## Installation (nouveau déploiement)

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) — région **Europe (Frankfurt)**.
2. Dans **SQL Editor**, exécuter les migrations dans l'ordre : `supabase/-schema-v1.sql` → `supabase/-schema-v28.sql` (un fichier par nouvelle query, dans l'ordre numérique).
3. Dans **Authentication → Providers → Email** : désactiver "Allow new users to sign up" (accès sur invitation uniquement).
4. Dans **Authentication → Providers → MFA** : activer TOTP.
5. Exécuter `bootstrap-admin.sql` (remplacer l'email) pour se promouvoir super-administrateur.
6. Configurer les secrets Edge Functions (tableau ci-dessus).

### 2. Stripe

1. Créer un compte [stripe.com](https://stripe.com) et récupérer la clé secrète.
2. Dans Stripe Dashboard → Developers → Webhooks : ajouter l'endpoint `https://<projet>.supabase.co/functions/v1/stripe-webhook`, sélectionner les events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
3. Configurer les secrets `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`.

### 3. Déploiement GitHub Pages

1. Pousser sur la branche `main`.
2. Dans le dépôt : **Settings → Pages → Source = main (root)**.
3. Configurer le domaine custom `crm.safe-digitalisation.fr` (CNAME DNS chez l'hébergeur).

---

## Edge Functions

Toutes les fonctions sont dans `supabase/functions/`. Déploiement via Supabase MCP ou CLI :

```bash
supabase functions deploy <nom-de-la-fonction>
```

| Fonction | Rôle | Auth |
|----------|------|------|
| `create-checkout` | Crée une session Stripe Checkout | Public (contrat par ID) |
| `stripe-webhook` | Traite les events Stripe | Signature HMAC Stripe |
| `admin-create-user` | Crée/réinitialise un utilisateur | Admin JWT |
| `send-clause-email` | Envoie la clause de confidentialité signée | Public |
| `send-mandat-email` | Envoie le mandat DCI signé + documents | JWT |
| `send-password-reset` | Envoie le lien de réinitialisation | Public |
| `send-crm-email` | Emails CRM (résiliation, bordereau, rapports) | Admin JWT |
| `call-ia` | Appel multi-provider IA | JWT |
| `cancel-subscription` | Résilie un abonnement Stripe | Admin JWT |
| `customer-portal` | Génère un lien portail Stripe | JWT |
| `check-resiliation-status` | Vérifie les abonnements en attente Stripe | Admin JWT / Cron |
| `record-login-failure` | Tracking tentatives + ban temporaire | Public |
| `delete-user` | Suppression RGPD avec archive JSON | Admin JWT |
| `agenda-ics` | Export calendrier iCal des tâches | Public (par UID) |

---

## Migrations SQL

Le schéma courant est **v28**. Chaque fichier `supabase/-schema-vN.sql` est cumulatif (ne pas sauter de version).

Pour un déploiement neuf, exécuter tous les fichiers de v1 à v28 dans l'ordre dans le SQL Editor Supabase.

Pour une mise à jour d'une instance existante, appliquer uniquement les nouvelles versions.

---

## CI/CD

Deux workflows GitHub Actions actifs :

| Workflow | Déclencheur | Vérifie |
|----------|-------------|---------|
| `security.yml` | Chaque push / PR | CORS wildcard, typo BREBO, SRI CDN, secrets .env commités |
| `deno-check.yml` | Changements dans `supabase/functions/` | `deno lint` + `deno check` sur toutes les Edge Functions |

Le hook pre-commit local (`.git/hooks/pre-commit`) bloque les commits avec des scripts CDN sans hash SRI.
Référence manuelle des hashes : `bash scripts/check-sri.sh`.

---

## Sécurité

- **CORS** : `Access-Control-Allow-Origin` restreint à `https://crm.safe-digitalisation.fr` sur toutes les Edge Functions browser-facing. `stripe-webhook` sans CORS (appelé par Stripe).
- **SRI** : attributs `integrity="sha384-…"` sur tous les scripts CDN tiers (supabase-js, jsPDF, QRCode, Chart.js).
- **RLS** : policies Postgres granulaires par opération (SELECT / INSERT / UPDATE / DELETE) sur toutes les tables.
- **2FA TOTP** : obligatoire recommandée pour les administrateurs.
- **Webhook Stripe** : signature HMAC vérifiée, aucun fallback sans vérification.
- **Rate limiting** : `record-login-failure` (5 tentatives → ban 30 min), `cancel-subscription` (5/heure/admin).
- **Archivage RGPD** : suppression utilisateur = archive JSON dans Supabase Storage (conservation 5 ans, Art. L123-22 C.com).

---

## Structure du projet

```
.
├── assets/              # JS, CSS, images
├── work/                # Pages HTML secondaires (modules)
├── supabase/
│   ├── functions/       # 14 Edge Functions Deno
│   └── -schema-vN.sql   # Migrations SQL (v1 → v28)
├── scripts/
│   └── check-sri.sh     # Vérification hashes SRI
├── .github/workflows/   # CI/CD GitHub Actions
├── index.html           # SPA principale
├── bootstrap-admin.sql  # Promotion super-admin (à exécuter une fois)
└── rapport-audit.html   # Rapport d'audit sécurité
```

---

*Usage interne S@FE — document non public.*
