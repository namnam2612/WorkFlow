#!/usr/bin/env bash
# Deploy lên máy chủ qua SSH. Chạy từ máy bạn:
# Mã nguồn lấy từ commit HEAD hiện tại và gửi qua SSH (không cần server truy cập GitHub/repo private).
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:?Cách dùng: ./deploy/deploy.sh user@host}"
DOMAIN="${DOMAIN:-alpha.hopphu.vn}"
APP_DIR="${APP_DIR:-/opt/taskflow-alpha}"
LE_EMAIL="${LE_EMAIL:?Đặt LE_EMAIL=<email> để đăng ký chứng chỉ HTTPS}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@hopphu.vn}"

SUDO=""; [[ "${TARGET%%@*}" == "root" ]] || SUDO="sudo"

# Gửi mã nguồn đã commit (không gồm .env, node_modules) lên server; .env trên server được giữ nguyên
git diff --quiet HEAD -- || echo "⚠ Có thay đổi chưa commit — chỉ phần ĐÃ COMMIT được deploy."
# Xóa mã nguồn cũ trước khi giải nén để file đã bị xóa/đổi tên trong repo không còn sót trên server (gây lỗi build)
git archive --format=tar HEAD | ssh "$TARGET" "mkdir -p '$APP_DIR' && rm -rf '$APP_DIR/backend/src' '$APP_DIR/frontend/src' && tar -x -C '$APP_DIR'"

# Copy script lên server rồi chạy với tty (-t) để sudo hỏi được mật khẩu nếu cần.
# Trên CI (GitHub Actions) không có terminal nên bỏ -t.
scp -q deploy/remote-setup.sh "$TARGET:/tmp/taskflow-remote-setup.sh"
TTY_FLAG=""; [ -t 0 ] && TTY_FLAG="-t"
# shellcheck disable=SC2029
ssh $TTY_FLAG "$TARGET" "$SUDO env DOMAIN='$DOMAIN' APP_DIR='$APP_DIR' LE_EMAIL='$LE_EMAIL' ADMIN_EMAIL='$ADMIN_EMAIL' ADMIN_PASSWORD='${ADMIN_PASSWORD:-}' bash /tmp/taskflow-remote-setup.sh; rc=\$?; rm -f /tmp/taskflow-remote-setup.sh; exit \$rc"
