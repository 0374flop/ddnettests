import net from 'net';
import fs from 'fs';
import { testProxyLive } from './mintest.mts';

const TIMEOUT_MS = 5000;

export interface ProxyResult {
    proxy: string;
    ok: boolean;
    relayHost?: string;
    relayPort?: number;
    error?: string;
}

export function checkProxy(host: string, port: number): Promise<ProxyResult> {
    const proxy = `${host}:${port}`;
    return new Promise((resolve) => {
        const done = (result: ProxyResult) => {
            clearTimeout(timer);
            if (!socket.destroyed) socket.destroy();
            resolve(result);
        };

        const fail = (error: string) => done({ proxy, ok: false, error });

        const timer = setTimeout(() => fail('timeout'), TIMEOUT_MS);

        const socket = net.createConnection({ host, port, timeout: TIMEOUT_MS });
        socket.on('timeout', () => fail('timeout'));
        socket.on('error', (err) => fail(err.message));

        let step = 0;
        let buf = Buffer.alloc(0);

        socket.on('connect', () => {
            socket.write(Buffer.from([0x05, 0x01, 0x00]));
        });

        socket.on('data', (chunk) => {
            buf = Buffer.concat([buf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);

            if (step === 0 && buf.length >= 2) {
                if (buf[0] !== 0x05 || buf[1] !== 0x00) {
                    return fail(`bad greeting: ${buf.slice(0, 2).toString('hex')}`);
                }
                buf = buf.slice(2);
                step = 1;
                socket.write(Buffer.from([
                    0x05, 0x03, 0x00,
                    0x01,
                    0x00, 0x00, 0x00, 0x00,
                    0x00, 0x00
                ]));
                return;
            }

            if (step === 1 && buf.length >= 10) {
                if (buf[0] !== 0x05) return fail(`bad version: ${buf[0]}`);
                if (buf[1] !== 0x00) return fail(`UDP ASSOCIATE rejected: 0x${buf[1].toString(16)}`);

                const atyp = buf[3];
                let relayHost: string;
                let relayPort: number;

                if (atyp === 0x01) {
                    relayHost = `${buf[4]}.${buf[5]}.${buf[6]}.${buf[7]}`;
                    relayPort = buf.readUInt16BE(8);
                } else if (atyp === 0x03) {
                    const len = buf[4];
                    if (buf.length < 5 + len + 2) return;
                    relayHost = buf.slice(5, 5 + len).toString();
                    relayPort = buf.readUInt16BE(5 + len);
                } else {
                    return fail(`unsupported ATYP: 0x${atyp.toString(16)}`);
                }

                if (relayHost === '0.0.0.0') relayHost = host;

                // Фильтруем невалидный порт сразу
                if (!relayPort || relayPort <= 0 || relayPort >= 65536) {
                    return fail(`invalid relayPort: ${relayPort}`);
                }

                done({ proxy, ok: true, relayHost, relayPort });
            }
        });
    });
}

export async function checkProxies(
    proxies: Array<{ host: string; port: number }>,
    { concurrency = 50, verbose = true } = {}
): Promise<ProxyResult[]> {
    const results: ProxyResult[] = [];
    let idx = 0;

    const worker = async () => {
        while (idx < proxies.length) {
            const i = idx++;
            const { host, port } = proxies[i];
            const result = await checkProxy(host, port);
            results.push(result);
            if (verbose) {
                if (result.ok) {
                    console.log(`✅ ${result.proxy} → relay ${result.relayHost}:${result.relayPort}`);
                } else {
                    console.log(`❌ ${result.proxy} — ${result.error}`);
                }
            }
        }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
}

export function parseProxyList(text: string): Array<{ host: string; port: number }> {
    return text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => {
            const parts = l.split('://');
            const addr = parts[parts.length - 1];
            const [host, portStr] = addr.split(':');
            return { host: host.trim(), port: parseInt(portStr) };
        })
        .filter(p => p.host && !isNaN(p.port));
}

// --- CLI ---
const file = process.argv[2];
const concurrency = parseInt(process.argv[3] ?? '50');

if (!file) {
    console.error('Usage: npx tsx checker.mts proxies.txt [concurrency]');
    process.exit(1);
}

if (!fs.existsSync(file)) {
    console.error(`Файл не найден: ${file}`);
    process.exit(1);
}

const text = fs.readFileSync(file, 'utf-8');
const proxies = parseProxyList(text);

if (proxies.length === 0) {
    console.error('Список прокси пустой или не распарсился. Формат: host:port (по одному на строку)');
    process.exit(1);
}

console.log(`Проверяем ${proxies.length} прокси (concurrency=${concurrency})...\n`);

const results = await checkProxies(proxies, { concurrency });
const good = results.filter(r => r.ok);
const bad  = results.filter(r => !r.ok);

console.log(`\n=== Готово: ${good.length} рабочих, ${bad.length} нерабочих ===`);

if (good.length > 0) {
    const out = 'working_proxies.txt';
    fs.writeFileSync(out, good.map(r => r.proxy).join('\n'));
    console.log(`Рабочие сохранены в ${out}`);
}

console.log('\nЖивой тест через DDNet...\n');
const liveGood: ProxyResult[] = [];
let liveIdx = 0;
const LIVE_CONCURRENCY = 10;

const liveWorker = async () => {
    while (liveIdx < good.length) {
        const r = good[liveIdx++];
        const [ph, pp] = r.proxy.split(':');
        try {
            const ok = await testProxyLive(ph, parseInt(pp), r.relayHost!, r.relayPort!);
            console.log(ok ? `🟢 ${r.proxy}` : `🔴 ${r.proxy} — нет коннекта`);
            if (ok) liveGood.push(r);
        } catch (e: any) {
            console.log(`🔴 ${r.proxy} — ошибка: ${e.message}`);
        }
    }
};

await Promise.all(Array.from({ length: LIVE_CONCURRENCY }, liveWorker));

fs.writeFileSync('live_proxies.txt', liveGood.map(r => r.proxy).join('\n'));
console.log(`\nЖивых: ${liveGood.length} из ${good.length}`);