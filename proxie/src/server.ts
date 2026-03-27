import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import * as ngrokmodule from '@ngrok/ngrok';

const ngrokdata = fs.readFileSync(path.join(__dirname, 'ngrok.token'), { encoding: 'utf-8' }).trim().split(' ');
const NGROK_TOKEN = ngrokdata[0];
const NGROK_DOMAIN = ngrokdata[1];

interface RelayEntry {
    ws: WebSocket;
    busy: boolean;
}

interface BotSession {
    ws: WebSocket;
    relayId: string;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

const relays = new Map<string, RelayEntry>();
const bots = new Map<string, BotSession>();

let sessionCounter = 0;

function pickFreeRelay(preferredId?: string | null): string | null {
    if (preferredId && relays.has(preferredId)) {
        const r = relays.get(preferredId)!;
        if (!r.busy) return preferredId;
    }
    for (const [id, r] of relays) {
        if (!r.busy) return id;
    }
    return null;
}

function getTime() {
    return new Date().toLocaleTimeString('ru-RU');
}

setInterval(() => {
    wss.clients.forEach((client: any) => {
        if (client.isAlive === false) { 
            client.terminate(); 
            return; 
        }
        client.isAlive = false;
        client.ping();
    });
}, 2000);

wss.on('connection', (ws: WebSocket) => {
    (ws as any).isAlive = true;
    ws.on('pong', () => { (ws as any).isAlive = true; });

    let role: 'relay' | 'bot' | null = null;
    let myId: string = '';

    ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
        let msg: any;
        try { 
            msg = JSON.parse(raw.toString()); 
        } catch { 
            return; 
        }

        if (msg.type === 'relay:register') {
            role = 'relay';
            myId = msg.id || `relay-${Date.now()}`;
            relays.set(myId, { ws, busy: false });
            console.log(`[${getTime()}] Relay зарегистрирован: ${myId}`);
            ws.send(JSON.stringify({ type: 'relay:registered', id: myId }));
            return;
        }

        if (msg.type === 'bot:connect') {
            const relayId = pickFreeRelay(msg.relayId);
            if (!relayId) {
                console.log(`[${getTime()}] Bot: нет свободных relay`);
                ws.send(JSON.stringify({ type: 'error', message: 'нет свободных relay' }));
                ws.close();
                return;
            }

            role = 'bot';
            myId = `session-${++sessionCounter}`;
            relays.get(relayId)!.busy = true;
            bots.set(myId, { ws, relayId });

            console.log(`[${getTime()}] Bot подключён | Session: ${myId} | Relay: ${relayId}`);

            const sid = myId;
            const releaseRelay = () => {
                const s = bots.get(sid);
                if (!s) return;
                const r = relays.get(s.relayId);
                if (r) {
                    r.busy = false;
                    try { r.ws.send(JSON.stringify({ type: 'relay:session_end', sessionId: sid })); } catch {}
                }
                bots.delete(sid);
            };

            ws.once('close', releaseRelay);
            ws.once('error', releaseRelay);

            ws.send(JSON.stringify({ type: 'bot:connected', sessionId: myId, relayId }));
            relays.get(relayId)!.ws.send(JSON.stringify({ type: 'relay:session_start', sessionId: myId }));
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
                console.log(`[${getTime()}] Bot отключён вручную | Session: ${myId}`);
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
            console.log(`[${getTime()}] Relay отключился: ${myId}`);
            relays.delete(myId);
            for (const [sid, s] of bots) {
                if (s.relayId === myId) {
                    s.ws.send(JSON.stringify({ type: 'error', message: 'relay отключился' }));
                    s.ws.close();
                    bots.delete(sid);
                    console.log(`[${getTime()}] Bot принудительно отключён из-за падения relay | Session: ${sid}`);
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
                console.log(`[${getTime()}] Bot отключился | Session: ${myId}`);
            }
        }
    });
});

server.listen(0, async () => {
    const addr = server.address() as { port: number };
    console.log(`[${getTime()}] Сервер запущен на порту ${addr.port}`);
    
    const listener = await ngrokmodule.connect({
        addr: addr.port,
        authtoken: NGROK_TOKEN,
        domain: NGROK_DOMAIN
    });

    const urlWs = listener.url()!.replace('https://', 'wss://').replace('http://', 'ws://');
    console.log(`[${getTime()}] Ngrok туннель: ${urlWs}`);
});