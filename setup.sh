#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  Support Portal — Otomatik Sunucu Kurulum Scripti
#  Bu script sadece BİR KEZ çalıştırılır (ilk kurulumda).
#
#  Kullanım:
#    chmod +x setup.sh
#    sudo ./setup.sh
#
#  Bu script şunları yapar:
#    1. Sistem güncellemesi
#    2. Node.js 20 LTS kurulumu
#    3. npm bağımlılıkları kurulumu
#    4. .env dosyası oluşturma (yoksa)
#    5. PM2 kurulumu ve uygulama başlatma
#    6. Nginx reverse proxy kurulumu
#    7. SSL sertifikası (Let's Encrypt)
#    8. Güvenlik duvarı (UFW) yapılandırması
# ══════════════════════════════════════════════════════════════

set -e  # Hata olursa dur

# ── Renkli Çıktı Yardımcıları ────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✘]${NC} $1"; exit 1; }

# ── Root Kontrolü ────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error "Bu script root olarak çalıştırılmalıdır. 'sudo ./setup.sh' kullanın."
fi

# ── Proje Dizini Tespiti ─────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"

if [ ! -f "$APP_DIR/server.js" ]; then
  error "server.js bulunamadı! Bu scripti proje klasörünün içinden çalıştırın."
fi

info "Proje dizini: $APP_DIR"

# ══════════════════════════════════════════════════════
#  Kullanıcıdan Bilgi Alma
# ══════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   Support Portal — Kurulum Sihirbazı${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo ""

# Domain adı
read -p "Domain adınız (örn: destek.sirketiniz.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
  warn "Domain girilmedi. Nginx ve SSL kurulmayacak."
  SKIP_NGINX=true
else
  SKIP_NGINX=false
fi

# SSL için e-posta
if [ "$SKIP_NGINX" = false ]; then
  read -p "SSL sertifikası için e-posta adresiniz: " SSL_EMAIL
  if [ -z "$SSL_EMAIL" ]; then
    warn "E-posta girilmedi. SSL kurulmayacak."
    SKIP_SSL=true
  else
    SKIP_SSL=false
  fi
else
  SKIP_SSL=true
fi

# Uygulama portu
read -p "Uygulama portu [3000]: " APP_PORT
APP_PORT=${APP_PORT:-3000}

echo ""
info "Kurulum başlıyor..."
echo ""

# ══════════════════════════════════════════════════════
#  1. Sistem Güncellemesi
# ══════════════════════════════════════════════════════
info "1/8 — Sistem güncelleniyor..."
apt update -y && apt upgrade -y
success "Sistem güncellendi."

# ══════════════════════════════════════════════════════
#  2. Node.js 20 LTS Kurulumu
# ══════════════════════════════════════════════════════
info "2/8 — Node.js kontrol ediliyor..."
if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  success "Node.js zaten kurulu: $NODE_VER"
else
  info "Node.js kuruluyor (v20 LTS)..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
  success "Node.js kuruldu: $(node -v)"
fi

# ══════════════════════════════════════════════════════
#  3. npm Bağımlılıkları
# ══════════════════════════════════════════════════════
info "3/8 — npm bağımlılıkları kuruluyor..."
cd "$APP_DIR"
npm install --production
success "Bağımlılıklar kuruldu."

# ══════════════════════════════════════════════════════
#  4. .env Dosyası
# ══════════════════════════════════════════════════════
info "4/8 — .env dosyası kontrol ediliyor..."
if [ ! -f "$APP_DIR/.env" ]; then
  if [ -f "$APP_DIR/.env.example" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    # Güvenli rastgele API key oluştur
    RANDOM_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s|change-me-to-a-secure-random-key-abc123|$RANDOM_KEY|g" "$APP_DIR/.env"
    sed -i "s|PORT=3000|PORT=$APP_PORT|g" "$APP_DIR/.env"
    success ".env dosyası oluşturuldu (güvenli API key ile)."
    warn "SMTP ayarlarını .env dosyasından yapılandırmayı unutmayın!"
  else
    warn ".env.example bulunamadı, .env dosyası oluşturulamadı."
  fi
else
  success ".env dosyası zaten mevcut."
fi

# ══════════════════════════════════════════════════════
#  5. PM2 Kurulumu ve Uygulama Başlatma
# ══════════════════════════════════════════════════════
info "5/8 — PM2 kuruluyor..."
if command -v pm2 &> /dev/null; then
  success "PM2 zaten kurulu."
else
  npm install -g pm2
  success "PM2 kuruldu."
fi

# Mevcut instance varsa durdur
pm2 delete support-portal 2>/dev/null || true

info "Uygulama başlatılıyor..."
cd "$APP_DIR"
pm2 start server.js --name "support-portal" --env production
pm2 save

# Sunucu yeniden başladığında otomatik çalışsın
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup
pm2 save

success "Uygulama PM2 ile başlatıldı ve kalıcı hale getirildi."

# ══════════════════════════════════════════════════════
#  6. Nginx Kurulumu
# ══════════════════════════════════════════════════════
if [ "$SKIP_NGINX" = false ]; then
  info "6/8 — Nginx kuruluyor..."
  
  if command -v nginx &> /dev/null; then
    success "Nginx zaten kurulu."
  else
    apt install -y nginx
    success "Nginx kuruldu."
  fi

  # Nginx yapılandırma dosyası oluştur
  cat > /etc/nginx/sites-available/support-portal << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    # Güvenlik başlıkları
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # İstek boyutu limiti
    client_max_body_size 5M;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Zaman aşımı ayarları
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINXEOF

  # Etkinleştir
  ln -sf /etc/nginx/sites-available/support-portal /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default

  # Yapılandırmayı test et
  nginx -t
  systemctl restart nginx
  systemctl enable nginx

  success "Nginx yapılandırıldı: $DOMAIN → localhost:$APP_PORT"
else
  warn "6/8 — Nginx kurulumu atlandı (domain girilmedi)."
fi

# ══════════════════════════════════════════════════════
#  7. SSL Sertifikası (Let's Encrypt)
# ══════════════════════════════════════════════════════
if [ "$SKIP_SSL" = false ]; then
  info "7/8 — SSL sertifikası alınıyor..."
  
  apt install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect
  
  success "SSL sertifikası kuruldu. HTTPS aktif!"
else
  warn "7/8 — SSL kurulumu atlandı."
fi

# ══════════════════════════════════════════════════════
#  8. Güvenlik Duvarı (UFW)
# ══════════════════════════════════════════════════════
info "8/8 — Güvenlik duvarı yapılandırılıyor..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw reload
success "Güvenlik duvarı aktif (SSH, HTTP, HTTPS izinli)."

# ══════════════════════════════════════════════════════
#  TAMAMLANDI
# ══════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ Kurulum Tamamlandı!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
echo ""

if [ "$SKIP_NGINX" = false ]; then
  if [ "$SKIP_SSL" = false ]; then
    echo -e "  📋  Müşteri Formu:     ${CYAN}https://$DOMAIN/${NC}"
    echo -e "  🔒  Kontrol Paneli:    ${CYAN}https://$DOMAIN/internal/${NC}"
  else
    echo -e "  📋  Müşteri Formu:     ${CYAN}http://$DOMAIN/${NC}"
    echo -e "  🔒  Kontrol Paneli:    ${CYAN}http://$DOMAIN/internal/${NC}"
  fi
else
  echo -e "  📋  Müşteri Formu:     ${CYAN}http://SUNUCU_IP:$APP_PORT/${NC}"
  echo -e "  🔒  Kontrol Paneli:    ${CYAN}http://SUNUCU_IP:$APP_PORT/internal/${NC}"
fi

echo ""
echo -e "  ${YELLOW}Yararlı Komutlar:${NC}"
echo -e "    pm2 status              — Uygulama durumu"
echo -e "    pm2 logs support-portal — Canlı loglar"
echo -e "    pm2 monit               — CPU/RAM izleme"
echo -e "    nano $APP_DIR/.env      — Ayarları düzenle"
echo ""

if [ ! -f "$APP_DIR/.env" ] || grep -q "smtp.example.com" "$APP_DIR/.env"; then
  echo -e "  ${YELLOW}⚠️  SMTP ayarlarını yapılandırmayı unutmayın:${NC}"
  echo -e "    nano $APP_DIR/.env"
  echo ""
fi
