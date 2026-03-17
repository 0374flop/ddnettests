import { Client } from 'teeworlds';
import net from 'net';

const [DDNET_HOST, DDNET_PORT1] = '85.215.138.194:8309'.split(':');
const DDNET_PORT = parseInt(DDNET_PORT1);
const LIVE_TIMEOUT = 35000;

function wrapUDP(payload: Buffer, host: string, port: number): Buffer {
    const ip = host.split('.').map(Number);
    const hdr = Buffer.alloc(10);
    hdr[3] = 0x01;
    hdr[4] = ip[0]; hdr[5] = ip[1]; hdr[6] = ip[2]; hdr[7] = ip[3];
    hdr.writeUInt16BE(port, 8);
    return Buffer.concat([hdr, payload]);
}

function unwrapUDP(msg: Buffer): Buffer | null {
    if (msg.length < 10 || msg[3] !== 0x01) return null;
    return msg.slice(10);
}

function isPrivateIP(ip: string): boolean {
    return ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.');
}

export function testProxyLive(
    proxyHost: string,
    proxyPort: number,
    relayHost: string,
    relayPort: number
): Promise<boolean> {
    return new Promise((resolve) => {
        if (!relayPort || relayPort <= 0 || relayPort >= 65536) {
            resolve(false);
            return;
        }

        let done = false;
        let ddClient: any = null;
        let ddSocket: any = null;

        const finish = (ok: boolean) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try { tcp.destroy(); } catch {}
            // Останавливаем клиент и его UDP сокет
            try { ddClient?.Disconnect?.(); } catch {}
            try { ddSocket?.removeAllListeners?.(); } catch {}
            try { ddSocket?.close?.(); } catch {}
            resolve(ok);
        };

        const timer = setTimeout(() => finish(false), LIVE_TIMEOUT);
        const effectiveRelay = isPrivateIP(relayHost) ? proxyHost : relayHost;

        const tcp = net.createConnection({ host: proxyHost, port: proxyPort });
        tcp.on('error', () => finish(false));

        let step = 0;
        let tcpBuf = Buffer.alloc(0);

        tcp.on('connect', () => {
            tcp.write(Buffer.from([0x05, 0x01, 0x00]));
        });

        tcp.on('data', (chunk) => {
            tcpBuf = Buffer.concat([tcpBuf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);

            if (step === 0 && tcpBuf.length >= 2) {
                if (tcpBuf[1] !== 0x00) { finish(false); return; }
                tcpBuf = tcpBuf.slice(2);
                step = 1;
                tcp.write(Buffer.from([0x05, 0x03, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                return;
            }

            if (step === 1 && tcpBuf.length >= 10) {
                if (tcpBuf[1] !== 0x00) { finish(false); return; }
                step = 2;
                tcp.setKeepAlive(true, 5000);
                tcp.on('close', () => finish(false));

                const client = new Client(DDNET_HOST, DDNET_PORT, 'testbot');
                ddClient = client;
                const socket: any = (client as any).socket;
                ddSocket = socket;

                socket.once('listening', () => {
                    const originalSend = socket.send.bind(socket);

                    socket.send = (
                        buf: Buffer, offset: number, length: number,
                        targetPort: number, targetHost: string, cb?: Function
                    ) => {
                        // Если уже завершились — не слать ничего
                        if (done) { if (cb) cb(null, 0); return; }
                        if (!targetHost) { if (cb) cb(null, 0); return; }
                        if (!relayPort || relayPort <= 0 || relayPort >= 65536) {
                            finish(false);
                            if (cb) cb(new Error('invalid relay port'), 0);
                            return;
                        }

                        const payload = buf.slice(offset, offset + length);
                        const wrapped = wrapUDP(payload, targetHost, targetPort);
                        console.log(`[send] → relay ${effectiveRelay}:${relayPort} (target ${targetHost}:${targetPort}) payload=${payload.length}b`);
                        originalSend(wrapped, 0, wrapped.length, relayPort, effectiveRelay, cb);
                    };

                    const origEmit = socket.emit.bind(socket);
                    socket.emit = (event: string, ...args: any[]) => {
                        if (done) return false;
                        if (event === 'message') {
                            console.log(`[recv] raw=${args[0].length}b from ${args[1]?.address}:${args[1]?.port}`);
                            const payload = unwrapUDP(args[0]);
                            if (!payload) {
                                console.log(`[recv] unwrap failed, first bytes: ${args[0].slice(0,12).toString('hex')}`);
                                return false;
                            }
                            console.log(`[recv] unwrapped=${payload.length}b`);
                            return origEmit('message', payload, { address: DDNET_HOST, port: DDNET_PORT });
                        }
                        return origEmit(event, ...args);
                    };

                    client.on('connected', () => finish(true));
                    client.on('disconnect', (reason: string) => {
                        console.log(`[disconnect] ${reason}`);
                        finish(false);
                    });

                    (client as any).connect();
                });
            }
        });
    });
}