import net from 'dgram';
import { randomBytes } from 'crypto';
import { Huffman } from "./huffman";
import { MsgUnpacker } from "./MsgUnpacker";
import { MsgPacker } from "./MsgPacker";

const huff = new Huffman();

// Твоя функция из старого сервера
function pInt(v: number): Buffer {
    const out: number[] = [];
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
            if (!value) break;
        }
    } else out.push(first);
    return Buffer.from(out);
}

class TeeworldsServer {
    private socket: net.Socket;
    private clients: Map<string, Buffer> = new Map();
    private serverTokens: Map<string, Buffer> = new Map();

    constructor(port: number = 8303) {
        this.socket = net.createSocket('udp4');
        this.socket.on('message', (msg, rinfo) => this.onMessage(msg, rinfo));
        this.socket.bind(port, () => console.log(`[Server] Старт на ${port}. Жду кликов.`));
    }

    private onMessage(msg: Buffer, rinfo: net.RemoteInfo) {
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
                } else {
                    const challenge = randomBytes(4);
                    this.sendControl(rinfo, 5, challenge); // TOKEN
                }
            }
            return;
        }

        const token = this.clients.get(key);
        if (!token) return;

        // 2. Обычный пакет (Данные)
        // В 0.7 токен ДОЛЖЕН быть в байтах 3-7. Проверяем его:
        if (!msg.slice(3, 7).equals(token)) return;

        let payload = msg.slice(7);
        if (flags & 0x20) { // Сжато
            try {
                payload = Buffer.from(huff.decompress(payload));
            } catch (e) { return; }
        }

        const unpacker = new MsgUnpacker(payload);
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
        } catch (e) {}
    }

    private sendControl(rinfo: net.RemoteInfo, id: number, token: Buffer) {
        // ОШИБКА БЫЛА ТУТ: В 0.7 токен идет СРАЗУ после ID
        // Пакет: [0x10, 0x00, 0x00, ID, Token]
        const packet = Buffer.concat([
            Buffer.from([0x10, 0x00, 0x00, id]),
            token
        ]);
        this.socket.send(packet, rinfo.port, rinfo.address);
    }

    private sendMapChange(rinfo: net.RemoteInfo, token: Buffer) {
        // Используем твой MsgPacker
        const packer = new MsgPacker(2, true, 1); // MAP_CHANGE
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