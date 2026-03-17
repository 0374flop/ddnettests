"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dgram_1 = __importDefault(require("dgram"));
const crypto_1 = require("crypto");
const huffman_1 = require("./huffman");
const MsgUnpacker_1 = require("./MsgUnpacker");
const MsgPacker_1 = require("./MsgPacker");
const huff = new huffman_1.Huffman();
// Твоя функция из старого сервера
function pInt(v) {
    const out = [];
    let value = v;
    let first = (value >> 25) & 0x40;
    value = value ^ (value >> 31);
    first |= value & 0x3f;
    value >>= 6;
    if (value) {
        first |= 0x80;
        out.push(first);
        while (true) {
            let b = value & 0x7f;
            value >>= 7;
            b |= (value !== 0 ? 1 : 0) << 7;
            out.push(b);
            if (!value)
                break;
        }
    }
    else
        out.push(first);
    return Buffer.from(out);
}
class TeeworldsServer {
    socket;
    clients = new Map();
    serverTokens = new Map();
    constructor(port = 8303) {
        this.socket = dgram_1.default.createSocket('udp4');
        this.socket.on('message', (msg, rinfo) => this.onMessage(msg, rinfo));
        this.socket.bind(port, () => console.log(`[Server] Старт на ${port}. Жду кликов.`));
    }
    onMessage(msg, rinfo) {
        const key = `${rinfo.address}:${rinfo.port}`;
        const flags = msg[0];
        // 1. Контрольный пакет (CONNECT)
        if (flags & 0x10) {
            const ctrlID = msg[3];
            if (ctrlID === 1) { // CONNECT
                if (msg.length >= 8) {
                    const token = msg.slice(4, 8);
                    this.clients.set(key, token);
                    console.log(`[Conn] ${key}: Токен получен. Шлю ACCEPT.`);
                    // Шлем ACCEPT
                    this.sendControl(rinfo, 2, token);
                }
                else {
                    const challenge = (0, crypto_1.randomBytes)(4);
                    this.sendControl(rinfo, 5, challenge); // TOKEN
                }
            }
            return;
        }
        const token = this.clients.get(key);
        if (!token)
            return;
        // 2. Обычный пакет (Данные)
        // В 0.7 токен ДОЛЖЕН быть в байтах 3-7. Проверяем его:
        if (!msg.slice(3, 7).equals(token))
            return;
        let payload = msg.slice(7);
        if (flags & 0x20) { // Сжато
            try {
                payload = Buffer.from(huff.decompress(payload));
            }
            catch (e) {
                return;
            }
        }
        const unpacker = new MsgUnpacker_1.MsgUnpacker(payload);
        try {
            const chunkHeader = unpacker.unpackInt();
            const msgIdRaw = unpacker.unpackInt();
            const id = msgIdRaw >> 1;
            if (msgIdRaw & 1) { // System message
                console.log(`[SysMsg] Пришел ID: ${id}. Теперь клиент точно нас видит!`);
                if (id === 1) { // NETMSG_INFO
                    this.sendMapChange(rinfo, token);
                }
            }
        }
        catch (e) { }
    }
    sendControl(rinfo, id, token) {
        // ОШИБКА БЫЛА ТУТ: В 0.7 токен идет СРАЗУ после ID
        // Пакет: [0x10, 0x00, 0x00, ID, Token]
        const packet = Buffer.concat([
            Buffer.from([0x10, 0x00, 0x00, id]),
            token
        ]);
        this.socket.send(packet, rinfo.port, rinfo.address);
    }
    sendMapChange(rinfo, token) {
        // Используем твой MsgPacker
        const packer = new MsgPacker_1.MsgPacker(2, true, 1); // MAP_CHANGE
        packer.AddString("dm1");
        packer.AddInt(0);
        packer.AddInt(0);
        // Упаковка чанка (как в твоем старом коде)
        const chunk = Buffer.concat([
            pInt((1 << 6) | packer.result.length), // Vital flag + size
            packer.result
        ]);
        const compressed = huff.compress(chunk);
        // Заголовок 0.7: [Flags, Ack, NumChunks, Token, Data]
        const packet = Buffer.concat([
            Buffer.from([0x20, 0x00, 0x01]),
            token,
            compressed
        ]);
        this.socket.send(packet, rinfo.port, rinfo.address);
        console.log(`[Sent] Карта отправлена.`);
    }
}
new TeeworldsServer();
