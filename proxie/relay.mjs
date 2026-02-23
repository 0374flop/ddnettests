import dgram from 'dgram';
import { WebSocket } from 'ws';

const SERVER_URL = process.env.SERVER_URL || 'wss://kit-touched-commonly.ngrok-free.app';
const RELAY_ID   = process.env.RELAY_ID   || `relay-${Math.random().toString(36).slice(2, 7)}`;

const sessions = new Map();      // sessionId → { host, port }
const addrToSession = new Map(); // "ip:port" → sessionId

const udpSocket = dgram.createSocket('udp4');
udpSocket.bind(0, '0.0.0.0');

let ws = null;
let reconnectTimer = null;

function connect() {
    ws = new WebSocket(SERVER_URL);

    ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'relay:register', id: RELAY_ID }));
    });

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'relay:session_start') {
            sessions.set(msg.sessionId, { host: null, port: null });
        }

        if (msg.type === 'relay:session_end') {
            const s = sessions.get(msg.sessionId);
            if (s && s.host) addrToSession.delete(`${s.host}:${s.port}`);
            sessions.delete(msg.sessionId);
        }

        if (msg.type === 'relay:packet') {
            const buf = Buffer.from(msg.data, 'base64');
            const targetPort = buf.readUInt16BE(0);
            const ip         = `${buf[2]}.${buf[3]}.${buf[4]}.${buf[5]}`;
            const payload    = buf.slice(6);

            const session = sessions.get(msg.sessionId);
            if (session && !session.host) {
                session.host = ip;
                session.port = targetPort;
                addrToSession.set(`${ip}:${targetPort}`, msg.sessionId);
            }

            udpSocket.send(payload, targetPort, ip, (err) => {
                if (err) console.error(`[udp] ошибка отправки:`, err.message);
            });
        }
    });

    ws.on('close', () => {
        sessions.clear();
        addrToSession.clear();
        scheduleReconnect();
    });

    ws.on('error', () => {});
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, 3000);
}

udpSocket.on('message', (data, rinfo) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const sessionId = addrToSession.get(`${rinfo.address}:${rinfo.port}`);
    if (sessionId) {
        ws.send(JSON.stringify({ type: 'relay:response', sessionId, data: data.toString('base64') }));
    }
});

udpSocket.on('error', (err) => console.error('[udp error]', err.message));

connect();
