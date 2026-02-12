const net = require("net");
const dgram = require("dgram");

const [ SOCKS_HOST, SOCKS_PORT ] = '174.138.61.184:1080'.split(':');
const CONNECT_TIMEOUT = 20000;

const realCreate = dgram.createSocket;

// Глобальный SOCKS5 менеджер (одно TCP соединение для всех)
let globalSocks = null;
let initPromise = null;

async function getOrCreateSocks() {
    if (globalSocks && globalSocks.ready) {
        return globalSocks;
    }

    if (initPromise) {
        return await initPromise;
    }

    initPromise = (async () => {
        const tcp = net.connect(Number(SOCKS_PORT), SOCKS_HOST);
        
        tcp.setTimeout(CONNECT_TIMEOUT);
        tcp.on('timeout', () => {
            console.error("SOCKS5 TCP timeout");
            tcp.destroy();
        });
        tcp.on('error', (err) => {
            console.error("SOCKS5 TCP error:", err.message);
        });

        const waitData = () => new Promise(r => tcp.once("data", r));

        try {
            // Auth
            tcp.write(Buffer.from([0x05, 0x01, 0x00]));
            const greet = await waitData();
            if (greet[1] !== 0x00) throw new Error("auth failed");

            // UDP ASSOCIATE
            tcp.write(Buffer.from([
                0x05, 0x03, 0x00, 0x01,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00
            ]));
            const resp = await waitData();
            if (resp[1] !== 0x00) throw new Error("udp associate failed");

            let port = resp.readUInt16BE(resp.length - 2);
            let addr = resp.slice(4, 8).join(".");

            if (!port || port === 0 || addr === "0.0.0.0") {
                port = tcp.localPort;
                addr = SOCKS_HOST;
            }

            globalSocks = {
                tcp,
                relay: { addr, port },
                ready: true
            };

            console.log(`SOCKS5 UDP ready: ${addr}:${port}`);
            return globalSocks;
        } catch (e) {
            console.error("SOCKS5 init failed:", e.message);
            tcp.destroy();
            throw e;
        }
    })();

    return await initPromise;
}

dgram.createSocket = function(type, callback) {
    const realSocket = realCreate(type, callback);
    let socksReady = false;
    let sendQueue = [];

    // Асинхронная инициализация SOCKS5
    getOrCreateSocks().then(socks => {
        socksReady = true;
        
        // Отправляем накопленные пакеты
        sendQueue.forEach(({ msg, port, addr }) => {
            if (addr && port) {
                sendViaSocks(socks, realSocket, msg, port, addr);
            }
        });
        sendQueue = [];

        realSocket.emit("listening");
    }).catch(err => {
        console.error("SOCKS5 unavailable:", err.message);
        socksReady = false;
    });

    // Биндим сразу реальный сокет
    realSocket.bind(0);

    // Перехватываем bind
    const origBind = realSocket.bind.bind(realSocket);
    realSocket.bind = function(port, address, callback) {
        // Уже забиндили выше, просто вызываем callback
        if (typeof port === 'function') {
            port();
        } else if (typeof address === 'function') {
            address();
        } else if (typeof callback === 'function') {
            callback();
        }
    };

    // Перехватываем send
    const origSend = realSocket.send.bind(realSocket);
    realSocket.send = function(msg, offset, length, port, address, callback) {
        // Нормализация аргументов
        if (typeof offset === 'number' && typeof length === 'number') {
            // send(buffer, offset, length, port, address, callback)
        } else if (typeof offset === 'number') {
            // send(buffer, port, address, callback)
            callback = address;
            address = length;
            port = offset;
        } else {
            // send(buffer, callback)
            callback = offset;
            address = port;
            port = length;
        }

        // Проверяем валидность параметров
        if (!address || !port) {
            console.warn("Invalid send params:", { port, address });
            if (callback) callback(new Error("Invalid parameters"));
            return;
        }

        if (!socksReady) {
            sendQueue.push({ msg, port, address });
            if (callback) callback(null);
            return;
        }

        try {
            sendViaSocks(globalSocks, realSocket, msg, port, address);
            if (callback) callback(null);
        } catch (e) {
            console.error("Send error:", e.message);
            if (callback) callback(e);
        }
    };

    // Обработка входящих пакетов
    const messageHandlers = [];
    
    realSocket.on("message", function(buf, rinfo) {
        // Декапсулируем SOCKS5 заголовок
        const cleaned = decapsulate(buf);
        
        // Эмитим очищенный пакет для всех слушателей
        messageHandlers.forEach(handler => {
            handler(cleaned, rinfo);
        });
    });

    // Перехватываем подписку на события
    const origOn = realSocket.on.bind(realSocket);
    realSocket.on = function(event, handler) {
        if (event === "message") {
            messageHandlers.push(handler);
            return realSocket;
        }
        return origOn(event, handler);
    };

    return realSocket;
};

function sendViaSocks(socks, udpSocket, msg, port, addr) {
    if (!addr || typeof addr !== 'string') {
        console.error("Invalid address:", addr);
        return;
    }

    const host = addr.split(".").map(x => +x);
    
    if (host.length !== 4 || host.some(isNaN)) {
        console.error("Invalid IP address:", addr);
        return;
    }

    const header = Buffer.from([
        0x00, 0x00, 0x00,
        0x01,
        ...host,
        port >> 8, port & 0xff
    ]);

    const payload = Buffer.isBuffer(msg) ? msg : Buffer.from(msg);
    
    // Используем оригинальный send (не перехваченный)
    const realSend = dgram.Socket.prototype.send;
    realSend.call(udpSocket, Buffer.concat([header, payload]), socks.relay.port, socks.relay.addr);
}

function decapsulate(buf) {
    // Проверяем минимальную длину
    if (buf.length < 10) return buf;

    let o = 0;
    
    // RSV (2 байта) + FRAG (1 байт)
    const rsv = buf.readUInt16BE(o);
    o += 2;
    const frag = buf[o++];

    // Если не SOCKS5 заголовок, возвращаем как есть
    if (rsv !== 0 || frag !== 0) return buf;

    // ATYP
    const atyp = buf[o++];
    
    if (atyp === 1) {
        o += 4; // IPv4
    } else if (atyp === 3) {
        const len = buf[o++];
        o += len; // Domain
    } else if (atyp === 4) {
        o += 16; // IPv6
    } else {
        return buf; // Неизвестный тип
    }

    o += 2; // Port

    return buf.slice(o);
}

module.exports = { SOCKS_HOST, SOCKS_PORT, dgram };
console.log("✓ dgram patched for SOCKS5 UDP");