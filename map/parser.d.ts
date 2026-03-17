import { EventEmitter } from 'events';
export declare enum TileId {
    AIR = 0,
    SOLID = 1,
    DEATH = 2,
    NOHOOK = 3,
    NOLASER = 4,
    THROUGH_CUT = 5,
    THROUGH = 6,
    JUMP = 7,
    FREEZE = 9,
    TELEINEVIL = 10,
    UNFREEZE = 11,
    DFREEZE = 12,
    DUNFREEZE = 13,
    TELEINWEAPON = 14,
    TELEINHOOK = 15,
    WALLJUMP = 16,
    EHOOK_ENABLE = 17,
    EHOOK_DISABLE = 18,
    HIT_ENABLE = 19,
    HIT_DISABLE = 20,
    SOLO_ENABLE = 21,
    SOLO_DISABLE = 22
}
export declare enum TileFlags {
    FLIP_X = 1,
    FLIP_Y = 2,
    OPAQUE = 4,
    ROTATE = 8
}
export declare enum TilemapLayerType {
    TILES = 0,
    GAME = 1,
    TELE = 2,
    SPEEDUP = 4,
    FRONT = 8,
    SWITCH = 16,
    TUNE = 32
}
export interface Tile {
    id: number;
    flags: number;
}
export interface TeleTile {
    number: number;
    id: number;
}
export interface SpeedupTile {
    force: number;
    max_speed: number;
    id: number;
    angle: number;
}
export interface SwitchTile {
    number: number;
    id: number;
    flags: number;
    delay: number;
}
export interface TuneTile {
    number: number;
    id: number;
}
export interface TileLayer {
    width: number;
    height: number;
    layer_type: TilemapLayerType;
    name: string;
    detail: boolean;
    tiles?: Tile[][];
    tele_tiles?: TeleTile[][];
    speedup_tiles?: SpeedupTile[][];
    switch_tiles?: SwitchTile[][];
    tune_tiles?: TuneTile[][];
}
export interface LayerGroup {
    name: string;
    x_offset: number;
    y_offset: number;
    x_parallax: number;
    y_parallax: number;
    clipping: boolean;
    layers: TileLayer[];
}
export interface MapInfo {
    datafile_version: number;
    groups: LayerGroup[];
    game_layer?: TileLayer;
    front_layer?: TileLayer;
    tele_layer?: TileLayer;
}
interface MapParserEvents {
    error: (...args: any[]) => void;
    parsed: (map: MapInfo) => void;
}
interface MapParserStatus {
    parsing: boolean;
    parsed: boolean;
    source: string | null;
}
/**
 * Parser for Teeworlds/DDNet .map files (DataFile v3/v4).
 * Emits 'parsed' when finished or 'error' on failure.
 */
export declare class MapParser extends EventEmitter {
    status: MapParserStatus;
    private _map;
    private error;
    /**
     * Parse a map from file path
     * @param path Path to .map file
     * @returns Parsed map information
     */
    parse_file(path: string): MapInfo;
    /**
     * Parse a map from raw Buffer
     * @param buf Raw .map file contents
     * @returns Parsed map information
     */
    parse_buffer(buf: Buffer): MapInfo;
    /**
     * Last successfully parsed map (or null)
     */
    get map(): MapInfo | null;
    /**
     * Get tile from game layer at coordinates
     * @param x Tile X
     * @param y Tile Y
     */
    get_tile(x: number, y: number): Tile | undefined;
    is_solid(tile?: Tile): boolean;
    is_nohook(tile?: Tile): boolean;
    is_freeze(tile?: Tile): boolean;
    is_dfreeze(tile?: Tile): boolean;
    is_hookthrough(tile?: Tile): boolean;
    is_death(tile?: Tile): boolean;
    is_air(tile?: Tile): boolean;
    /**
     * Human-readable name for tile ID
     * @param id Tile identifier
     */
    tile_name(id: number): string;
    private parse_datafile;
    private parse_map;
    private parse_tiles;
    private parse_tele_tiles;
    private parse_speedup_tiles;
    private parse_switch_tiles;
    private parse_tune_tiles;
    private get_data_index;
    private decode_i32_string;
    private flat_to_2d;
    on<K extends keyof MapParserEvents>(event: K, listener: MapParserEvents[K]): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once<K extends keyof MapParserEvents>(event: K, listener: MapParserEvents[K]): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    emit<K extends keyof MapParserEvents>(event: K, ...args: Parameters<MapParserEvents[K]>): boolean;
    emit(event: string | symbol, ...args: any[]): boolean;
    off<K extends keyof MapParserEvents>(event: K, listener: MapParserEvents[K]): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
}
export default MapParser;
