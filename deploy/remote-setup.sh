#!/usr/bin/env bash
# Chạy TRÊN máy chủ (Ubuntu) với quyền root. Thường được gọi qua deploy/deploy.sh.
# Lưu ý: không đụng cấu hình nginx/site khác; chỉ thêm /etc/nginx/conf.d/<domain>.conf
# Biến môi trường: DOMAIN, REPO_URL, BRANCH, LE_EMAIL, ADMIN_EMAIL, ADMIN_PASSWORD (tuỳ chọn), APP_DIR
set -euo pipefail

DOMAIN="${DOMAIN:?cần DOMAIN}"
REPO_URL="${REPO_URL:?cần REPO_URL}"
BRANCH="${BRANCH:-main}"
LE_EMAIL="${LE_EMAIL:?cần LE_EMAIL}"
APP_DIR="${APP_DIR:-/opt/taskflow}"
FRONTEND_PORT="${FRONTEND_PORT:-18080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@${DOMAIN#*.}}"

log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
export DEBIAN_FRONTEND=noninteractive

log "Cài gói cần thiết (git, nginx, certbot, docker nếu chưa có)"
apt-get update -y
# --no-upgrade: chỉ cài gói còn thiếu, KHÔNG nâng cấp nginx/certbot đã có (tránh khởi động lại site khác trên server)
apt-get install -y --no-upgrade git nginx certbot python3-certbot-nginx curl openssl
if ! command -v docker >/dev/null 2>&1; then curl -fsSL https://get.docker.com | sh; fi
docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-plugin
systemctl enable --now docker

log "Lấy mã nguồn ($REPO_URL @ $BRANCH) vào $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH" && git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

log "Tạo file .env (giữ nguyên nếu đã có để không đổi secret/mật khẩu DB)"
if [ ! -f .env ]; then
  umask 077
  cat > .env <<ENV
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
MYSQL_PASSWORD=$(openssl rand -hex 24)
MYSQL_DATABASE=taskflow
MYSQL_USER=taskflow
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
PUBLIC_URL=https://${DOMAIN}
FRONTEND_PORT=${FRONTEND_PORT}
ALLOW_REGISTRATION=true
ENV
fi

COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env"
log "Build và chạy (MySQL + backend + frontend)"
$COMPOSE up -d --build

log "Chờ backend sẵn sàng (tự chạy migrate khi khởi động)"
for _ in $(seq 1 60); do
  if curl -fs -o /dev/null -X POST "http://127.0.0.1:${FRONTEND_PORT}/api/auth/login" -H 'content-type: application/json' -d '{}' || \
     [ "$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:${FRONTEND_PORT}/api/auth/login" -H 'content-type: application/json' -d '{}')" = "400" ]; then break; fi
  sleep 3
done

log "Tạo tài khoản admin (chỉ khi chưa có người dùng nào)"
USERS=$($COMPOSE exec -T mysql sh -c 'mysql -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM User" 2>/dev/null' | tr -d '[:space:]' || echo 0)
if [ "${USERS:-0}" = "0" ]; then
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)}"
  $COMPOSE exec -T -e ADMIN_EMAIL="$ADMIN_EMAIL" -e ADMIN_PASSWORD="$ADMIN_PASSWORD" backend npm run seed:admin >/dev/null
  echo "ADMIN_EMAIL=$ADMIN_EMAIL"
  echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"
else
  echo "Đã có $USERS người dùng — bỏ qua bước tạo admin."
fi

log "Cấu hình nginx cho $DOMAIN"
sed -e "s/__DOMAIN__/${DOMAIN}/g" -e "s/__PORT__/${FRONTEND_PORT}/g" deploy/nginx-vhost.conf.template > "/etc/nginx/conf.d/${DOMAIN}.conf"
nginx -t
systemctl reload nginx

log "Cấp chứng chỉ HTTPS (Let's Encrypt)"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LE_EMAIL" --redirect

log "Xong: https://${DOMAIN}"
