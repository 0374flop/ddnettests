import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

const PID_FILE  = '.server.pid';
const READY_FILE = '.server.ready';
const PORT = 5000;

let serverPid: number | null = null;
let isShuttingDown = false;
let startingPromise: Promise<void> | null = null; // мьютекс запуска

// ─── утилиты ────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

async function readPidFromFile(file: string): Promise<number | null> {
    try {
        const data = await fs.readFile(file, 'utf-8');
        const pid = parseInt(data.trim(), 10);
        if (pid > 0) return pid;
    } catch {}
    return null;
}

function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function isServerHealthy(): Promise<boolean> {
    try {
        const res = await fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(1000) });
        if (!res.ok) return false;
        const data = await res.json() as { status?: string };
        console.log('health check:', data);
        return data.status === 'ok';
    } catch (e) {
        console.log('health check failed:', e);
        return false;
    }
}

// ─── управление сервером ─────────────────────────────────────────────────────

async function startPythonServer(): Promise<void> {
    await fs.unlink(PID_FILE).catch(() => {});
    await fs.unlink(READY_FILE).catch(() => {});

    const proc = spawn('python', [path.join(__dirname, 'server.py')], {
        detached: true,
        stdio: 'pipe', // было 'ignore'
        windowsHide: true,
    });
    proc.stdout?.on('data', (d) => console.log('[python]', d.toString().trim()));
    proc.stderr?.on('data', (d) => console.log('[python err]', d.toString().trim()));
    proc.on('error', (e) => console.log('[python spawn error]', e.message));
    proc.unref();

    console.log('Python сервер запущен, ждём полной готовности...');

    const deadline = Date.now() + 180_000; // 3 минуты
    while (Date.now() < deadline) {
        if (await isServerHealthy()) {
            // читаем PID из файла чтобы потом можно было убить процесс
            serverPid = await readPidFromFile(READY_FILE) ?? await readPidFromFile(PID_FILE);
            console.log(`Сервер готов!${serverPid ? ` PID: ${serverPid}` : ''}`);
            return;
        }
        await delay(500);
    }
    throw new Error('Сервер не запустился за 3 минуты');
}

async function tryReuseExistingServer(): Promise<boolean> {
    if (!await isServerHealthy()) return false;
    serverPid = await readPidFromFile(READY_FILE) ?? await readPidFromFile(PID_FILE);
    console.log(`Живой сервер найден → переиспользуем${serverPid ? ` (PID: ${serverPid})` : ''}`);
    return true;
}

export async function ensureServer(): Promise<void> {
    if (await isServerHealthy()) return; // уже живой — ничего не делаем
    // мьютекс — если запуск уже идёт, просто ждём его
    if (startingPromise) return startingPromise;
    startingPromise = startPythonServer().finally(() => { startingPromise = null; });
    return startingPromise;
}

// ─── перевод ─────────────────────────────────────────────────────────────────

interface TranslateResponse {
    translatedText?: string;
    error?: string;
}

export async function translateText(
    text: string,
    sourceLang: string = 'ru',
    targetLang: string = 'en',
): Promise<string> {
    const trimmed = String(text).trim();
    if (!trimmed) return text;

    await ensureServer();

    const res = await fetch(`http://127.0.0.1:${PORT}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, source: sourceLang, target: targetLang }),
    });

    if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${res.statusText} — ${err}`);
    }

    const data = await res.json() as TranslateResponse;
    if (data.error) throw new Error(data.error);
    return data.translatedText ?? '';
}

// ─── завершение ───────────────────────────────────────────────────────────────

export function stopServer(): void {
    if (serverPid) {
        try {
            process.kill(serverPid, 'SIGKILL');
            console.log(`Сервер убит (PID: ${serverPid})`);
        } catch {
            console.log('Сервер уже мёртв');
        }
        serverPid = null;
    }
    fs.unlink(PID_FILE).catch(() => {});
    fs.unlink(READY_FILE).catch(() => {});
}

export async function gracefulShutdown(): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\nЗавершение работы — убиваем переводчик...');
    stopServer();
}

// ─── запуск напрямую ──────────────────────────────────────────────────────────

// ts-node translate.ts
const isMain = require.main === module;
if (isMain) {
    (async () => {
        try {
            await ensureServer();
            console.log('RU → EN:', await translateText('Привет, как дела?'));
            console.log('EN → RU:', await translateText('Hello world!', 'en', 'ru'));
        } catch (err) {
            console.error('Ошибка:', (err as Error).message);
        } finally {
            await gracefulShutdown();
        }
    })();
} else {
    ensureServer(); // прогреваем при импорте
}