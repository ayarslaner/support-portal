#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  Support Portal — Hızlı Güncelleme / Yeniden Deploy Scripti
#
#  Dosyaları güncelledikten sonra bu scripti çalıştırın.
#  Bağımlılıkları yeniden kurar ve uygulamayı restart eder.
#
#  Kullanım:
#    chmod +x deploy.sh
#    ./deploy.sh
# ══════════════════════════════════════════════════════════════

set -e

# ── Renkli Çıktı ─────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }

# ── Proje Dizini ─────────────────────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

echo ""
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo -e "${CYAN}   Support Portal — Güncelleme${NC}"
echo -e "${CYAN}══════════════════════════════════════════${NC}"
echo ""

# ── 1. Bağımlılıkları Güncelle ───────────────────────
info "Bağımlılıklar güncelleniyor..."
npm install --production
success "Bağımlılıklar güncellendi."

# ── 2. PM2 ile Yeniden Başlat ────────────────────────
info "Uygulama yeniden başlatılıyor..."

if pm2 describe support-portal &>/dev/null; then
  pm2 restart support-portal
  success "Uygulama yeniden başlatıldı."
else
  warn "PM2'de 'support-portal' bulunamadı. Yeni başlatılıyor..."
  pm2 start server.js --name "support-portal" --env production
  pm2 save
  success "Uygulama başlatıldı ve kaydedildi."
fi

# ── 3. Durum Raporu ──────────────────────────────────
echo ""
pm2 status support-portal
echo ""
success "Deploy tamamlandı!"
echo ""
