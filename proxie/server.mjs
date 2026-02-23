import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ngrokmodule = await import('@ngrok/ngrok');
const ngrokdata = fs.readFileSync(path.join(__dirname, 'ngrok.token'), { encoding: 'utf-8' }).trim().split(' ');
const NGROK_TOKEN  = ngrokdata[0];
const NGROK_DOMAIN = ngrokdata[1];

const server = http.createServer();
const wss = new WebSocketServer({ server });

const relays = new Map(); // relayId → { ws, busy }
const bots   = new Map(); // sessionId → { ws, relayId }

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

// heartbeat каждые 2с — обнаруживаем мёртвые соединения быстро
setInterval(() => {
    wss.clients.forEach((client) => {
        if (client.isAlive === false) { client.terminate(); return; }
        client.isAlive = false;
        client.ping();
    });
}, 2000);

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let role = null;
    let myId  = null;

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'relay:register') {
            role = 'relay';
            myId = msg.id || `relay-${Date.now()}`;
            relays.set(myId, { ws, busy: false });
            ws.send(JSON.stringify({ type: 'relay:registered', id: myId }));
            return;
        }

        if (msg.type === 'bot:connect') {
            const relayId = pickFreeRelay(msg.relayId);
            if (!relayId) {
                ws.send(JSON.stringify({ type: 'error', message: 'нет свободных relay' }));
                ws.close();
                return;
            }

            role = 'bot';
            myId = `session-${++sessionCounter}`;
            relays.get(relayId).busy = true;
            bots.set(myId, { ws, relayId });

            const releaseRelay = () => {
                const s = bots.get(myId);
                if (!s) return;
                const r = relays.get(s.relayId);
                if (r) {
                    r.busy = false;
                    try { r.ws.send(JSON.stringify({ type: 'relay:session_end', sessionId: myId })); } catch {}
                }
                bots.delete(myId);
            };
            ws.once('close', releaseRelay);
            ws.once('error', releaseRelay);

            ws.send(JSON.stringify({ type: 'bot:connected', sessionId: myId, relayId }));
            relays.get(relayId).ws.send(JSON.stringify({ type: 'relay:session_start', sessionId: myId }));
            return;
        }

        if (msg.type === 'bot:disconnect') {
            const session = bots.get(myId);
            if (session) {
                const relay = relays.get(session.relayId);
                if (relay) {
                    relay.busy = false;
                    try { relay.ws.send(JSON.stringify({ type: 'relay:session_end', sessionId: myId })); } catch {}
                }
                bots.delete(myId);
            }
            return;
        }

        if (msg.type === 'bot:packet') {
            const session = bots.get(myId);
            if (!session) return;
            const relay = relays.get(session.relayId);
            if (!relay) return;
            relay.ws.send(JSON.stringify({ type: 'relay:packet', sessionId: myId, data: msg.data }));
            return;
        }

        if (msg.type === 'relay:response') {
            const session_ws = bots.get(msg.sessionId)?.ws ?? null;
            if (!session_ws) return;
            session_ws.send(JSON.stringify({ type: 'bot:response', data: msg.data }));
            return;
        }
    });

    ws.on('close', () => {
        if (role === 'relay') {
            relays.delete(myId);
            for (const [sid, s] of bots) {
                if (s.relayId === myId) {
                    s.ws.send(JSON.stringify({ type: 'error', message: 'relay отключился' }));
                    s.ws.close();
                    bots.delete(sid);
                }
            }
        }
        if (role === 'bot') {
            const session = bots.get(myId);
            if (session) {
                const relay = relays.get(session.relayId);
                if (relay) {
                    relay.busy = false;
                    try { relay.ws.send(JSON.stringify({ type: 'relay:session_end', sessionId: myId })); } catch {}
                }
                bots.delete(myId);
            }
        }
    });
});

server.listen(0, async () => {
    const port = server.address().port;
    console.log(`[local] ws://localhost:${port}`);

    const listener = await ngrokmodule.connect({
        addr: port,
        authtoken: NGROK_TOKEN,
        domain: NGROK_DOMAIN
    });

    const urlWs = listener.url().replace('https://', 'wss://').replace('http://', 'ws://');
    console.log(`[ngrok] ${urlWs}`);
});
