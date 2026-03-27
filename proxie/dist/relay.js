"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dgram_1 = __importDefault(require("dgram"));
const ws_1 = require("ws");
const SERVER_URL = process.env.SERVER_URL || 'wss://kit-touched-commonly.ngrok-free.app';
const RELAY_ID = process.env.RELAY_ID || `relay-${Math.random().toString(36).slice(2, 8)}`;
const sessions = new Map();
const addrToSession = new Map();
const udpSocket = dgram_1.default.createSocket('udp4');
udpSocket.bind(0, '0.0.0.0');
let ws = null;
let reconnectTimer = null;
function connect() {
    if (ws && ws.readyState === ws_1.WebSocket.OPEN)
        return;
    console.log(`[relay] Подключение к ${SERVER_URL}...`);
    ws = new ws_1.WebSocket(SERVER_URL);
    ws.on('open', () => {
        console.log(`[relay] Подключён успешно как ${RELAY_ID}`);
        ws.send(JSON.stringify({ type: 'relay:register', id: RELAY_ID }));
    });
    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        }
        catch {
            return;
        }
        if (msg.type === 'relay:session_start') {
            sessions.set(msg.sessionId, { host: null, port: null });
            console.log(`[proxy] relay "${RELAY_ID}" (сессия ${msg.sessionId})`);
        }
        if (msg.type === 'relay:session_end') {
            const s = sessions.get(msg.sessionId);
            if (s && s.host)
                addrToSession.delete(`${s.host}:${s.port}`);
            sessions.delete(msg.sessionId);
        }
        if (msg.type === 'relay:packet') {
            const buf = Buffer.from(msg.data, 'base64');
            const targetPort = buf.readUInt16BE(0);
            const ip = `${buf[2]}.${buf[3]}.${buf[4]}.${buf[5]}`;
            const payload = buf.slice(6);
            const session = sessions.get(msg.sessionId);
            if (session && !session.host) {
                session.host = ip;
                session.port = targetPort;
                addrToSession.set(`${ip}:${targetPort}`, msg.sessionId);
            }
            udpSocket.send(payload, targetPort, ip, (err) => {
                if (err)
                    console.error('[udp] ошибка отправки:', err.message);
            });
        }
    });
    ws.on('close', (code) => {
        console.log(`[relay] Соединение закрыто (code: ${code})`);
        sessions.clear();
        addrToSession.clear();
        scheduleReconnect();
    });
    ws.on('error', (err) => {
        console.error(`[relay] Ошибка WebSocket: ${err.message}`);
    });
}
function scheduleReconnect() {
    if (reconnectTimer)
        clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, 2000);
}
// Keep-alive
setInterval(() => {
    if (ws && ws.readyState === ws_1.WebSocket.OPEN) {
        ws.ping();
    }
}, 15000);
udpSocket.on('message', (data, rinfo) => {
    if (!ws || ws.readyState !== ws_1.WebSocket.OPEN)
        return;
    const sessionId = addrToSession.get(`${rinfo.address}:${rinfo.port}`);
    if (sessionId) {
        ws.send(JSON.stringify({
            type: 'relay:response',
            sessionId,
            data: data.toString('base64')
        }));
    }
});
udpSocket.on('error', (err) => console.error('[udp error]', err.message));
connect();
