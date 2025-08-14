const WebSocket = require("ws");
const { getActivePIDsWithNames } = require("./getPIDs");
const { saveEventToDB } = require("./saveEventToDB");

const wsUrl = "wss://streaming.forexpros.com/echo/440/1ctiyfvq/websocket";

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function stripEmoji(str) {
  return str.replace(/[\p{Emoji_Presentation}\u200D]+/gu, "");
}

function visibleLength(str) {
  return stripEmoji(stripAnsi(str)).length;
}

function padToLength(str, targetLength) {
  const currentLength = visibleLength(str);
  if (currentLength >= targetLength) {
    return str.slice(0, targetLength); // oppure un truncate più intelligente
  }
  return str + " ".repeat(targetLength - currentLength);
}

function logEvent({
  time,
  pid,
  displayName,
  last,
  pcp,
  pc,
  turnover_numeric,
  symbol,
}) {
  const paddedTime = time.padEnd(9);
  const paddedPid = pid.toString().padEnd(7);
  const paddedName = padToLength(displayName, 45);
  const paddedLast = last.toString().padStart(8);
  const paddedPcp = `(${pcp})`.padStart(10);
  const paddedPc = `(${pc})`.padStart(10);
  const paddedturnover_numeric = `(${turnover_numeric})`.padStart(15);

  console.log(
    `-> ${symbol} <- [📈] ${paddedTime} | ${paddedPid} (${paddedName}) → ${paddedLast} ${paddedPcp} ${paddedPc} ${paddedturnover_numeric}`
  );
}

function formatNameWithEmoji(name, variazione) {
  if (name.startsWith("BTP")) {
    return `🇮🇹🟡 \x1b[33m${name}\x1b[0m`; // giallo
  } else if (name.startsWith("OAT")) {
    return `🇫🇷🔵 \x1b[34m${name}\x1b[0m`; // blu
  } else if (name.toUpperCase().includes("ROMANIA")) {
    return `🇷🇴🟣 \x1b[31m${name}\x1b[0m`; // rosso
  } else if (name.toUpperCase().includes("FUTURE EURO")) {
    return `⏩📉💶 \x1b[36m${name}\x1b[0m`; // ciano
  } else if (name.toUpperCase().includes("FUTURE BTP ITALIANI")) {
    const coloreSfondo =
      variazione === "greenBg" ? "\x1b[1;37;42m" : "\x1b[1;37;41m";
    return `⏩📉💶 ${coloreSfondo}${name}\x1b[0m`;
  } else if (name.toUpperCase().includes("UNITED STATES")) {
    return `⏩📉💲 \x1b[36m${name}\x1b[0m`; // ciano
  }
  return name;
}

// ======= AGGIUNTA: stato + helpers per reconnect =======
let ws = null;
let heartbeatTimer = null;
let subscribeTimer = null;
let reconnecting = false;

function clearTimers() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (subscribeTimer) {
    clearTimeout(subscribeTimer);
    subscribeTimer = null;
  }
}

function cleanupSocket() {
  clearTimers();
  try { ws && ws.removeAllListeners && ws.removeAllListeners(); } catch (_) {}
  try { ws && ws.terminate && ws.terminate(); } catch (_) {}
  ws = null;
}

function scheduleReconnect(reinitFn, reason) {
  if (reconnecting) return;
  reconnecting = true;
  console.warn(`[WS] riconnessione immediata… ${reason ? `(${reason})` : ""}`);
  cleanupSocket();
  setTimeout(async () => {
    try {
      await reinitFn();   // <— richiama la funzione passata (es. startWS)
    } finally {
      reconnecting = false;
    }
  }, 0); // immediato; se vuoi ammorbidire: 300–1000 ms
}

// ======= FINE AGGIUNTA =======

(async () => {
  const pidMap = await getActivePIDsWithNames();
  const trackedPids = Object.keys(pidMap);

  if (trackedPids.length === 0) {
    console.error("[✘] Nessun PID recuperato dal database. Interrompo.");
    return;
  }

  // incapsulo apertura e init per poterla riusare al reconnect
  async function startWS() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    ws = new WebSocket(wsUrl, {
      headers: {
        Origin: "https://it.investing.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      },
    });

    ws.on("open", () => {
      console.log("[✔] WebSocket aperto");

      ws.send(JSON.stringify({ _event: "UID", UID: 259333371 }));
      console.log("[→] UID inviato");

      subscribeTimer = setTimeout(() => {
        const messageString =
          trackedPids.map((pid) => `pid-${pid}`).join(":%%") + ":";
        ws.send(
          JSON.stringify({
            _event: "bulk-subscribe",
            tzID: 8,
            message: messageString,
          })
        );
        console.log("[→] Sottoscrizione inviata ai PID:", trackedPids.join(", "));
      }, 1000);

      heartbeatTimer = setInterval(() => {
        const heartbeat = JSON.stringify({ _event: "heartbeat", data: "h" });
        try {
          ws.send(heartbeat);
          console.log("[💓] Heartbeat inviato");
        } catch (e) {
          console.error("[!] Errore invio heartbeat:", e.message);
        }
      }, 5 * 60 * 1000);
    });

    ws.on("message", async (data) => {
      const raw = data.toString();
      if (!raw.startsWith("a[")) return;

      let payloadList;
      try {
        payloadList = JSON.parse(raw.slice(1));
      } catch {
        return;
      }

      for (const item of payloadList) {
        let messageObj;
        try {
          messageObj = JSON.parse(item);
        } catch {
          continue;
        }

        if (!messageObj.message || !messageObj.message.includes("pid-")) continue;

        const [pidRaw, payloadStr] = messageObj.message.split("::");
        const pid = pidRaw.replace("pid-", "");

        if (!trackedPids.includes(pid)) continue;

        try {
          const payload = JSON.parse(payloadStr);
          const { time, last, pcp, pc, turnover_numeric, last_dir } = payload;

          if (time && last && pcp) {
            let symbol = "⬜";
            const name = pidMap[pid] || "N/A";
            if (last_dir === "greenBg") symbol = "🟩"; // 🟢
            else if (last_dir === "redBg") symbol = "🟥"; // 🔴

            if (symbol === "⬜") return;

            let displayName = formatNameWithEmoji(name, last_dir);

            logEvent({
              time,
              pid,
              displayName,
              last,
              pcp,
              pc,
              turnover_numeric,
              symbol,
            });

            await saveEventToDB({
              pid,
              name,
              last,
              pcp,
              last_dir,
              time,
              pc,
              turnover_numeric,
            });
          }
        } catch {
          continue;
        }
      }
    });

    ws.on("error", (err) => {
      console.error("[!] Errore WebSocket:", err.message);
      // chiudiamo per far scattare 'close' → scheduleReconnect
      try { ws.close(); } catch (_) {}
    });

    ws.on("close", (code, reason) => {
      console.log("[✘] Connessione chiusa", code, reason?.toString?.() || "");
      scheduleReconnect(startWS, `close ${code}`); // <— passa la ref a startWS
    });
  }

  // avvio iniziale
  await startWS();
})();
