"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomTeeworlds = void 0;
const Teeworlds = __importStar(require("teeworlds"));
const ws_1 = __importDefault(require("ws"));
const SERVER_URL = 'wss://kit-touched-commonly.ngrok-free.app';
const CustomTeeworlds = {
    ...Teeworlds,
    Client: class extends Teeworlds.Client {
        constructor(ip, port, nickname, options) {
            super(ip, port, nickname, options);
        }
        async connect() {
            const patchSend = await this._setupProxy();
            const socket = this.socket;
            socket.send = patchSend;
            await super.connect();
        }
        _setupProxy() {
            return new Promise((resolve, reject) => {
                const ws = new ws_1.default(SERVER_URL);
                this._ws = ws;
                let connected = false;
                const timeout = setTimeout(() => {
                    if (!connected) {
                        ws.close();
                        reject(new Error('Таймаут'));
                    }
                }, 10000);
                ws.on('open', () => {
                    ws.send(JSON.stringify({ type: 'bot:connect', relayId: null }));
                });
                ws.on('message', (raw) => {
                    let msg;
                    try {
                        msg = JSON.parse(raw.toString());
                    }
                    catch {
                        return;
                    }
                    if (msg.type === 'error') {
                        clearTimeout(timeout);
                        ws.close();
                        if (!connected)
                            reject(new Error(msg.message));
                        return;
                    }
                    if (msg.type === 'bot:connected') {
                        console.log(`[proxy] relay "${msg.relayId}" (сессия ${msg.sessionId})`);
                        connected = true;
                        clearTimeout(timeout);
                        const patchSend = (buf, offset, length, targetPort, targetHost, callback) => {
                            const parts = targetHost.split('.').map(Number);
                            const header = Buffer.alloc(6);
                            header.writeUInt16BE(targetPort, 0);
                            header[2] = parts[0];
                            header[3] = parts[1];
                            header[4] = parts[2];
                            header[5] = parts[3];
                            const wrapped = Buffer.concat([header, buf.slice(offset, offset + length)]);
                            if (ws.readyState === ws_1.default.OPEN) {
                                ws.send(JSON.stringify({ type: 'bot:packet', data: wrapped.toString('base64') }));
                            }
                            if (callback)
                                callback(null, wrapped.length);
                        };
                        resolve(patchSend);
                        return;
                    }
                    if (msg.type === 'bot:response') {
                        const buf = Buffer.from(msg.data, 'base64');
                        const socket = this.socket;
                        if (socket) {
                            socket.emit('message', buf, {
                                address: this.host,
                                port: this.port
                            });
                        }
                    }
                });
                ws.on('error', (err) => { if (!connected) {
                    clearTimeout(timeout);
                    reject(err);
                } });
                ws.on('close', () => { if (!connected) {
                    clearTimeout(timeout);
                    reject(new Error('WS закрылся'));
                } });
            });
        }
        async Disconnect() {
            await super.Disconnect();
            if (this._ws?.readyState === ws_1.default.OPEN) {
                await new Promise(resolve => {
                    this._ws.once('close', resolve);
                    this._ws.send(JSON.stringify({ type: 'bot:disconnect' }), () => {
                        this._ws.close();
                    });
                });
            }
        }
    }
};
exports.CustomTeeworlds = CustomTeeworlds;
