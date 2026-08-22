#!/usr/bin/env bash
# Cài toàn bộ hệ thống on-call agent lên một VPS Ubuntu trống. Chạy được nhiều lần, không hỏng gì.
#   git clone https://github.com/holetexvn/oncall-agent.git ~/oncall-agent
#   cd ~/oncall-agent && ./deploy/setup-vps.sh
set -e
cd "$(dirname "$0")/.."
DIR="$(pwd)"; USER_NAME="$(id -un)"
export PATH="$HOME/.local/bin:$PATH"
say(){ printf "\n\033[1m==> %s\033[0m\n" "$1"; }
have(){ command -v "$1" >/dev/null 2>&1; }

say "1/7 Gói cơ bản"
if ! have curl || ! have git; then sudo apt-get update -qq && sudo apt-get install -y -qq curl git ca-certificates gnupg; fi
echo "ok"

say "2/7 Node.js 24"
if have node && [ "$(node -v | cut -c2-3)" -ge 20 ] 2>/dev/null; then echo "đã có $(node -v)"
else curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - >/dev/null 2>&1; sudo apt-get install -y -qq nodejs; echo "cài xong $(node -v)"; fi

say "3/7 GitHub CLI"
if have gh; then echo "đã có $(gh --version | head -1)"
else
  sudo mkdir -p -m 755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update -qq && sudo apt-get install -y -qq gh; echo "cài xong"
fi

say "4/7 Claude Code"
if have claude; then echo "đã có $(claude --version)"
else curl -fsSL https://claude.ai/install.sh | bash >/dev/null 2>&1; export PATH="$HOME/.local/bin:$PATH"; echo "cài xong $(claude --version)"; fi
grep -q '.local/bin' "$HOME/.bashrc" 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"

say "5/7 Thư viện + cấu hình"
npm install --silent
mkdir -p demo-app/logs
if [ ! -f .env ]; then
  cp .env.example .env && chmod 600 .env
  sed -i "s|^REPO_DIR=.*|REPO_DIR=$DIR|; s|^LOG_DIR=.*|LOG_DIR=$DIR/demo-app/logs|" .env
  echo "đã tạo .env (còn phải điền token — xem bước cuối)"
else echo ".env đã có, giữ nguyên"; fi
sudo timedatectl set-timezone Asia/Ho_Chi_Minh 2>/dev/null && echo "timezone: Asia/Ho_Chi_Minh"

say "6/7 Dịch vụ chạy nền (systemd)"
for unit in oncall-receiver:receiver/index.js demo-app:demo-app/index.js oncall-approve-bot:reporter/approve-bot.js; do
  NAME="${unit%%:*}"; SCRIPT="${unit##*:}"
  sudo tee /etc/systemd/system/$NAME.service >/dev/null <<UNIT
[Unit]
Description=$NAME (oncall-agent)
After=network.target
[Service]
WorkingDirectory=$DIR
EnvironmentFile=$DIR/.env
Environment=PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=HOME=$HOME
$([ "$NAME" = "demo-app" ] && echo "Environment=PORT=3000")
ExecStart=$(command -v node) $SCRIPT
Restart=always
User=$USER_NAME
[Install]
WantedBy=multi-user.target
UNIT
done
sudo systemctl daemon-reload
sudo systemctl enable --now oncall-receiver demo-app >/dev/null 2>&1
sudo systemctl enable oncall-approve-bot >/dev/null 2>&1   # chỉ start khi đã có token Telegram
echo "receiver :8080 · demo-app :3000 đang chạy"

say "7/7 Tường lửa"
if have ufw; then sudo ufw allow OpenSSH >/dev/null 2>&1; sudo ufw allow 8080/tcp >/dev/null 2>&1; sudo ufw allow 3000/tcp >/dev/null 2>&1
  sudo ufw --force enable >/dev/null 2>&1; echo "mở 22 · 3000 · 8080"; fi

cat <<DONE

────────────────────────────────────────────────────────────
Cài xong. Còn 3 thứ phải tự điền vào $DIR/.env :

  1) Claude       →  claude setup-token
                     dán vào  CLAUDE_CODE_OAUTH_TOKEN=
  2) GitHub       →  tạo fine-grained token (Contents + Pull requests: write)
                     dán vào  GH_TOKEN=      rồi chạy:  gh auth setup-git
  3) Telegram     →  @BotFather tạo bot, lấy token + chat id
                     dán vào  TELEGRAM_BOT_TOKEN=  và  TELEGRAM_CHAT_ID=
                     rồi:  sudo systemctl start oncall-approve-bot

Xong thì kiểm tra:   ./deploy/preflight.sh
Chạy thử demo:       ./demo-app/simulate-customers.sh http://localhost:3000 3
────────────────────────────────────────────────────────────
DONE
