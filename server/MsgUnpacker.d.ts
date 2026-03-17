export declare function unpackInt(pSrc: Buffer): {
    result: number;
    remaining: Buffer;
};
export declare function unpackString(pSrc: Buffer): {
    result: string;
    remaining: Buffer;
};
export declare class MsgUnpacker {
    remaining: Buffer;
    constructor(pSrc: Buffer);
    unpackInt(): number;
    unpackString(): string;
    /** @param size - size in bytes */
    unpackRaw(size: number): Buffer;
}
