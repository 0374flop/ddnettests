"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ngrokmodule = __importStar(require("@ngrok/ngrok"));
const ngrokdata = fs_1.default.readFileSync(path_1.default.join(__dirname, 'ngrok.token'), { encoding: 'utf-8' }).trim().split(' ');
const NGROK_TOKEN = ngrokdata[0];
const NGROK_DOMAIN = ngrokdata[1];
const server = http_1.default.createServer();
const wss = new ws_1.WebSocketServer({ server });
const relays = new Map();
const bots = new Map();
let sessionCounter = 0;
function pickFreeRelay(preferredId) {
    if (preferredId && relays.has(preferredId)) {
        const r = relays.get(preferredId);
        if (!r.busy)
            return preferredId;
    }
    for (const [id, r] of relays) {
        if (!r.busy)
            return id;
    }
    return null;
}
function getTime() {
    return new Date().toLocaleTimeString('ru-RU');
}
setInterval(() => {
    wss.clients.forEach((client) => {
        if (client.isAlive === false) {
            client.terminate();
            return;
        }
        client.isAlive = false;
        client.ping();
    });
}, 2000);
wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    let role = null;
    let myId = '';
    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        }
        catch {
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
            relays.get(relayId).busy = true;
            bots.set(myId, { ws, relayId });
            console.log(`[${getTime()}] Bot подключён | Session: ${myId} | Relay: ${relayId}`);
            const sid = myId;
            const releaseRelay = () => {
                const s = bots.get(sid);
                if (!s)
                    return;
                const r = relays.get(s.relayId);
                if (r) {
                    r.busy = false;
                    try {
                        r.ws.send(JSON.stringify({ type: 'relay:session_end', sessionId: sid }));
                    }
                    catch { }
                }
                bots.delete(sid);
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
                    try {
                        relay.ws.send(JSON.stringify({ type: 'relay:session_end', sessionId: myId }));
                    }
                    catch { }
                }
                bots.delete(myId);
                console.log(`[${getTime()}] Bot отключён вручную | Session: ${myId}`);
            }
            return;
        }
        if (msg.type === 'bot:packet') {
            const session = bots.get(myId);
            if (!session)
                return;
            const relay = relays.get(session.relayId);
            if (!relay)
                return;
            relay.ws.send(JSON.stringify({ type: 'relay:packet', sessionId: myId, data: msg.data }));
            return;
        }
        if (msg.type === 'relay:response') {
            const session_ws = bots.get(msg.sessionId)?.ws ?? null;
            if (!session_ws)
                return;
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
                    try {
                        relay.ws.send(JSON.stringify({ type: 'relay:session_end', sessionId: myId }));
                    }
                    catch { }
                }
                bots.delete(myId);
                console.log(`[${getTime()}] Bot отключился | Session: ${myId}`);
            }
        }
    });
});
server.listen(0, async () => {
    const addr = server.address();
    console.log(`[${getTime()}] Сервер запущен на порту ${addr.port}`);
    const listener = await ngrokmodule.connect({
        addr: addr.port,
        authtoken: NGROK_TOKEN,
        domain: NGROK_DOMAIN
    });
    const urlWs = listener.url().replace('https://', 'wss://').replace('http://', 'ws://');
    console.log(`[${getTime()}] Ngrok туннель: ${urlWs}`);
});
