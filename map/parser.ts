"use strict";

import { inflateSync } from 'zlib';
import { readFileSync } from 'fs';
import { EventEmitter } from 'events';

// ============================================================================
// ENUMS
// ============================================================================

export enum TileId {
  AIR           = 0,
  SOLID         = 1,
  DEATH         = 2,
  NOHOOK        = 3,
  NOLASER       = 4,
  THROUGH_CUT   = 5,
  THROUGH       = 6,
  JUMP          = 7,
  FREEZE        = 9,
  TELEINEVIL    = 10,
  UNFREEZE      = 11,
  DFREEZE       = 12,
  DUNFREEZE     = 13,
  TELEINWEAPON  = 14,
  TELEINHOOK    = 15,
  WALLJUMP      = 16,
  EHOOK_ENABLE  = 17,
  EHOOK_DISABLE = 18,
  HIT_ENABLE    = 19,
  HIT_DISABLE   = 20,
  SOLO_ENABLE   = 21,
  SOLO_DISABLE  = 22,
}

export enum TileFlags {
  FLIP_X = 0b0001,
  FLIP_Y = 0b0010,
  OPAQUE = 0b0100,
  ROTATE = 0b1000,
}

export enum TilemapLayerType {
  TILES   = 0,
  GAME    = 1,
  TELE    = 2,
  SPEEDUP = 4,
  FRONT   = 8,
  SWITCH  = 16,
  TUNE    = 32,
}

// ============================================================================
// TILE TYPES
// ============================================================================

export interface Tile {
  id:    number;
  flags: number;
}

export interface TeleTile {
  number: number;
  id:     number;
}

export interface SpeedupTile {
  force:    number;
  max_speed: number;
  id:       number;
  angle:    number;
}

export interface SwitchTile {
  number: number;
  id:     number;
  flags:  number;
  delay:  number;
}

export interface TuneTile {
  number: number;
  id:     number;
}

// ============================================================================
// MAP TYPES
// ============================================================================

export interface TileLayer {
  width:         number;
  height:        number;
  layer_type:    TilemapLayerType;
  name:          string;
  detail:        boolean;
  tiles?:        Tile[][];
  tele_tiles?:   TeleTile[][];
  speedup_tiles?: SpeedupTile[][];
  switch_tiles?: SwitchTile[][];
  tune_tiles?:   TuneTile[][];
}

export interface LayerGroup {
  name:       string;
  x_offset:   number;
  y_offset:   number;
  x_parallax: number;
  y_parallax: number;
  clipping:   boolean;
  layers:     TileLayer[];
}

export interface MapInfo {
  datafile_version: number;
  groups:           LayerGroup[];
  game_layer?:      TileLayer;
  front_layer?:     TileLayer;
  tele_layer?:      TileLayer;
}

// ============================================================================
// EVENTS & STATUS
// ============================================================================

interface MapParserEvents {
  error:  (...args: any[]) => void;
  parsed: (map: MapInfo) => void;
}

interface MapParserStatus {
  parsing: boolean;
  parsed:  boolean;
  source:  string | null;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface ItemTypeEntry {
  type_id: number;
  start:   number;
  num:     number;
}

interface RawItem {
  type_id:   number;
  id:        number;
  item_data: number[];
}

interface ParsedDatafile {
  version:    number;
  items:      Map<number, RawItem[]>;
  data_items: Buffer[];
}

// ============================================================================
// ITEM TYPE IDS
// ============================================================================

const ITEM_TYPE_GROUPS = 4;
const ITEM_TYPE_LAYERS = 5;

/**
 * Parser for Teeworlds/DDNet .map files (DataFile v3/v4).
 * Emits 'parsed' when finished or 'error' on failure.
 */
export class MapParser extends EventEmitter {

  public status: MapParserStatus = {
    parsing: false,
    parsed:  false,
    source:  null,
  };

  private _map: MapInfo | null = null;

  private error(...err: any[]): void {
    this.emit('error', ...err);
  }

  /**
   * Parse a map from file path
   * @param path Path to .map file
   * @returns Parsed map information
   */
  public parse_file(path: string): MapInfo {
    const buf = readFileSync(path);
    this.status.source = path;
    return this.parse_buffer(buf);
  }

  /**
   * Parse a map from raw Buffer
   * @param buf Raw .map file contents
   * @returns Parsed map information
   */
  public parse_buffer(buf: Buffer): MapInfo {
    if (this.status.parsing) {
      throw new Error('Already parsing');
    }

    this.status.parsing = true;
    this.status.parsed  = false;
    this._map           = null;

    try {
      const df  = this.parse_datafile(buf);
      const map = this.parse_map(df);

      this._map          = map;
      this.status.parsed = true;
      this.emit('parsed', map);
      return map;
    } catch (e) {
      this.error('Failed to parse map:', e);
      throw e;
    } finally {
      this.status.parsing = false;
    }
  }

  /**
   * Last successfully parsed map (or null)
   */
  public get map(): MapInfo | null {
    return this._map;
  }

  /**
   * Get tile from game layer at coordinates
   * @param x Tile X
   * @param y Tile Y
   */
  public get_tile(x: number, y: number): Tile | undefined {
    return this._map?.game_layer?.tiles?.[y]?.[x];
  }

  public is_solid(tile?: Tile): boolean {
    return tile?.id === TileId.SOLID;
  }

  public is_nohook(tile?: Tile): boolean {
    return tile?.id === TileId.NOHOOK || tile?.id === TileId.THROUGH_CUT;
  }

  public is_freeze(tile?: Tile): boolean {
    return tile?.id === TileId.FREEZE;
  }

  public is_dfreeze(tile?: Tile): boolean {
    return tile?.id === TileId.DFREEZE;
  }

  public is_hookthrough(tile?: Tile): boolean {
    return tile?.id === TileId.THROUGH || tile?.id === TileId.THROUGH_CUT;
  }

  public is_death(tile?: Tile): boolean {
    return tile?.id === TileId.DEATH;
  }

  public is_air(tile?: Tile): boolean {
    return !tile || tile.id === TileId.AIR;
  }

  /**
   * Human-readable name for tile ID
   * @param id Tile identifier
   */
  public tile_name(id: number): string {
    return TILE_NAMES[id] ?? `unknown(${id})`;
  }

  private parse_datafile(buf: Buffer): ParsedDatafile {
    let pos = 0;
    const r32 = () => { const v = buf.readInt32LE(pos); pos += 4; return v; };

    const magic = buf.slice(0, 4).toString('ascii');
    if (magic !== 'DATA' && magic !== 'ATAD') {
      throw new Error(`Invalid map magic: "${magic}"`);
    }
    pos += 4;

    const version = r32();
    if (version !== 3 && version !== 4) {
      throw new Error(`Unsupported datafile version: ${version}`);
    }

    r32(); // size
    r32(); // swap_len

    const num_item_types  = r32();
    const num_items       = r32();
    const num_data        = r32();
    const item_block_size = r32();
    const data_block_size = r32();

    const item_types: ItemTypeEntry[] = [];
    for (let i = 0; i < num_item_types; i++) {
      item_types.push({ type_id: r32(), start: r32(), num: r32() });
    }

    const item_offsets: number[] = [];
    for (let i = 0; i < num_items; i++) item_offsets.push(r32());

    const data_offsets: number[] = [];
    for (let i = 0; i < num_data; i++) data_offsets.push(r32());

    if (version === 4) {
      for (let i = 0; i < num_data; i++) r32(); // data_sizes
    }

    const items_start = pos;
    const items_by_type = new Map<number, RawItem[]>();

    for (const it of item_types) {
      const arr: RawItem[] = [];
      for (let i = 0; i < it.num; i++) {
        const off     = items_start + item_offsets[it.start + i];
        const id      = buf.readUInt16LE(off);
        const type_id = buf.readUInt16LE(off + 2);
        const size    = buf.readInt32LE(off + 4);
        const n_i32   = size / 4;

        const item_data: number[] = [];
        for (let j = 0; j < n_i32; j++) {
          item_data.push(buf.readInt32LE(off + 8 + j * 4));
        }

        arr.push({ type_id, id, item_data });
      }
      items_by_type.set(it.type_id, arr);
    }

    const data_start = items_start + item_block_size;
    const raw_data   = buf.slice(data_start, data_start + data_block_size);
    const data_items: Buffer[] = [];

    for (let i = 0; i < num_data; i++) {
      const off      = data_offsets[i];
      const next_off = i + 1 < num_data ? data_offsets[i + 1] : data_block_size;
      const chunk    = raw_data.slice(off, next_off);

      try {
        data_items.push(inflateSync(chunk));
      } catch {
        data_items.push(chunk);
      }
    }

    return { version, items: items_by_type, data_items };
  }

  private parse_map(df: ParsedDatafile): MapInfo {
    const result: MapInfo = {
      datafile_version: df.version,
      groups: [],
    };

    const group_items = df.items.get(ITEM_TYPE_GROUPS) ?? [];
    const layer_items = df.items.get(ITEM_TYPE_LAYERS) ?? [];

    for (const group_item of group_items) {
      const d = group_item.item_data;
      if (d.length < 7) continue;

      const group_version = d[0];
      const start_layer   = d[5];
      const num_layers    = d[6];
      const clipping      = group_version >= 2 && d.length >= 8 ? d[7] !== 0 : false;
      const name          = group_version >= 3 && d.length >= 15
        ? this.decode_i32_string([d[12], d[13], d[14]])
        : '';

      const group: LayerGroup = {
        name,
        x_offset:   d[1],
        y_offset:   d[2],
        x_parallax: d[3],
        y_parallax: d[4],
        clipping,
        layers: [],
      };

      for (let li = start_layer; li < start_layer + num_layers; li++) {
        const layer_item = layer_items[li];
        if (!layer_item) continue;

        const ld = layer_item.item_data;
        if (ld.length < 7) continue;
        if (ld[1] !== 2) continue;

        const layer_type: TilemapLayerType = ld[6];
        if (![0, 1, 2, 4, 8, 16, 32].includes(layer_type)) continue;

        const tilemap_version = ld[3];
        const detail = (ld[2] & 1) !== 0;
        const width  = ld[4];
        const height = ld[5];

        const layer_name = tilemap_version >= 3 && ld.length >= 18
          ? this.decode_i32_string([ld[15], ld[16], ld[17]])
          : '';

        const data_idx = this.get_data_index(layer_type, tilemap_version);
        if (ld.length <= data_idx) continue;

        const raw_idx = ld[data_idx];
        if (raw_idx < 0 || raw_idx >= df.data_items.length) continue;

        const raw_buf = df.data_items[raw_idx];
        if (!raw_buf) continue;

        const compressed =
          (layer_type === TilemapLayerType.GAME || layer_type === TilemapLayerType.TILES) &&
          tilemap_version >= 4;

        const tile_layer: TileLayer = {
          width,
          height,
          layer_type,
          name: layer_name,
          detail,
        };

        switch (layer_type) {
          case TilemapLayerType.GAME:
          case TilemapLayerType.FRONT:
          case TilemapLayerType.TILES:
            tile_layer.tiles = this.parse_tiles(raw_buf, width, height, compressed);
            break;
          case TilemapLayerType.TELE:
            tile_layer.tele_tiles = this.parse_tele_tiles(raw_buf, width, height);
            break;
          case TilemapLayerType.SPEEDUP:
            tile_layer.speedup_tiles = this.parse_speedup_tiles(raw_buf, width, height);
            break;
          case TilemapLayerType.SWITCH:
            tile_layer.switch_tiles = this.parse_switch_tiles(raw_buf, width, height);
            break;
          case TilemapLayerType.TUNE:
            tile_layer.tune_tiles = this.parse_tune_tiles(raw_buf, width, height);
            break;
        }

        group.layers.push(tile_layer);

        if (layer_type === TilemapLayerType.GAME  && !result.game_layer)  result.game_layer  = tile_layer;
        if (layer_type === TilemapLayerType.FRONT  && !result.front_layer) result.front_layer = tile_layer;
        if (layer_type === TilemapLayerType.TELE   && !result.tele_layer)  result.tele_layer  = tile_layer;
      }

      result.groups.push(group);
    }

    return result;
  }

  // ============================================================================
  // TILE PARSERS
  // ============================================================================

  private parse_tiles(buf: Buffer, width: number, height: number, compressed: boolean): Tile[][] {
    const total = width * height;
    const flat: Tile[] = [];

    if (compressed) {
      let p = 0;
      while (flat.length < total && p + 4 <= buf.length) {
        const id    = buf.readUInt8(p);
        const flags = buf.readUInt8(p + 1);
        const skip  = buf.readUInt8(p + 2);
        p += 4;
        for (let s = 0; s <= skip && flat.length < total; s++) {
          flat.push({ id, flags });
        }
      }
    } else {
      for (let i = 0; i + 4 <= buf.length && flat.length < total; i += 4) {
        flat.push({ id: buf.readUInt8(i), flags: buf.readUInt8(i + 1) });
      }
    }

    return this.flat_to_2d(flat, width, height);
  }

  private parse_tele_tiles(buf: Buffer, width: number, height: number): TeleTile[][] {
    const flat: TeleTile[] = [];
    for (let i = 0; i + 2 <= buf.length && flat.length < width * height; i += 2) {
      flat.push({ number: buf.readUInt8(i), id: buf.readUInt8(i + 1) });
    }
    return this.flat_to_2d(flat, width, height);
  }

  private parse_speedup_tiles(buf: Buffer, width: number, height: number): SpeedupTile[][] {
    const total    = width * height;
    const byte_per = total > 0 ? Math.floor(buf.length / total) : 6;
    const flat: SpeedupTile[] = [];

    for (let n = 0; n < total; n++) {
      const i = n * byte_per;
      flat.push({
        force:     buf.readUInt8(i),
        max_speed: byte_per >= 2 ? buf.readUInt8(i + 1) : 0,
        id:        byte_per >= 3 ? buf.readUInt8(i + 2) : 0,
        angle:     byte_per >= 6 ? buf.readInt16LE(i + 4) : 0,
      });
    }

    return this.flat_to_2d(flat, width, height);
  }

  private parse_switch_tiles(buf: Buffer, width: number, height: number): SwitchTile[][] {
    const total    = width * height;
    const byte_per = total > 0 ? Math.floor(buf.length / total) : 4;
    const flat: SwitchTile[] = [];

    for (let n = 0; n < total; n++) {
      const i = n * byte_per;
      flat.push({
        number: buf.readUInt8(i),
        id:     byte_per >= 2 ? buf.readUInt8(i + 1) : 0,
        flags:  byte_per >= 3 ? buf.readUInt8(i + 2) : 0,
        delay:  byte_per >= 4 ? buf.readUInt8(i + 3) : 0,
      });
    }

    return this.flat_to_2d(flat, width, height);
  }

  private parse_tune_tiles(buf: Buffer, width: number, height: number): TuneTile[][] {
    const flat: TuneTile[] = [];
    for (let i = 0; i + 2 <= buf.length && flat.length < width * height; i += 2) {
      flat.push({ number: buf.readUInt8(i), id: buf.readUInt8(i + 1) });
    }
    return this.flat_to_2d(flat, width, height);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private get_data_index(layer_type: TilemapLayerType, tilemap_version: number): number {
    let idx: number;
    switch (layer_type) {
      case TilemapLayerType.GAME:
      case TilemapLayerType.TILES:  idx = 14; break;
      case TilemapLayerType.TELE:   idx = 18; break;
      case TilemapLayerType.SPEEDUP:idx = 19; break;
      case TilemapLayerType.FRONT:  idx = 20; break;
      case TilemapLayerType.SWITCH: idx = 21; break;
      case TilemapLayerType.TUNE:   idx = 22; break;
      default: return 14;
    }
    if (tilemap_version < 3 && idx > 14) idx -= 3;
    return idx;
  }

  private decode_i32_string(ints: number[]): string {
    const bytes: number[] = [];
    for (const v of ints) {
      bytes.push((v >>> 24) & 0xff);
      bytes.push((v >>> 16) & 0xff);
      bytes.push((v >>>  8) & 0xff);
      bytes.push( v         & 0xff);
    }
    if (bytes.every(b => b === 0)) return '';
    bytes.pop();
    for (let i = 0; i < bytes.length; i++) bytes[i] = (bytes[i] + 128) & 0xff;
    while (bytes.length > 0 && bytes[bytes.length - 1] === 0) bytes.pop();
    return Buffer.from(bytes).toString('utf8');
  }

  private flat_to_2d<T>(flat: T[], width: number, height: number): T[][] {
    const result: T[][] = [];
    for (let y = 0; y < height; y++) {
      result.push(flat.slice(y * width, y * width + width));
    }
    return result;
  }

  // Event emitter overloads (typed)

  public on<K extends keyof MapParserEvents>(event: K, listener: MapParserEvents[K]): this;
  public on(event: string | symbol, listener: (...args: any[]) => void): this;
  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  public once<K extends keyof MapParserEvents>(event: K, listener: MapParserEvents[K]): this;
  public once(event: string | symbol, listener: (...args: any[]) => void): this;
  public once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  public emit<K extends keyof MapParserEvents>(event: K, ...args: Parameters<MapParserEvents[K]>): boolean;
  public emit(event: string | symbol, ...args: any[]): boolean;
  public emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  public off<K extends keyof MapParserEvents>(event: K, listener: MapParserEvents[K]): this;
  public off(event: string | symbol, listener: (...args: any[]) => void): this;
  public off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }
}

// ============================================================================
// TILE NAME MAP
// ============================================================================

const TILE_NAMES: Record<number, string> = {
  0:  'air',
  1:  'solid (hookable)',
  2:  'death',
  3:  'nohook',
  4:  'nolaser',
  5:  'through_cut (nohook + hookthrough)',
  6:  'through (hookthrough)',
  7:  'jump',
  9:  'freeze',
  10: 'tele_in_evil',
  11: 'unfreeze',
  12: 'deep_freeze',
  13: 'deep_unfreeze',
  14: 'tele_in_weapon',
  15: 'tele_in_hook',
  16: 'walljump',
  17: 'ehook_enable',
  18: 'ehook_disable',
  19: 'hit_enable',
  20: 'hit_disable',
  21: 'solo_enable',
  22: 'solo_disable',
};

export default MapParser;