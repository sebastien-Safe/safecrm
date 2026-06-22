# ANALYSE D'IMPACT RELATIVE À LA PROTECTION DES DONNÉES (AIPD)
## Traitement IA — call-ia Edge Function

**Conformité:** RGPD Art. 35
**Entreprise:** S@FE SASU
**SIRET:** 104 699 558 00011
**Date:** 2026-06-22
**Responsable:** Sébastien Alonso (DPO)

---

## 1. DESCRIPTION DU TRAITEMENT

### Contexte
S@FE CRM utilise une Edge Function Supabase nommée `call-ia` pour router les requêtes utilisateurs vers des API d'intelligence artificielle (Claude/Anthropic, Grok/xAI, Mistral).

### Flux de données

```
Utilisateur CRM
  → call-ia Edge Function (Supabase)
    → Pseudonymisation (regex masking)
      → API IA (Grok/Anthropic/Mistral)
        → Réponse IA (affichée user)
          → Log (6 mois)
            → Anonymisation (auto-delete)
```

### APIs IA utilisées
- **Anthropic Claude :** claude-sonnet-4-6 (USA)
- **xAI Grok :** grok-4.3 (USA)
- **Mistral :** mistral-large (EU)

---

## 2. NÉCESSITÉ ET PROPORTIONNALITÉ

### Justification
- **Nécessaire :** Oui (amélioration UX, support client)
- **Proportionnalité :** Oui (données minimales, pseudonymisées, courte rétention)
- **Alternatives moins invasives :** Mistral local (solution en cours)

### Conclusion : AIPD proceed ✅

---

## 3. RISQUES IDENTIFIÉS

| Risque | Sévérité | Mitigation | Status |
|---|---|---|---|
| **R1 : Transfert USA sans adequacy** | 🔴 HAUTE | SCC signé + Supplementary Measures (pseudonymisation) | ✅ Mitigation prévue |
| **R2 : Prompts contiennent données clients** | 🟠 MOYENNE | Pseudonymisation automatique (regex) avant transfert | ✅ Implémentée |
| **R3 : Réponse IA sensible générée** | 🟡 BASSE | Audit logging 6 mois + anonymisation auto | ✅ Implémentée |
| **R4 : Anthropic/xAI accès non autorisé** | 🟠 MOYENNE | Processor Agreement signé + DPA | ✅ En cours |
| **R5 : Combinaison données (matching)** | 🟡 BASSE | Requêtes isolées (pas de session linking) | ✅ Implémentée |

---

## 4. MESURES DE SÉCURITÉ EN PLACE

- ✅ TLS 1.2+ en transit
- ✅ Prompts pseudonymisés (emails → [EMAIL], téléphones → [PHONE], noms → [PERSON])
- ✅ DPA signé (Anthropic — en cours)
- ✅ SCC demandé (xAI)
- ✅ Logs = 6 mois → anonymisation auto
- ✅ Droit d'accès = possible (demande support)
- ✅ Audit trail = tracé (safe_connectors_log)

---

## 5. CONSULTATION CNIL

**Obligatoire ?** Non (transfert USA mitigé par SCC + supplementary measures)
**Recommandé ?** Oui, informer annuellement DPO (notification)

---

## 6. PLAN D'ACTION

| Action | Responsable | Échéance | Status |
|---|---|---|---|
| Signer DPA Anthropic | Sébastien Alonso | J+3 | ⏳ En cours |
| Signer DPA xAI | Sébastien Alonso | J+10 | ⏳ En cours |
| Mettre en place pseudonymisation automatique | Tech | J+7 | ⏳ En cours |
| Implémenter auto-delete logs 6 mois | Tech | J+14 | ⏳ À faire |
| Documenter supplementary measures | DPO | J+7 | ⏳ À faire |
| Révision annuelle AIPD | DPO | 2027-06-22 | 📅 Planifié |

---

## SIGNATURE APPROBATION

**DPO :** Sébastien Alonso
**Signature :** ___________________________
**Date :** 2026-06-22

**Responsable légal :**
**Signature :** ___________________________
**Date :**

---

**Prochaine révision :** 2027-06-22 (annuelle)
