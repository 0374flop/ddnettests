import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// --- ngrok ---
const ngrokmodule = await import('@ngrok/ngrok');
const ngroktokenpath = path.join(__dirname, 'ngrok.token');
const ngrokdata = fs.readFileSync(ngroktokenpath, { encoding: 'utf-8' }).trim().split(' ');
const NGROK_TOKEN  = ngrokdata[0];
const NGROK_DOMAIN = ngrokdata[1];

// --- HTTP + WS сервер ---
const server = http.createServer();
const wss = new WebSocketServer({ server });

// relay: Map<relayId, { ws, busy: bool }>
const relays = new Map();
// bots: Map<sessionId, { ws, relayId }>
const bots   = new Map();

let sessionCounter = 0;

function pickFreeRelay(preferredId) {
    if (preferredId && relays.has(preferredId)) {
        const r = relays.get(preferredId);
        if (!r.busy) return preferredId;
    }
    for (const [id, r] of relays) {
        if (!r.busy) return id;
    }
    return null;
}

wss.on('connection', (ws) => {
    let role = null;   // 'relay' | 'bot'
    let myId  = null;  // relayId или sessionId

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        // ---- РЕГИСТРАЦИЯ RELAY ----
        if (msg.type === 'relay:register') {
            role  = 'relay';
            myId  = msg.id || `relay-${Date.now()}`;
            relays.set(myId, { ws, busy: false });
            console.log(`[relay+] ${myId}`);
            ws.send(JSON.stringify({ type: 'relay:registered', id: myId }));
            return;
        }

        // ---- РЕГИСТРАЦИЯ БОТА ----
        if (msg.type === 'bot:connect') {
            const relayId = pickFreeRelay(msg.relayId);
            if (!relayId) {
                ws.send(JSON.stringify({ type: 'error', message: 'нет свободных relay' }));
                ws.close();
                return;
            }

            role  = 'bot';
            myId  = `session-${++sessionCounter}`;
            relays.get(relayId).busy = true;
            bots.set(myId, { ws, relayId });

            console.log(`[bot+] ${myId} → ${relayId}`);
            ws.send(JSON.stringify({ type: 'bot:connected', sessionId: myId, relayId }));

            // сообщаем relay что к нему подключился бот
            relays.get(relayId).ws.send(JSON.stringify({
                type: 'relay:session_start',
                sessionId: myId
            }));
            return;
        }

        // ---- ПАКЕТ ОТ БОТА → relay ----
        if (msg.type === 'bot:packet') {
            const session = bots.get(myId);
            if (!session) return;
            const relay = relays.get(session.relayId);
            if (!relay) return;
            // пересылаем как есть (данные в base64)
            relay.ws.send(JSON.stringify({
                type: 'relay:packet',
                sessionId: myId,
                data: msg.data
            }));
            return;
        }

        // ---- ПАКЕТ ОТ RELAY → бот ----
        if (msg.type === 'relay:response') {
            // relay шлёт ответ от DDNet обратно боту
            const session_ws = findBotWs(msg.sessionId);
            if (!session_ws) return;
            session_ws.send(JSON.stringify({
                type: 'bot:response',
                data: msg.data
            }));
            return;
        }
    });

    ws.on('close', () => {
        if (role === 'relay') {
            console.log(`[relay-] ${myId}`);
            relays.delete(myId);
            // дропаем ботов которые были на этом relay
            for (const [sid, s] of bots) {
                if (s.relayId === myId) {
                    s.ws.send(JSON.stringify({ type: 'error', message: 'relay отключился' }));
                    s.ws.close();
                    bots.delete(sid);
                }
            }
        }
        if (role === 'bot') {
            console.log(`[bot-] ${myId}`);
            const session = bots.get(myId);
            if (session) {
                const relay = relays.get(session.relayId);
                if (relay) {
                    relay.busy = false;
                    relay.ws.send(JSON.stringify({ type: 'relay:session_end', sessionId: myId }));
                }
                bots.delete(myId);
            }
        }
    });

    ws.on('error', (err) => console.error(`[ws error] ${myId}:`, err.message));
});

function findBotWs(sessionId) {
    return bots.get(sessionId)?.ws ?? null;
}

// --- запуск ---
server.listen(0, async () => {
    const port = server.address().port;
    console.log(`Сервер запущен на порту ${port}`);

    const listener = await ngrokmodule.connect({
        addr: port,
        authtoken: NGROK_TOKEN,
        domain: NGROK_DOMAIN
    });

    const urlHttp = listener.url();
    const urlWs   = urlHttp.replace('https://', 'wss://').replace('http://', 'ws://');
    console.log(`\nДоступен по адресу: ${urlWs}\n`);
});
