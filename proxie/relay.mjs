import dgram from 'dgram';
import WebSocket from 'ws';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SimplePeer = require('simple-peer');

// Костыль для simple-peer в Node.js
const wrtc = require('@roamhq/wrtc');

const SIGNALING_URL = 'wss://kit-touched-commonly.ngrok-free.app';
const RELAY_ID = 'relay-1';

// UDP сокет для общения с DDNet сервером
const udpSocket = dgram.createSocket('udp4');
udpSocket.bind();

let ddnetHost = null;
let ddnetPort = null;
let peer = null;

// Подключаемся к сигналингу
const ws = new WebSocket(SIGNALING_URL);

ws.on('open', () => {
    console.log('[signaling] подключился');
    ws.send(JSON.stringify({ type: 'register', id: RELAY_ID }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);

    if (msg.type === 'registered') {
        console.log(`[signaling] зарегистрирован как "${RELAY_ID}"`);
        console.log('[*] ждём бота...');
    }

    // Получили сигнал от бота — создаём peer
    if (msg.type === 'signal') {
        if (!peer) {
            peer = new SimplePeer({ 
                initiator: false, 
                wrtc,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            peer.on('signal', (signalData) => {
                // Отвечаем боту нашим сигналом
                ws.send(JSON.stringify({
                    type: 'signal',
                    to: msg.from,
                    data: signalData
                }));
            });

            peer.on('connect', () => {
                console.log('[webrtc] бот подключился!');
            });

            // Получили пакет от бота → шлём на DDNet
            peer.on('data', (buf) => {
                const targetPort = buf.readUInt16BE(0);
                const ip = `${buf[2]}.${buf[3]}.${buf[4]}.${buf[5]}`;
                const payload = buf.slice(6);

                // Запоминаем куда слать ответы
                ddnetHost = ip;
                ddnetPort = targetPort;

                udpSocket.send(payload, targetPort, ip);
            });

            peer.on('error', (err) => console.error('[webrtc] ошибка:', err));
            peer.on('close', () => {
                console.log('[webrtc] бот отключился');
                peer = null;
                ddnetHost = null;
                ddnetPort = null;
            });
        }

        peer.signal(msg.data);
    }
});

// Ответы от DDNet → шлём боту обратно
udpSocket.on('message', (msg) => {
    if (peer && peer.connected) {
        peer.send(msg);
    }
});

ws.on('close', () => console.log('[signaling] отключился'));
ws.on('error', (err) => console.error('[signaling] ошибка:', err));

console.log('Relay запущен, подключаемся к сигналингу...');