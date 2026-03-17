interface HuffmanNode {
    bits: number;
    numbits: number;
    left: number;
    right: number;
    symbol: number;
}
interface HuffmanConstructNode {
    node_id: number;
    frequency: number;
}
export declare class Huffman {
    nodes: HuffmanNode[];
    decode_lut: number[];
    num_nodes: number;
    start_node_index: number;
    constructor(frequencies?: number[]);
    set_bits_r(node_index: number, bits: number, depth: number): void;
    bubble_sort(index_list: number[], node_list: HuffmanConstructNode[], size: number): number[];
    construct_tree(frequencies?: number[]): void;
    compress(inp_buffer: Buffer, start_index?: number, size?: number): Buffer;
    decompress(inp_buffer: Buffer, size?: number): Buffer;
}
export {};
