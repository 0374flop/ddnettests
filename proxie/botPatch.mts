import WebSocket from 'ws';
import { Client } from 'teeworlds';

const SERVER_URL = 'wss://kit-touched-commonly.ngrok-free.app';

export function createProxiedClient(
    ip: string,
    port: number,
    nickname: string,
    options?: any,
    relayId?: string
): Promise<{ client: Client; disconnect: () => void }> {
    return new Promise((resolve, reject) => {
        const client = new Client(ip, port, nickname, options);
        const socket: any = (client as any).socket;

        const ws = new WebSocket(SERVER_URL);
        let connected = false;

        const cleanup = () => {
            if (ws.readyState === WebSocket.OPEN) ws.close();
        };

        const timeout = setTimeout(() => {
            if (!connected) {
                cleanup();
                reject(new Error('Таймаут подключения к серверу'));
            }
        }, 10000);

        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'bot:connect', relayId: relayId ?? null }));
        });

        ws.on('message', (raw) => {
            let msg: any;
            try { msg = JSON.parse(raw.toString()); } catch { return; }

            if (msg.type === 'error') {
                if (!connected) {
                    clearTimeout(timeout);
                    cleanup();
                    reject(new Error(msg.message));
                }
                return;
            }

            if (msg.type === 'bot:connected') {
                console.log(`[proxy] подключились через relay "${msg.relayId}" (сессия ${msg.sessionId})`);
                connected = true;
                clearTimeout(timeout);

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
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'bot:packet', data: wrapped.toString('base64') }));
                    }
                    if (callback) callback(null, wrapped.length);
                };

                resolve({ client, disconnect: cleanup });
                return;
            }

            if (msg.type === 'bot:response') {
                const buf = Buffer.from(msg.data, 'base64');
                socket.emit('message', buf, {
                    address: (client as any).host,
                    port:    (client as any).port
                });
            }
        });

        ws.on('close', () => {
            if (connected) console.log('[proxy] соединение закрыто');
        });

        ws.on('error', (err) => {
            if (!connected) {
                clearTimeout(timeout);
                reject(err);
            } else {
                console.error('[proxy] ошибка:', err.message);
            }
        });
    });
}
