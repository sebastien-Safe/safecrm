# Déploiement de l'Edge Function `send-contract`

Cette Edge Function s'exécute côté Supabase (et non dans le navigateur). C'est elle qui détient les **secrets sensibles** (token kDrive, mot de passe SMTP iCloud) et qui les utilise pour :
1. déposer le PDF signé sur votre kDrive ;
2. envoyer ce PDF par e-mail au client.

Le navigateur ne fait que générer le PDF et appeler la fonction avec son JWT utilisateur. Les secrets restent côté serveur, jamais exposés.

---

## ⚠️ Sécurité — actions prioritaires

Les credentials que vous m'avez transmis dans le chat sont **considérés comme compromis** dès leur communication par un canal externe. Avant tout déploiement :

1. **Révoquer le token kDrive** : Infomaniak Manager → Sécurité → Application Tokens → supprimer celui partagé.
2. **Régénérer un nouveau token kDrive** avec le scope `drive` **uniquement**, et idéalement restreint au drive `3217898`.
3. **Révoquer le mot de passe d'app iCloud** : appleid.apple.com → Sécurité → Mots de passe spécifiques aux apps → supprimer `ogxw-homj-kisy-kawd`.
4. **Régénérer un nouveau mot de passe d'app** dédié au CRM.

Ne réutilisez **jamais** ces deux secrets ailleurs (ni dans un autre projet, ni dans un mail, ni dans un autre chat).

---

## Étape 1 — Configurer les secrets dans Supabase

### Option A — Via le tableau de bord (recommandée)

1. Connectez-vous à votre projet Supabase : <https://supabase.com/dashboard/project/tqfkdwashuepzstpxdlw>
2. Menu de gauche → **Project Settings** (icône engrenage) → **Edge Functions**.
3. Section **Secrets** → cliquez sur **Add new secret** pour chaque ligne :

| Nom | Valeur |
| --- | --- |
| `KDRIVE_ID` | `3217898` |
| `KDRIVE_FOLDER_ID` | `149` |
| `KDRIVE_TOKEN` | *(votre NOUVEAU token kDrive régénéré)* |
| `SMTP_HOST` | `smtp.mail.me.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `contact@safe-digitalisation.fr` |
| `SMTP_PASSWORD` | *(votre NOUVEAU mot de passe d'app iCloud)* |
| `SMTP_FROM_NAME` | `S@FE Digitalisation` |

> `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont automatiquement fournis aux Edge Functions, pas besoin de les ajouter.

### Option B — Via la CLI Supabase

Si vous avez la CLI installée localement :

```bash
supabase login
supabase link --project-ref tqfkdwashuepzstpxdlw

supabase secrets set \
  KDRIVE_ID=3217898 \
  KDRIVE_FOLDER_ID=149 \
  KDRIVE_TOKEN='<nouveau token>' \
  SMTP_HOST=smtp.mail.me.com \
  SMTP_PORT=587 \
  SMTP_USER=contact@safe-digitalisation.fr \
  SMTP_PASSWORD='<nouveau mot de passe app>' \
  SMTP_FROM_NAME='S@FE Digitalisation'
```

---

## Étape 2 — Déployer l'Edge Function

### Via la CLI Supabase (recommandé)

```bash
cd safe-crm    # racine du projet, contient le dossier supabase/functions/send-contract
supabase functions deploy send-contract
```

Vérifiez que le déploiement réussit. La fonction sera accessible à l'URL :
`https://tqfkdwashuepzstpxdlw.supabase.co/functions/v1/send-contract`

### Via le tableau de bord (sans CLI)

1. Dashboard Supabase → **Edge Functions** → **Deploy a new function**.
2. Nom : `send-contract`.
3. Copiez/collez le contenu de `supabase/functions/send-contract/index.ts`.
4. Cliquez sur **Deploy**.

---

## Étape 3 — Tester

1. Dans le CRM, ouvrez un contrat existant (lié à un contact qui a un e-mail valide).
2. Cliquez sur **📤 Envoyer pour signature**.
3. Le client signe au canvas, saisit la mention « Lu et approuvé », et clique sur **Signer et envoyer**.
4. Vérifiez :
   - **kDrive** : un fichier `SAFE-BC-XXX-YYMMDD-XXXXXX.pdf` doit apparaître dans le dossier 149 de votre drive 3217898.
   - **Mail** : le client doit recevoir un e-mail avec le PDF en pièce jointe (votre adresse `contact@safe-digitalisation.fr` est en copie cachée à des fins de traçabilité — voir la ligne `cc` dans le code de la fonction).

---

## Sécurité de l'Edge Function

- ✅ Le JWT utilisateur est **vérifié** côté Edge Function avant tout appel à kDrive/SMTP (un visiteur anonyme ne peut pas déclencher d'envoi).
- ✅ Les secrets ne sont **jamais** transmis au navigateur, ni écrits dans le code source du repo.
- ✅ L'utilisateur S@FE est ajouté en **CC** sur tous les envois (preuve d'envoi en cas de litige).
- ⚠️ Si vous voulez ajouter une journalisation explicite des envois en base, ajoutez un `INSERT INTO contracts_sent_log (...)` dans la fonction (à coder côté Supabase).

---

## Valeur juridique de la signature canvas + horodatage

Cette implémentation correspond à une **signature électronique simple** (au sens de l'article 1367 du Code civil et de l'article 25 du règlement eIDAS). C'est suffisant pour un bon de commande commercial entre professionnels.

Pour les contrats à enjeu élevé (engagements > 50 k€, baux, transactions immobilières, etc.), basculez sur un service de signature **eIDAS niveau substantiel ou qualifié** : Yousign, Universign, DocuSign Advanced/Qualified, etc.

Le bloc de traçabilité que nous inscrivons en bas du PDF mentionne déjà :
- l'horodatage en heure de Paris ;
- l'identité du signataire ;
- la nature du dispositif (signature simple) ;
- les textes applicables (art. 1367 et eIDAS).
