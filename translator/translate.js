// большую часть писал ИИ потому что мне было лень
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;

let serverPid = null;
const PID_FILE = ".server.pid";
const READY_FILE = ".server.ready";
const PORT = 5000;

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function readPidFromFile(file) {
  try {
    const data = await fs.readFile(file, "utf-8");
    const pid = parseInt(data.trim(), 10);
    if (pid > 0) return pid;
  } catch {}
  return null;
}

async function isServerAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function startPythonServer() {
  await fs.unlink(PID_FILE).catch(() => {});
  await fs.unlink(READY_FILE).catch(() => {});

  spawn("python", [path.join(__dirname, "server.py")], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  }).unref();

  console.log("Python сервер запущен, ждём полной готовности...");

  const startTime = Date.now();
  while (Date.now() - startTime < 180000) { // 3 минуты
    const pid = await readPidFromFile(READY_FILE);
    if (pid && await isServerAlive(pid)) {
      serverPid = pid;
      console.log(`Сервер готов! PID: ${serverPid}`);
      return pid;
    }
    await delay(500);
  }
  throw new Error("Сервер не запустился за 3 минуты");
}

async function tryReuseExistingServer() {
  const pid = await readPidFromFile(READY_FILE) || await readPidFromFile(PID_FILE);
  if (pid && await isServerAlive(pid)) {
    serverPid = pid;
    console.log(`Живой сервер найден → переиспользуем (PID: ${serverPid})`);
    return true;
  }
  return false;
}

async function ensureServer() {
  if (serverPid && await isServerAlive(serverPid)) return;
  if (await tryReuseExistingServer()) return;
  await startPythonServer();
}

// Главная функция — безопасная и с защитой от пустого текста
async function translateText(text, sourceLang = "ru", targetLang = "en") {
  if (!text || String(text).trim() === "") {
    return text; // или return "[пусто]";
  }

  await ensureServer();

  const res = await fetch(`http://127.0.0.1:${PORT}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: String(text).trim(),
      source: sourceLang,
      target: targetLang
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${res.statusText} — ${err}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.translatedText || "";
}

function stopServer() {
  if (serverPid) {
    try {
      process.kill(serverPid, "SIGKILL");
      console.log(`Сервер убит (PID: ${serverPid})`);
    } catch {
      console.log("Сервер уже мёртв");
    }
    serverPid = null;
  }
  fs.unlink(PID_FILE).catch(() => {});
  fs.unlink(READY_FILE).catch(() => {});
}

let isShuttingDown = false;
async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("\nЗавершение работы — убиваем переводчик...");
  stopServer();
}

if (require.main === module) {
  (async () => {
    try {
      await ensureServer();
      console.log("RU → EN:", await translateText("Привет, как дела?"));
      console.log("EN → RU:", await translateText("Hello world!", "en", "ru"));
    } catch (err) {
      console.error("Ошибка:", err.message);
    }
  })();
} else {
  ensureServer();
  module.exports = { translateText, stopServer, ensureServer, gracefulShutdown };
}