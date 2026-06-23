#!/bin/bash
# check-sri.sh — Vérifie que les hashes SRI dans le HTML correspondent aux fichiers CDN réels.
# Usage : bash scripts/check-sri.sh
# Lancer avant toute mise à jour de version de librairie CDN.

set -uo pipefail

PASS=0
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local expected_hash="$3"

  local actual
  actual=$(curl -sf --retry 2 --max-time 15 "$url" | openssl dgst -sha384 -binary | openssl base64 -A) || {
    echo "⚠️  RÉSEAU : impossible de joindre $url"
    FAIL=$((FAIL + 1))
    return
  }

  if [ "$actual" = "$expected_hash" ]; then
    echo "✅ $label"
    PASS=$((PASS + 1))
  else
    echo "❌ HASH OBSOLÈTE : $label"
    echo "   URL      : $url"
    echo "   Attendu  : $expected_hash"
    echo "   Réel     : $actual"
    echo "   → Mettez à jour integrity= dans index.html et work/ avec : sha384-$actual"
    FAIL=$((FAIL + 1))
  fi
}

echo "══════════════════════════════════════════════════"
echo "  S@FE CRM — Vérification hashes SRI"
echo "══════════════════════════════════════════════════"

check \
  "@supabase/supabase-js@2.108.2 (jsdelivr)" \
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js" \
  "JWEyvHh+lRf0sN/WWY+QTQwX+CyWqmNg4tkc8GQzAMEtR2wGNrCJlvnu1lHD1kDm"

check \
  "jspdf@2.5.1 (cdnjs)" \
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" \
  "JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk"

check \
  "jspdf@2.5.1 (jsdelivr)" \
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js" \
  "JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk"

check \
  "qrcode@1.5.3 (jsdelivr)" \
  "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js" \
  "Izc791esqyEy3BEIC42q7jbE0AaOkACziN+dyyXgYeDmpeMCLz0xA+xYN3aCd5zz"

check \
  "Chart.js@4.4.1 (cdnjs)" \
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js" \
  "dug+JxfBvklEQdJ4AYuBBAIScUz0bVN73xpy273gcAwHjb3qI0fXmuYNaNfdyYJG"

echo "══════════════════════════════════════════════════"
echo "  Résultat : $PASS OK — $FAIL ERREUR(S)"
echo "══════════════════════════════════════════════════"

[ $FAIL -eq 0 ] && exit 0 || exit 1
