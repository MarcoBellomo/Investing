#!/bin/bash

cd /home/mb/Desktop/Sviluppo/Investing

# Carica NVM
# export NVM_DIR="$HOME/.nvm"
# [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Usa la versione di default di Node.js
# nvm use default

# Nome file log con data corrente (es. bond-20250803.log)
LOGFILE="logs/bond.log"

if [ -f bond.pid ] && ps -p $(cat bond.pid) > /dev/null; then
  echo "⚠️ auto-bond.js è già in esecuzione con PID $(cat bond.pid)"
  exit 1
fi

# Avvia script e salva PID
/home/mb/.nvm/versions/node/v20.9.0/bin/node auto-bond.js > "$LOGFILE" 2>&1 &
echo $! > bond.pid
echo "✅ auto-bond.js avviato con PID $(cat bond.pid)"
