var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { Client } from 'teeworlds';
import net from 'net';
var _a = '45.141.57.22:8389'.split(':'), DDNET_HOST = _a[0], DDNET_PORT1 = _a[1];
var DDNET_PORT = parseInt(DDNET_PORT1);
var LIVE_TIMEOUT = 35000;
function wrapUDP(payload, host, port) {
    var ip = host.split('.').map(Number);
    var hdr = Buffer.alloc(10);
    hdr[3] = 0x01;
    hdr[4] = ip[0];
    hdr[5] = ip[1];
    hdr[6] = ip[2];
    hdr[7] = ip[3];
    hdr.writeUInt16BE(port, 8);
    return Buffer.concat([hdr, payload]);
}
function unwrapUDP(msg) {
    if (msg.length < 10 || msg[3] !== 0x01)
        return null;
    return msg.slice(10);
}
function isPrivateIP(ip) {
    return ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.');
}
export function testProxyLive(proxyHost, proxyPort, relayHost, relayPort) {
    return new Promise(function (resolve) {
        if (!relayPort || relayPort <= 0 || relayPort >= 65536) {
            resolve(false);
            return;
        }
        var done = false;
        var ddClient = null;
        var ddSocket = null;
        var finish = function (ok) {
            var _a, _b, _c;
            if (done)
                return;
            done = true;
            clearTimeout(timer);
            try {
                tcp.destroy();
            }
            catch (_d) { }
            // Останавливаем клиент и его UDP сокет
            try {
                (_a = ddClient === null || ddClient === void 0 ? void 0 : ddClient.Disconnect) === null || _a === void 0 ? void 0 : _a.call(ddClient);
            }
            catch (_e) { }
            try {
                (_b = ddSocket === null || ddSocket === void 0 ? void 0 : ddSocket.removeAllListeners) === null || _b === void 0 ? void 0 : _b.call(ddSocket);
            }
            catch (_f) { }
            try {
                (_c = ddSocket === null || ddSocket === void 0 ? void 0 : ddSocket.close) === null || _c === void 0 ? void 0 : _c.call(ddSocket);
            }
            catch (_g) { }
            resolve(ok);
        };
        var timer = setTimeout(function () { return finish(false); }, LIVE_TIMEOUT);
        var effectiveRelay = isPrivateIP(relayHost) ? proxyHost : relayHost;
        var tcp = net.createConnection({ host: proxyHost, port: proxyPort });
        tcp.on('error', function () { return finish(false); });
        var step = 0;
        var tcpBuf = Buffer.alloc(0);
        tcp.on('connect', function () {
            tcp.write(Buffer.from([0x05, 0x01, 0x00]));
        });
        tcp.on('data', function (chunk) {
            tcpBuf = Buffer.concat([tcpBuf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
            if (step === 0 && tcpBuf.length >= 2) {
                if (tcpBuf[1] !== 0x00) {
                    finish(false);
                    return;
                }
                tcpBuf = tcpBuf.slice(2);
                step = 1;
                tcp.write(Buffer.from([0x05, 0x03, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                return;
            }
            if (step === 1 && tcpBuf.length >= 10) {
                if (tcpBuf[1] !== 0x00) {
                    finish(false);
                    return;
                }
                step = 2;
                tcp.setKeepAlive(true, 5000);
                tcp.on('close', function () { return finish(false); });
                var client_1 = new Client(DDNET_HOST, DDNET_PORT, 'testbot');
                ddClient = client_1;
                var socket_1 = client_1.socket;
                ddSocket = socket_1;
                socket_1.once('listening', function () {
                    var originalSend = socket_1.send.bind(socket_1);
                    socket_1.send = function (buf, offset, length, targetPort, targetHost, cb) {
                        // Если уже завершились — не слать ничего
                        if (done) {
                            if (cb)
                                cb(null, 0);
                            return;
                        }
                        if (!targetHost) {
                            if (cb)
                                cb(null, 0);
                            return;
                        }
                        if (!relayPort || relayPort <= 0 || relayPort >= 65536) {
                            finish(false);
                            if (cb)
                                cb(new Error('invalid relay port'), 0);
                            return;
                        }
                        var payload = buf.slice(offset, offset + length);
                        var wrapped = wrapUDP(payload, targetHost, targetPort);
                        console.log("[send] \u2192 relay ".concat(effectiveRelay, ":").concat(relayPort, " (target ").concat(targetHost, ":").concat(targetPort, ") payload=").concat(payload.length, "b"));
                        originalSend(wrapped, 0, wrapped.length, relayPort, effectiveRelay, cb);
                    };
                    var origEmit = socket_1.emit.bind(socket_1);
                    socket_1.emit = function (event) {
                        var _a, _b;
                        var args = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            args[_i - 1] = arguments[_i];
                        }
                        if (done)
                            return false;
                        if (event === 'message') {
                            console.log("[recv] raw=".concat(args[0].length, "b from ").concat((_a = args[1]) === null || _a === void 0 ? void 0 : _a.address, ":").concat((_b = args[1]) === null || _b === void 0 ? void 0 : _b.port));
                            var payload = unwrapUDP(args[0]);
                            if (!payload) {
                                console.log("[recv] unwrap failed, first bytes: ".concat(args[0].slice(0, 12).toString('hex')));
                                return false;
                            }
                            console.log("[recv] unwrapped=".concat(payload.length, "b"));
                            return origEmit('message', payload, { address: DDNET_HOST, port: DDNET_PORT });
                        }
                        return origEmit.apply(void 0, __spreadArray([event], args, false));
                    };
                    client_1.on('connected', function () { return finish(true); });
                    client_1.on('disconnect', function (reason) {
                        console.log("[disconnect] ".concat(reason));
                        finish(false);
                    });
                    client_1.connect();
                });
            }
        });
    });
}
