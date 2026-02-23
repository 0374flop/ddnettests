import dgram from 'dgram';
import { WebSocket } from 'ws';

const SERVER_URL = process.env.SERVER_URL || 'wss://kit-touched-commonly.ngrok-free.app';
const RELAY_ID   = process.env.RELAY_ID   || `relay-${Math.random().toString(36).slice(2, 7)}`;

// sessionId → { host, port } — куда слать UDP ответы
const sessions = new Map();

const udpSocket = dgram.createSocket('udp4');
udpSocket.bind(0, '0.0.0.0', () => {
    console.log(`[udp] слушаем на ${udpSocket.address().address}:${udpSocket.address().port}`);
});

let ws = null;
let reconnectTimer = null;

function connect() {
    console.log(`[*] подключаемся к ${SERVER_URL} как "${RELAY_ID}"...`);
    ws = new WebSocket(SERVER_URL);

    ws.on('open', () => {
        console.log('[+] подключились');
        ws.send(JSON.stringify({ type: 'relay:register', id: RELAY_ID }));
    });

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'relay:registered') {
            console.log(`[*] зарегистрирован как "${RELAY_ID}", ждём ботов...`);
        }

        if (msg.type === 'relay:session_start') {
            console.log(`[bot+] сессия ${msg.sessionId}`);
            // host/port узнаем из первого пакета
            sessions.set(msg.sessionId, { host: null, port: null });
        }

        if (msg.type === 'relay:session_end') {
            console.log(`[bot-] сессия ${msg.sessionId}`);
            sessions.delete(msg.sessionId);
        }

        // пакет от бота — шлём UDP на DDNet
        if (msg.type === 'relay:packet') {
            const buf = Buffer.from(msg.data, 'base64');

            const targetPort = buf.readUInt16BE(0);
            const ip         = `${buf[2]}.${buf[3]}.${buf[4]}.${buf[5]}`;
            const payload    = buf.slice(6);

            console.log(`[>>] UDP → ${ip}:${targetPort} (${payload.length} байт)`);

            const session = sessions.get(msg.sessionId);
            if (session) {
                session.host = ip;
                session.port = targetPort;
            } else {
                console.log(`[!] relay:packet — сессия не найдена: ${msg.sessionId}`);
            }

            udpSocket.send(payload, targetPort, ip, (err) => {
                if (err) console.error(`[udp] ошибка отправки:`, err.message);
            });
        }
    });

    ws.on('close', () => {
        console.log('[-] отключились, реконнект через 3с...');
        sessions.clear();
        scheduleReconnect();
    });

    ws.on('error', (err) => {
        console.error('[ws error]', err.message);
    });
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, 3000);
}

// UDP ответы от DDNet — пересылаем боту через сервер
// Нужно понять какой сессии принадлежит ответ.
// DDNet шлёт с того же ip:port куда мы слали — ищем сессию по host:port
udpSocket.on('message', (data, rinfo) => {
    console.log(`[<<] UDP от ${rinfo.address}:${rinfo.port} (${data.length} байт)`);
    if (!ws || ws.readyState !== WebSocket.OPEN) { console.log('[!] WS не открыт'); return; }

    for (const [sessionId, s] of sessions) {
        if (s.host === rinfo.address && s.port === rinfo.port) {
            ws.send(JSON.stringify({
                type: 'relay:response',
                sessionId,
                data: data.toString('base64')
            }));
            return;
        }
    }
    console.log(`[!] UDP ответ не нашёл сессию (${rinfo.address}:${rinfo.port})`);
});

udpSocket.on('error', (err) => console.error('[udp error]', err.message));

connect();
