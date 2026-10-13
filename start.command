#!/bin/bash
# Double-click to start Space Explorer (if macOS says no permission, run once in Terminal:  chmod +x start.command)
cd "$(dirname "$0")"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
if command -v node >/dev/null 2>&1; then
  (sleep 1; open "http://localhost:8080") &
  node serve.mjs
else
  echo "Node.js wasn't found. Install it from https://nodejs.org or with nvm, then try again."
  read -r -p "Press Enter to close."
fi
