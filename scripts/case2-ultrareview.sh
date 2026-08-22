#!/usr/bin/env bash
# Case 2 — sự kiện là PR mở. Một lệnh. Cần Claude Code >= 2.1.227.
# Chạy trong thư mục repo. Thử --json trước, thấy ổn rồi mới --post.
set -euo pipefail
PR="${1:?usage: case2-ultrareview.sh <pr-number> [--post]}"
shift || true
cd "${REPO_DIR:-.}"
claude ultrareview "$PR" --timeout 20 "$@"
