# REGISTRE DES DATA PROCESSING AGREEMENTS
## S@FE SASU — Certification RGPD Art. 42

**Dernière mise à jour:** 2026-06-22
**Statut:** En cours de signature
**DPO Responsable:** Sébastien Alonso (dpo@safe-digitalisation.fr)

---

## TABLE DE SUIVI

| Sous-traitant | Type Service | Status | Date Signature | Valid Until | Notes | Fichier |
|---|---|---|---|---|---|---|
| **Supabase** | Infrastructure (DB, Auth, Storage) | ✅ SIGNÉ | 2026-06-22 | 2029-06-22 | Ref: HZYF3-QZBHS-CRXUM-MBMJK | Supabase-DPA-SIGNED-2026-06-22.pdf |
| **Stripe** | Paiements (Transactions) | ✅ INCLUS SSA | - | - | Inclus Stripe Services Agreement | - |
| **Brevo** | Emails (Campagnes, rapports) | ⏳ EN ATTENTE | - | - | Demande envoyée | À archiver |
| **Anthropic** | IA (API Claude) | ⏳ EN ATTENTE | - | - | Demande SCC jointe | À archiver |
| **xAI (Grok)** | IA (API Grok) | ⏳ EN ATTENTE | - | - | Contact à identifier | À archiver |
| **GitHub** | Code repository | ⏳ À VÉRIFIER | - | - | Vérifier si données clients stockées | - |

---

## DÉTAILS PAR SOUS-TRAITANT

### 1. SUPABASE ✅
- **Entité:** Supabase Pte. Ltd.
- **Localisation:** Singapour (avec data EU option)
- **Services:** PostgreSQL, Authentication, Storage, Edge Functions
- **Status:** ✅ SIGNÉ 22-06-2026
- **Référence:** HZYF3-QZBHS-CRXUM-MBMJK
- **Validité:** 3 ans (renouvelable)
- **Catégories spéciales:** ☑ Aucune
- **Sub-processors:** 25 (AWS, Cloudflare, Google, GitHub, etc.)
- **Transferts USA:** Via SCC inclus dans DPA
- **Archivage:** `/docs/legal/dpa-signatures/Supabase-DPA-SIGNED-2026-06-22.pdf`
- **Action suivante:** Aucune (COMPLÉTÉ)

### 2. STRIPE ✅
- **Entité:** Stripe Payments Europe Limited (SPEL)
- **Localisation:** Europe (France)
- **Services:** Paiements, facturation
- **Status:** ✅ INCLUS SSA
- **Type:** Inclus dans Stripe Services Agreement
- **Validité:** Pendant durée contrat
- **Catégories spéciales:** ☑ Aucune
- **Sub-processors:** Stripe gère (AWS, etc.)
- **Transferts USA:** Via Data Privacy Framework + SCC
- **Documentation:** https://stripe.com/legal/dpa
- **Action suivante:** Aucune (AUTOMATIQUE)

### 3. BREVO ⏳
- **Entité:** Brevo (filiale Sendinblue)
- **Localisation:** France/Europe
- **Services:** Emails (templates audit, newsletters)
- **Status:** ⏳ EN ATTENTE
- **Demande envoyée:** [OUI/NON]
- **Date demande:** [À REMPLIR]
- **Délai attendu:** 5-7 jours
- **Catégories spéciales:** ☑ Aucune
- **Action suivante:** Relancer si pas de réponse après 7 jours
- **Contact:** support@brevo.com / dpo@brevo.com

### 4. ANTHROPIC (Claude API) ⏳
- **Entité:** Anthropic PBC
- **Localisation:** États-Unis
- **Services:** IA (Claude API via call-ia Edge Function)
- **Status:** ⏳ EN ATTENTE DPA + SCC
- **Type:** Processeur (Sub-processor de Supabase)
- **Transfert données:** USA (requiert SCC)
- **Demande envoyée:** [OUI/NON]
- **Date demande:** [À REMPLIR]
- **Délai attendu:** 3-5 jours
- **Catégories spéciales:** ☑ Aucune
- **Pseudonymisation:** Prompts masqués (emails → [EMAIL], etc.)
- **Rétention:** 6 mois max (logs), puis anonymisation
- **Action suivante:** Attendre SCC signé, archiver dans `/docs/legal/scc-transfers/`
- **Contact:** legal@anthropic.com

### 5. xAI / GROK ⏳
- **Entité:** xAI (X Corp)
- **Localisation:** États-Unis
- **Services:** IA (Grok API — via call-ia Edge Function optionnelle)
- **Status:** ⏳ EN ATTENTE
- **Type:** Processeur (alternatif Anthropic)
- **Transfert données:** USA (requiert SCC)
- **Demande envoyée:** [OUI/NON]
- **Date demande:** [À REMPLIR]
- **Délai attendu:** 5-10 jours
- **Catégories spéciales:** ☑ Aucune
- **Contact:** [À IDENTIFIER - probablement legal@x.ai]
- **Action suivante:** Identifier contact légal exact, puis demander DPA + SCC

### 6. GITHUB (À VÉRIFIER)
- **Entité:** GitHub, Inc. (Microsoft)
- **Localisation:** États-Unis
- **Services:** Code repository (sebastien-Safe/safecrm)
- **Status:** ⏳ À VÉRIFIER
- **Type:** Processeur (si données client en repo)
- **Question critique:** Données clients stockées dans le repo ?
  - [ ] NON → GitHub standard DPA suffit
  - [ ] OUI → Demander vérification + SCC
- **Contact:** GitHub Business Support
- **Action suivante:** Vérifier repo, puis demander si nécessaire

---

## CHRONOLOGIE DES SIGNATURES

| Date | Étape | Status |
|---|---|---|
| 2026-06-22 | Supabase DPA signé | ✅ COMPLÉTÉ |
| 2026-06-22 | Stripe SSA confirmé | ✅ COMPLÉTÉ |
| [À FAIRE] | Demande Brevo | 🔴 START NOW |
| [À FAIRE] | Demande Anthropic | 🔴 START NOW |
| [À FAIRE] | Demande xAI | 🔴 START NOW |
| [Prévu J+5] | Brevo DPA reçu | ⏳ EN ATTENTE |
| [Prévu J+3] | Anthropic DPA+SCC reçu | ⏳ EN ATTENTE |
| [Prévu J+10] | xAI DPA+SCC reçu | ⏳ EN ATTENTE |
| [Prévu J+14] | **TOUS DPA SIGNÉS** | 🎯 OBJECTIF |

---

## CONFORMITÉ CHECKLIST

- [x] Supabase : DPA signé
- [x] Stripe : SSA with DPA included
- [ ] Brevo : DPA demandé
- [ ] Anthropic : DPA + SCC demandés
- [ ] xAI : Contact identifié + DPA demandé
- [ ] GitHub : Vérification en cours
- [ ] All signatures archivés dans `/docs/legal/dpa-signatures/`
- [ ] All SCCs archivés dans `/docs/legal/scc-transfers/`
- [ ] Registre à jour (mise à jour hebdo)

---

## INSTRUCTIONS D'UTILISATION

### Lors de réception d'un DPA
1. Télécharger la PDF signée
2. Sauvegarder dans `/docs/legal/dpa-signatures/` avec nom : `[VENDOR]-DPA-SIGNED-[DATE].pdf`
3. Mettre à jour Status → ✅ SIGNÉ
4. Ajouter date signature dans ce registre
5. Commiter : `git add docs/legal && git commit -m "docs: DPA [VENDOR] signé [DATE]"`

### Lors de réception d'une SCC
1. Télécharger PDF
2. Sauvegarder dans `/docs/legal/scc-transfers/` avec nom : `[VENDOR]-SCC-SIGNED-[DATE].pdf`
3. Joindre au DPA (ou archiver séparément si document distinct)
4. Mettre à jour registre
5. Commiter

### Révision mensuelle
- [ ] Vérifier Status de toutes les demandes en attente
- [ ] Relancer si délai dépassé (7j Brevo, 5j Anthropic, 10j xAI)
- [ ] Mettre à jour dates dans ce registre
- [ ] Vérifier aucune signature expirée (valid until)

---

## RÉFÉRENCES LÉGALES

- **RGPD Art. 28 :** Obligation DPA (Processor)
- **RGPD Art. 30 :** Registre traitements (ce fichier)
- **RGPD Art. 44-49 :** Transferts données hors EU (SCC)
- **Schrems II (2020/1250) :** Transferts USA requièrent SCC + supplementary measures

---

## HISTORIQUE DES MODIFICATIONS

| Date | Auteur | Modification |
|---|---|---|
| 2026-06-22 | Sébastien Alonso | Création initiale — Supabase + Stripe complétés |
| [À REMPLIR] | | |

---

**Fichier généré le :** 2026-06-22
**Validité :** À réviser mensuellement jusqu'à certification
**Prochaine révision :** 2026-07-22
