#!/bin/bash

###############################################################################
# SCRIPT DE TÉLÉCHARGEMENT AUTOMATIQUE - DOCUMENTS STRIPE RGPD
#
# Utilisation:
#   chmod +x download-stripe-docs.sh
#   ./download-stripe-docs.sh
#
# Crée la structure: legal/stripe/
# Télécharge tous les documents nécessaires
###############################################################################

set -e  # Exit on error

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOWNLOAD_DIR="legal/stripe"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="${DOWNLOAD_DIR}/download_log_${TIMESTAMP}.txt"

# URLs Stripe VÉRIFIÉES (2026-06-22)
DPA_PDF="https://assets.stripeassets.com/fzn2n1nzq965/5uwos9VnPFvcboDlZcGKJn/dea6e5962d2597e870a38d2d7ebfeb84/DPA_2025-Nov-18_.pdf"
SSA_WEB="https://stripe.com/legal/ssa"
DTA_WEB="https://stripe.com/legal/dta"
SUBPROCESSORS_WEB="https://stripe.com/service-providers/legal"
PRIVACY_POLICY="https://stripe.com/privacy"

###############################################################################
# FONCTIONS
###############################################################################

log() {
    local msg="$1"
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $msg"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $msg" >> "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
    echo "[SUCCESS] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}✗ $1${NC}"
    echo "[ERROR] $1" >> "$LOG_FILE"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        error "$1 n'est pas installé. Installez-le avec: apt-get install $1"
        exit 1
    fi
}

###############################################################################
# VÉRIFICATIONS PRÉALABLES
###############################################################################

# Créer la structure de dossiers EN PREMIER (avant tout log)
mkdir -p "$DOWNLOAD_DIR"
mkdir -p "${DOWNLOAD_DIR}/screenshots"

log "Vérification des dépendances..."
check_command "curl"
success "curl disponible"

log "Création de la structure: $DOWNLOAD_DIR"
success "Structure créée"

# Créer le log file
echo "========================================" > "$LOG_FILE"
echo "TÉLÉCHARGEMENT DOCUMENTS STRIPE RGPD" >> "$LOG_FILE"
echo "Date: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

###############################################################################
# TÉLÉCHARGEMENTS
###############################################################################

log "Début des téléchargements..."
echo ""

# 1. DPA PDF (lien direct)
log "[1/5] Téléchargement DPA (PDF direct)..."
if curl -f -L -o "${DOWNLOAD_DIR}/Stripe-DPA-2025-Nov-18.pdf" "$DPA_PDF" 2>/dev/null; then
    success "DPA téléchargé ✓"
else
    error "Impossible de télécharger le DPA"
fi

# 2. SSA (Stripe Services Agreement)
log "[2/5] Téléchargement SSA (page web en HTML)..."
if curl -f -L -o "${DOWNLOAD_DIR}/Stripe-Services-Agreement.html" "$SSA_WEB" 2>/dev/null; then
    success "SSA téléchargé (HTML) ✓"
else
    error "Impossible de télécharger SSA"
fi

# 3. DTA (Data Transfers Addendum)
log "[3/5] Téléchargement DTA (page web en HTML)..."
if curl -f -L -o "${DOWNLOAD_DIR}/Stripe-Data-Transfers-Addendum.html" "$DTA_WEB" 2>/dev/null; then
    success "DTA téléchargé (HTML) ✓"
else
    error "Impossible de télécharger DTA"
fi

# 4. Sub-Processors List
log "[4/5] Téléchargement Sub-Processors List..."
if curl -f -L -o "${DOWNLOAD_DIR}/Stripe-SubProcessors-List.html" "$SUBPROCESSORS_WEB" 2>/dev/null; then
    success "Sub-Processors List téléchargé ✓"
else
    error "Impossible de télécharger Sub-Processors List"
fi

# 5. Privacy Policy
log "[5/5] Téléchargement Privacy Policy..."
if curl -f -L -o "${DOWNLOAD_DIR}/Stripe-Privacy-Policy.html" "$PRIVACY_POLICY" 2>/dev/null; then
    success "Privacy Policy téléchargée ✓"
else
    error "Impossible de télécharger Privacy Policy"
fi

echo ""

###############################################################################
# CRÉER REGISTRE DE TÉLÉCHARGEMENT
###############################################################################

log "Création du registre de téléchargement..."

REGISTRY_FILE="${DOWNLOAD_DIR}/REGISTRE_TELECHARGEMENTS.txt"

cat > "$REGISTRY_FILE" << EOF
REGISTRE DE TÉLÉCHARGEMENT - DOCUMENTS STRIPE RGPD
====================================================

S@FE SASU | SIRET: 104 699 558 00011
Date: $(date)

DOCUMENTS TÉLÉCHARGÉS
=====================

1. Stripe-DPA-2025-Nov-18.pdf
   URL: https://assets.stripeassets.com/fzn2n1nzq965/5uwos9VnPFvcboDlZcGKJn/...
   Type: PDF (Direct)
   Statut: ✓ Téléchargé

2. Stripe-Services-Agreement.html
   URL: https://stripe.com/legal/ssa
   Type: HTML (Page Web)
   Note: Le DPA est inclus dans le SSA (Section 4)

3. Stripe-Data-Transfers-Addendum.html
   URL: https://stripe.com/legal/dta
   Type: HTML (Page Web)
   Mécanismes: Data Privacy Framework + EEA SCCs

4. Stripe-SubProcessors-List.html
   URL: https://stripe.com/service-providers/legal
   Type: HTML (Page Web)

5. Stripe-Privacy-Policy.html
   URL: https://stripe.com/privacy
   Type: HTML (Page Web)

STATUT CONFORMITÉ STRIPE
========================

Entité Stripe pour France: Stripe Payments Europe, Limited (SPEL)
Mécanisme Transfert: Data Privacy Framework + EEA SCCs (Module 2)
Statut DPA: ✓ INCLUS dans Stripe Services Agreement
Signature Requise: NON (automatiquement appliqué)
Action Requise: AUCUNE

ARCHIVAGE
=========

Tous les documents sont archivés dans: legal/stripe/

Document généré automatiquement par: download-stripe-docs.sh
EOF

success "Registre créé: $REGISTRY_FILE"

###############################################################################
# RÉSUMÉ FINAL
###############################################################################

echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ TÉLÉCHARGEMENTS TERMINÉS${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
echo "📁 Dossier: $DOWNLOAD_DIR"
echo ""
echo "📋 Fichiers archivés:"
ls -lh "$DOWNLOAD_DIR" | grep -v "^total" | awk '{print "   - " $9 " (" $5 ")"}'
echo ""
echo "📝 Log: $LOG_FILE"
echo ""
echo -e "${GREEN}Prêt pour archivage Git:${NC}"
echo "   git add $DOWNLOAD_DIR/"
echo "   git commit -m 'docs: Stripe RGPD documents - $(date +%Y-%m-%d)'"
echo ""
