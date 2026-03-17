export declare class MsgPacker {
    result: Buffer;
    sys: boolean;
    flag: number;
    constructor(msg: number, sys: boolean, flag: number);
    AddString(str: string): void;
    AddBuffer(buffer: Buffer): void;
    AddInt(i: number): void;
    get size(): number;
    get buffer(): Buffer<ArrayBufferLike>;
}
