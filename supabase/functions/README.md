# S@FE CRM — Edge Functions

14 fonctions Deno déployées sur Supabase Edge Runtime.  
URL de base : `https://qdjmzietysukediqkebg.supabase.co/functions/v1/`

## Secrets requis

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL du projet (auto-injectée) |
| `SUPABASE_ANON_KEY` | Clé publique (auto-injectée) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service (auto-injectée) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe live (`sk_live_…`) |
| `BREVO` | Clé API Brevo (email) |
| `TVA_MULTIPLIER` | Coefficient TTC en centimes (défaut `120` = TVA 20 %) |
| `BREVO_TEMPLATE_RESILIATION` | ID template Brevo résiliation (défaut `3`) |
| `BREVO_TEMPLATE_BORDEREAU` | ID template Brevo bordereau commission (défaut `4`) |
| `BREVO_TEMPLATE_COMMISSION` | ID template Brevo paiement commission (à définir) |
| `BREVO_TEMPLATE_MANDAT` | ID template Brevo mandat DCI (défaut `5`) |
| `BREVO_TEMPLATE_CLAUSE_PUBLIC` | ID template Brevo clause publique (défaut `6`) |
| `BREVO_TEMPLATE_CLAUSE_COLLAB` | ID template Brevo clause collaborateur (défaut `7`) |
| `GROQ_API_KEY` / `GROK_API_KEY` / `ANTHROPIC_API_KEY` / `MISTRAL_API_KEY` | Clés IA (au moins une requise pour `call-ia`) |

---

## Référence des fonctions

### `admin-create-user`
**Créer un utilisateur CRM**

| | |
|---|---|
| Méthode | `POST` |
| Auth | JWT admin (`is_admin = true`) |
| CORS | `https://crm.safe-digitalisation.fr` |

**Body :**
```json
{ "email": "x@y.fr", "prenom": "Jean", "nom": "Dupont", "role": "dci", "password": "opt." }
```
**Réponse :** `{ "ok": true, "user_id": "uuid" }`

---

### `agenda-ics`
**Export agenda iCal des tâches**

| | |
|---|---|
| Méthode | `GET` |
| Auth | Aucune (URL publique avec paramètre `uid`) |
| CORS | — |

**Paramètre :** `?uid=<user_id>`  
**Réponse :** fichier `.ics` (MIME `text/calendar`) avec les tâches non terminées de l'utilisateur.

---

### `call-ia`
**Proxy IA multi-fournisseurs**

| | |
|---|---|
| Méthode | `POST` |
| Auth | JWT utilisateur |
| CORS | `https://crm.safe-digitalisation.fr` |

**Body :**
```json
{ "system": "Tu es...", "messages": [{"role":"user","content":"..."}], "service_key": "groq" }
```
`service_key` optionnel — si absent, utilise le premier connecteur actif (`safe_connectors`) selon priorité : `groq > grok > anthropic > mistral`.

**Réponse :** `{ "content": "réponse IA" }`

---

### `cancel-subscription`
**Résilier un abonnement Stripe**

| | |
|---|---|
| Méthode | `POST` |
| Auth | JWT admin |
| CORS | `https://crm.safe-digitalisation.fr` |
| Rate limit | 5 résiliations / heure / admin |

**Body :**
```json
{ "contract_id": "uuid", "cancelled_by": "opt.", "resync": false }
```
**Réponse :** `{ "ok": true, "status": "Résiliation en attente Stripe" }`

---

### `check-resiliation-status`
**Vérifier les statuts d'abonnements Stripe**

| | |
|---|---|
| Méthode | `GET` ou `POST` |
| Auth | JWT admin **ou** service_role (cron interne) |
| CORS | `https://crm.safe-digitalisation.fr` |

Interroge Stripe pour chaque contrat en statut `Résiliation en attente Stripe` et met à jour la DB si `canceled` ou `cancel_at_period_end`. Envoie une alerte admin si blocage > 48h.

**Réponse :** `{ "checked": N, "updated": M }`

---

### `create-checkout`
**Créer une session Stripe Checkout**

| | |
|---|---|
| Méthode | `POST` |
| Auth | JWT utilisateur |
| CORS | `https://crm.safe-digitalisation.fr` |

**Body :**
```json
{ "contract_id": "uuid" }
```
Calcule TTC = HT × `TVA_MULTIPLIER` en centimes. Crée une session `subscription` (mensuel) ou `payment` (ponctuel).

**Réponse :** `{ "url": "https://checkout.stripe.com/..." }`

---

### `customer-portal`
**Accéder au portail client Stripe**

| | |
|---|---|
| Méthode | `POST` |
| Auth | JWT admin |
| CORS | `https://crm.safe-digitalisation.fr` |

**Body :**
```json
{ "contract_id": "uuid" }
```
**Réponse :** `{ "url": "https://billing.stripe.com/..." }`

---

### `delete-user`
**Supprimer un utilisateur CRM**

| | |
|---|---|
| Méthode | `POST` |
| Auth | JWT admin |
| CORS | `https://crm.safe-digitalisation.fr` |

**Body :**
```json
{ "target_user_id": "uuid" }
```
Archivage RGPD automatique (profil + logs) dans `deleted_users` avant suppression. Conservation légale 5 ans (Art. L123-22 C.com).

**Réponse :** `{ "ok": true, "archived": true }`

---

### `record-login-failure`
**Enregistrer un échec de connexion**

| | |
|---|---|
| Méthode | `POST` |
| Auth | Aucune (publique) |
| CORS | `https://crm.safe-digitalisation.fr` |
| Rate limit | 30 appels / heure / IP |

**Body :**
```json
{ "email": "x@y.fr" }
```
Incrémente `login_attempts`. Après 5 échecs : ban 30 min via `banned_until` dans `profiles`. Ne révèle pas si l'email existe.

**Réponse :** `{ "attempts": N, "banned": false, "remaining": M }`

---

### `send-clause-email`
**Envoyer une clause de confidentialité signée**

| | |
|---|---|
| Méthode | `POST` |
| Auth | Aucune (`verify_jwt: false`) |
| CORS | `https://crm.safe-digitalisation.fr` |

**Body :**
```json
{ "type": "collaborateur|public", "email": "x@y.fr", "prenom": "…", "nom": "…", "date_signature": "ISO", "pdf_base64": "opt." }
```
Templates Brevo : `BREVO_TEMPLATE_CLAUSE_COLLAB` (7) ou `BREVO_TEMPLATE_CLAUSE_PUBLIC` (6).

**Réponse :** `{ "ok": true }`

---

### `send-crm-email`
**Envoi d'emails CRM (multi-type)**

| | |
|---|---|
| Méthode | `POST` |
| Auth | JWT admin |
| CORS | `https://crm.safe-digitalisation.fr` |

**Types supportés (`type` dans le body) :**

| `type` | Description | Template Brevo |
|---|---|---|
| `resiliation` | Email de résiliation au client | `BREVO_TEMPLATE_RESILIATION` (3) |
| `bordereau` | Bordereau de commission au commercial | `BREVO_TEMPLATE_BORDEREAU` (4) |
| `commission_payee` | Confirmation virement commission | `BREVO_TEMPLATE_COMMISSION` (à définir) |
| `rapport_dpo` | Rapport RGPD/DPO au contact | HTML libre |
| `rapport_seo` | Rapport SEO au contact | HTML libre |
| `rapport_cyber` | Rapport cybersécurité au contact | HTML libre |
| `alerte_incident` | Alerte incident cyber au contact | HTML libre |
| `violation_cnil` | Alerte violation données à l'admin | HTML libre — objet `🚨🚨🚨🚨VIOLATION DE DONNÉES🚨🚨🚨🚨` |

---

### `send-mandat-email`
**Envoyer un mandat DCI signé**

| | |
|---|---|
| Méthode | `POST` |
| Auth | JWT utilisateur |
| CORS | `https://crm.safe-digitalisation.fr` |

**Body :**
```json
{ "prenom": "…", "nom": "…", "numero": "M-2026-001", "signed_at": "ISO", "pdf_base64": "opt." }
```
Joint automatiquement les documents commerciaux statiques depuis Supabase Storage (`WORK/Force-de-vente/documents-contractuels`).  
Template Brevo : `BREVO_TEMPLATE_MANDAT` (5).

**Réponse :** `{ "ok": true, "attachments": N }`

---

### `send-password-reset`
**Réinitialisation de mot de passe**

| | |
|---|---|
| Méthode | `POST` |
| Auth | Aucune |
| CORS | `https://crm.safe-digitalisation.fr` |

**Body :**
```json
{ "action": "reset|confirmation", "email": "x@y.fr", "redirectTo": "opt." }
```
- `reset` : génère un lien Supabase + envoie template Brevo 10
- `confirmation` : envoie email de confirmation changement réussi (template Brevo 11)

**Réponse :** `{ "ok": true }`

---

### `stripe-webhook`
**Récepteur d'événements Stripe**

| | |
|---|---|
| Méthode | `POST` |
| Auth | `Stripe-Signature` header (secret `STRIPE_WEBHOOK_SECRET`) |
| CORS | Aucun (pas d'appel browser) |
| verify_jwt | `false` |

**Événements gérés :**

| Événement | Action |
|---|---|
| `checkout.session.completed` | Met à jour `contracts.statut` → Actif, génère et envoie la facture PDF par email |
| `customer.subscription.deleted` | Met à jour `contracts.statut` → Résilié |
| `invoice.payment_succeeded` | Enregistre dans `factures`, envoie facture PDF récurrente |
| `invoice.payment_failed` | Met à jour `contracts.statut` → Paiement en échec |

**Réponse :** `{ "received": true }`
