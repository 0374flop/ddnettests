"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MsgUnpacker = void 0;
exports.unpackInt = unpackInt;
exports.unpackString = unpackString;
const decoder = new TextDecoder('utf-8');
function unpackInt(pSrc) {
    var srcIndex = 0;
    const sign = ((pSrc[srcIndex] >> 6) & 1);
    var result = (pSrc[srcIndex] & 0b0011_1111);
    while (srcIndex <= 4) {
        if ((pSrc[srcIndex] & 0b1000_0000) === 0)
            break;
        srcIndex++;
        result |= ((pSrc[srcIndex] & 0b0111_1111)) << (6 + 7 * (srcIndex - 1));
    }
    result ^= -sign;
    return { result, remaining: pSrc.slice(srcIndex + 1) };
}
function unpackString(pSrc) {
    var result = pSrc.slice(0, pSrc.indexOf(0));
    pSrc = pSrc.slice(pSrc.indexOf(0) + 1, pSrc.length);
    return { result: decoder.decode(new Uint8Array(result)), remaining: pSrc };
}
class MsgUnpacker {
    remaining;
    constructor(pSrc) {
        this.remaining = pSrc;
    }
    unpackInt() {
        // let unpacked;
        // if (!_unpacked)  {
        let unpacked = unpackInt(this.remaining);
        this.remaining = unpacked.remaining;
        // } else {
        // unpacked = {result: this.remaining[0]};
        // this.remaining = this.remaining.slice(1);
        // }
        return unpacked.result;
    }
    unpackString() {
        let unpacked = unpackString(this.remaining);
        this.remaining = unpacked.remaining;
        return unpacked.result;
    }
    /** @param size - size in bytes */
    unpackRaw(size) {
        let unpacked = this.remaining.slice(0, size);
        this.remaining = this.remaining.slice(size);
        return unpacked;
    }
}
exports.MsgUnpacker = MsgUnpacker;
