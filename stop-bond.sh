#!/bin/bash

cd /home/mb/Desktop/Sviluppo/Investing

if [ -f bond.pid ]; then
  PID=$(cat bond.pid)
  if ps -p $PID > /dev/null; then
    kill $PID
    rm bond.pid
    echo "auto-bond.js terminato (PID $PID)"
  else
    echo  "Il processo con PID $PID non è più attivo."
    rm bond.pid
  fi
else
  echo "Nessun file bond.pid trovato: nulla da fermare."
fi
