import WebSocket from 'ws';
import SimplePeer from 'simple-peer';
import { createRequire } from 'module';
import { Client } from 'teeworlds';

const require = createRequire(import.meta.url);
const wrtc = require('@roamhq/wrtc');

const SIGNALING_URL = 'wss://kit-touched-commonly.ngrok-free.app';
const BOT_ID = 'bot-1';
const RELAY_ID = 'relay-1';

export function createProxiedClient(
    ip: string,
    port: number,
    nickname: string,
    options?: any
): Promise<{ client: Client, disconnect: () => void }> {
    return new Promise((resolve, reject) => {
        const client = new Client(ip, port, nickname, options);
        const socket: any = (client as any).socket;

        const ws = new WebSocket(SIGNALING_URL);
        let peer: any = null;
        let connected = false;

        const cleanup = () => {
            if (peer) {
                peer.destroy();
                peer = null;
            }
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };

        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'register', id: BOT_ID }));
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'registered') {
                peer = new SimplePeer({ 
                    initiator: true, 
                    wrtc,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    }
                });

                peer.on('signal', (signalData: any) => {
                    ws.send(JSON.stringify({
                        type: 'signal',
                        to: RELAY_ID,
                        data: signalData
                    }));
                });

                peer.on('connect', () => {
                    console.log('[webrtc] подключились к relay!');
                    connected = true;

                    socket.send = (
                        buf: Buffer,
                        offset: number,
                        length: number,
                        targetPort: number,
                        targetHost: string,
                        callback?: Function
                    ) => {
                        const parts = targetHost.split('.').map(Number);
                        const header = Buffer.alloc(6);
                        header.writeUInt16BE(targetPort, 0);
                        header[2] = parts[0]; header[3] = parts[1];
                        header[4] = parts[2]; header[5] = parts[3];

                        const wrapped = Buffer.concat([header, buf.slice(offset, offset + length)]);
                        peer.send(wrapped);

                        if (callback) callback(null, wrapped.length);
                    };

                    peer.on('data', (buf: Buffer) => {
                        const host = (client as any).host;
                        const port = (client as any).port;
                        socket.emit('message', buf, { address: host, port });
                    });

                    peer.on('close', () => {
                        console.log('[webrtc] соединение закрыто');
                    });

                    resolve({ client, disconnect: cleanup });
                });

                peer.on('error', (err: any) => {
                    if (!connected) reject(err);
                    else console.error('[webrtc] ошибка:', err);
                });
            }

            if (msg.type === 'signal') {
                peer?.signal(msg.data);
            }
        });

        ws.on('error', reject);

        setTimeout(() => {
            if (!connected) reject(new Error('Таймаут подключения к relay'));
        }, 10000);
    });
}