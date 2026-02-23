import * as Teeworlds from 'teeworlds';
import WebSocket from 'ws';

const SERVER_URL = 'wss://kit-touched-commonly.ngrok-free.app';

const CustomTeeworlds: typeof Teeworlds = {
    ...Teeworlds,
    Client: class extends Teeworlds.Client {
        private _ws?: WebSocket;

        constructor(ip: string, port: number, nickname: string, options?: any) {
            super(ip, port, nickname, options);
        }

        async connect() {
            // Ждём подключения к relay
            const patchSend = await this._setupProxy();

            // Патчим send ДО super.connect() — сокет уже существует (создан в конструкторе)
            // super.connect() не пересоздаёт сокет если он уже есть
            const socket: any = (this as any).socket;
            socket.send = patchSend;

            // super.connect() вешает socket.on('message') на этот же сокет
            await super.connect();
        }

        _setupProxy(): Promise<Function> {
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(SERVER_URL);
                this._ws = ws;
                let connected = false;

                const timeout = setTimeout(() => {
                    if (!connected) { ws.close(); reject(new Error('Таймаут')); }
                }, 10000);

                ws.on('open', () => {
                    ws.send(JSON.stringify({ type: 'bot:connect', relayId: null }));
                });

                ws.on('message', (raw) => {
                    let msg: any;
                    try { msg = JSON.parse(raw.toString()); } catch { return; }

                    if (msg.type === 'error') {
                        clearTimeout(timeout);
                        ws.close();
                        if (!connected) reject(new Error(msg.message));
                        return;
                    }

                    if (msg.type === 'bot:connected') {
                        console.log(`[proxy] relay "${msg.relayId}" (сессия ${msg.sessionId})`);
                        connected = true;
                        clearTimeout(timeout);

                        // Возвращаем функцию-патч для socket.send
                        const patchSend = (
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

                        resolve(patchSend);
                        return;
                    }

                    // Ответы от DDNet — эмитим на сокет
                    if (msg.type === 'bot:response') {
                        const buf = Buffer.from(msg.data, 'base64');
                        const socket: any = (this as any).socket;
                        if (socket) {
                            socket.emit('message', buf, {
                                address: (this as any).host,
                                port: (this as any).port
                            });
                        }
                    }
                });

                ws.on('error', (err) => { if (!connected) { clearTimeout(timeout); reject(err); } });
                ws.on('close', () => { if (!connected) { clearTimeout(timeout); reject(new Error('WS закрылся')); } });
            });
        }

        async Disconnect() {
            await super.Disconnect();
            // Сначала шлём явный disconnect чтобы сервер освободил relay синхронно
            if (this._ws?.readyState === WebSocket.OPEN) {
                await new Promise<void>(resolve => {
                    this._ws!.once('close', resolve);
                    this._ws!.send(JSON.stringify({ type: 'bot:disconnect' }), () => {
                        this._ws!.close();
                    });
                });
            }
        }
    } as any
};

export { CustomTeeworlds };
