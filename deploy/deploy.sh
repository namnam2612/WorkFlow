#!/usr/bin/env bash
# Deploy lên máy chủ qua SSH. Chạy từ máy bạn:
#   ./deploy/deploy.sh user@103.175.146.251
# Tuỳ chọn (biến môi trường): DOMAIN, BRANCH, REPO_URL, LE_EMAIL, ADMIN_EMAIL, ADMIN_PASSWORD
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:?Cách dùng: ./deploy/deploy.sh user@host}"
DOMAIN="${DOMAIN:-alpha.hopphu.vn}"
REPO_URL="${REPO_URL:-https://github.com/HieuMap01/WorkFlow.git}"
BRANCH="${BRANCH:-taskflow}"
LE_EMAIL="${LE_EMAIL:?Đặt LE_EMAIL=<email> để đăng ký chứng chỉ HTTPS}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@hopphu.vn}"

SUDO=""; [[ "${TARGET%%@*}" == "root" ]] || SUDO="sudo"

# Copy script lên server rồi chạy với tty (-t) để sudo hỏi được mật khẩu nếu cần
scp -q deploy/remote-setup.sh "$TARGET:/tmp/taskflow-remote-setup.sh"
# shellcheck disable=SC2029
ssh -t "$TARGET" "$SUDO env DOMAIN='$DOMAIN' REPO_URL='$REPO_URL' BRANCH='$BRANCH' LE_EMAIL='$LE_EMAIL' ADMIN_EMAIL='$ADMIN_EMAIL' ADMIN_PASSWORD='${ADMIN_PASSWORD:-}' bash /tmp/taskflow-remote-setup.sh; rc=\$?; rm -f /tmp/taskflow-remote-setup.sh; exit \$rc"
