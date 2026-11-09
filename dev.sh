#!/usr/bin/env bash
# Chạy toàn bộ TaskFlow ở chế độ phát triển chỉ bằng MỘT lệnh: ./dev.sh
# (hoặc mở file này và bấm ▶ của Code Runner). Dừng bằng Ctrl+C / nút Stop.
#
# Tự động: bật Docker → MySQL → cài thư viện (lần đầu) → migrate → seed (nếu DB trống)
#          → chạy backend (:3000) + frontend (:5173) → mở trình duyệt.

set -euo pipefail
cd "$(dirname "$0")"

log() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$1" >&2; exit 1; }

# Dừng backend/frontend cùng toàn bộ tiến trình con (npm → nest → node) khi thoát
kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do kill_tree "$child"; done
  kill "$1" 2>/dev/null || true
}
PIDS=()
cleanup() {
  trap - EXIT INT TERM
  echo; echo "Đang dừng backend và frontend..."
  local pid
  # Mỗi job chạy trong nhóm tiến trình riêng (set -m) nên kill cả nhóm là dừng hết npm → nest → node
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do kill -TERM -- "-$pid" 2>/dev/null || true; kill_tree "$pid"; done
  exit 0
}
trap cleanup EXIT INT TERM

# 1) Docker
command -v docker >/dev/null || fail "Chưa cài Docker. Cài Docker Desktop rồi chạy lại."
if ! docker info >/dev/null 2>&1; then
  log "Docker chưa chạy — đang mở Docker Desktop..."
  [[ "$(uname)" == "Darwin" ]] && open -a Docker || fail "Hãy bật Docker rồi chạy lại."
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
  docker info >/dev/null 2>&1 || fail "Docker không khởi động được sau 2 phút."
fi

# 2) MySQL (cổng 3307). Dừng container backend/frontend của stack Docker nếu có (tránh trùng cổng 3000)
[[ -f .env ]] || cp .env.example .env
log "Khởi động MySQL (localhost:3307)..."
docker compose stop backend frontend >/dev/null 2>&1 || true
docker compose up -d mysql
for _ in $(seq 1 60); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' taskflow-mysql 2>/dev/null)" == "healthy" ]] && break
  sleep 2
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' taskflow-mysql 2>/dev/null)" == "healthy" ]] || fail "MySQL chưa sẵn sàng."

# 3) Backend: cài thư viện, migrate, seed nếu chưa có user
cd backend
[[ -f .env ]] || cp .env.example .env
[[ -d node_modules ]] || { log "Cài thư viện backend..."; npm install; }
log "Áp dụng migration..."
npx prisma migrate deploy
USERS=$(docker exec taskflow-mysql sh -c 'mysql -N -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM User" 2>/dev/null' | tr -d '[:space:]' || echo 0)
if [[ "${USERS:-0}" == "0" ]]; then
  log "DB trống — nạp dữ liệu mẫu..."
  npm run seed
fi
cd ..

# 4) Frontend: cài thư viện
[[ -d frontend/node_modules ]] || { log "Cài thư viện frontend..."; (cd frontend && npm install); }

# 5) Chạy backend + frontend (set -m: mỗi job có nhóm tiến trình riêng để dừng sạch)
set -m
log "Chạy backend  → http://localhost:3000/api"
(cd backend && npm run start:dev) &
PIDS+=($!)
log "Chạy frontend → http://localhost:5173"
(cd frontend && npm run dev -- --host 127.0.0.1) &
PIDS+=($!)

# Mở trình duyệt khi frontend sẵn sàng
for _ in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:5173 && break; sleep 1; done
printf '\n\033[1;32m✔ Sẵn sàng: http://localhost:5173\033[0m\n'
printf '  Đăng nhập: leader1@taskflow.vn / Password123!   (admin@taskflow.vn, member1@taskflow.vn ...)\n'
printf '  Nhấn Ctrl+C để dừng.\n\n'
[[ "$(uname)" == "Darwin" ]] && open http://localhost:5173 || true

wait
