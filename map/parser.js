"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MapParser = exports.TilemapLayerType = exports.TileFlags = exports.TileId = void 0;
const zlib_1 = require("zlib");
const fs_1 = require("fs");
const events_1 = require("events");
// ============================================================================
// ENUMS
// ============================================================================
var TileId;
(function (TileId) {
    TileId[TileId["AIR"] = 0] = "AIR";
    TileId[TileId["SOLID"] = 1] = "SOLID";
    TileId[TileId["DEATH"] = 2] = "DEATH";
    TileId[TileId["NOHOOK"] = 3] = "NOHOOK";
    TileId[TileId["NOLASER"] = 4] = "NOLASER";
    TileId[TileId["THROUGH_CUT"] = 5] = "THROUGH_CUT";
    TileId[TileId["THROUGH"] = 6] = "THROUGH";
    TileId[TileId["JUMP"] = 7] = "JUMP";
    TileId[TileId["FREEZE"] = 9] = "FREEZE";
    TileId[TileId["TELEINEVIL"] = 10] = "TELEINEVIL";
    TileId[TileId["UNFREEZE"] = 11] = "UNFREEZE";
    TileId[TileId["DFREEZE"] = 12] = "DFREEZE";
    TileId[TileId["DUNFREEZE"] = 13] = "DUNFREEZE";
    TileId[TileId["TELEINWEAPON"] = 14] = "TELEINWEAPON";
    TileId[TileId["TELEINHOOK"] = 15] = "TELEINHOOK";
    TileId[TileId["WALLJUMP"] = 16] = "WALLJUMP";
    TileId[TileId["EHOOK_ENABLE"] = 17] = "EHOOK_ENABLE";
    TileId[TileId["EHOOK_DISABLE"] = 18] = "EHOOK_DISABLE";
    TileId[TileId["HIT_ENABLE"] = 19] = "HIT_ENABLE";
    TileId[TileId["HIT_DISABLE"] = 20] = "HIT_DISABLE";
    TileId[TileId["SOLO_ENABLE"] = 21] = "SOLO_ENABLE";
    TileId[TileId["SOLO_DISABLE"] = 22] = "SOLO_DISABLE";
})(TileId || (exports.TileId = TileId = {}));
var TileFlags;
(function (TileFlags) {
    TileFlags[TileFlags["FLIP_X"] = 1] = "FLIP_X";
    TileFlags[TileFlags["FLIP_Y"] = 2] = "FLIP_Y";
    TileFlags[TileFlags["OPAQUE"] = 4] = "OPAQUE";
    TileFlags[TileFlags["ROTATE"] = 8] = "ROTATE";
})(TileFlags || (exports.TileFlags = TileFlags = {}));
var TilemapLayerType;
(function (TilemapLayerType) {
    TilemapLayerType[TilemapLayerType["TILES"] = 0] = "TILES";
    TilemapLayerType[TilemapLayerType["GAME"] = 1] = "GAME";
    TilemapLayerType[TilemapLayerType["TELE"] = 2] = "TELE";
    TilemapLayerType[TilemapLayerType["SPEEDUP"] = 4] = "SPEEDUP";
    TilemapLayerType[TilemapLayerType["FRONT"] = 8] = "FRONT";
    TilemapLayerType[TilemapLayerType["SWITCH"] = 16] = "SWITCH";
    TilemapLayerType[TilemapLayerType["TUNE"] = 32] = "TUNE";
})(TilemapLayerType || (exports.TilemapLayerType = TilemapLayerType = {}));
// ============================================================================
// ITEM TYPE IDS
// ============================================================================
const ITEM_TYPE_GROUPS = 4;
const ITEM_TYPE_LAYERS = 5;
/**
 * Parser for Teeworlds/DDNet .map files (DataFile v3/v4).
 * Emits 'parsed' when finished or 'error' on failure.
 */
class MapParser extends events_1.EventEmitter {
    status = {
        parsing: false,
        parsed: false,
        source: null,
    };
    _map = null;
    error(...err) {
        this.emit('error', ...err);
    }
    /**
     * Parse a map from file path
     * @param path Path to .map file
     * @returns Parsed map information
     */
    parse_file(path) {
        const buf = (0, fs_1.readFileSync)(path);
        this.status.source = path;
        return this.parse_buffer(buf);
    }
    /**
     * Parse a map from raw Buffer
     * @param buf Raw .map file contents
     * @returns Parsed map information
     */
    parse_buffer(buf) {
        if (this.status.parsing) {
            throw new Error('Already parsing');
        }
        this.status.parsing = true;
        this.status.parsed = false;
        this._map = null;
        try {
            const df = this.parse_datafile(buf);
            const map = this.parse_map(df);
            this._map = map;
            this.status.parsed = true;
            this.emit('parsed', map);
            return map;
        }
        catch (e) {
            this.error('Failed to parse map:', e);
            throw e;
        }
        finally {
            this.status.parsing = false;
        }
    }
    /**
     * Last successfully parsed map (or null)
     */
    get map() {
        return this._map;
    }
    /**
     * Get tile from game layer at coordinates
     * @param x Tile X
     * @param y Tile Y
     */
    get_tile(x, y) {
        return this._map?.game_layer?.tiles?.[y]?.[x];
    }
    is_solid(tile) {
        return tile?.id === TileId.SOLID;
    }
    is_nohook(tile) {
        return tile?.id === TileId.NOHOOK || tile?.id === TileId.THROUGH_CUT;
    }
    is_freeze(tile) {
        return tile?.id === TileId.FREEZE;
    }
    is_dfreeze(tile) {
        return tile?.id === TileId.DFREEZE;
    }
    is_hookthrough(tile) {
        return tile?.id === TileId.THROUGH || tile?.id === TileId.THROUGH_CUT;
    }
    is_death(tile) {
        return tile?.id === TileId.DEATH;
    }
    is_air(tile) {
        return !tile || tile.id === TileId.AIR;
    }
    /**
     * Human-readable name for tile ID
     * @param id Tile identifier
     */
    tile_name(id) {
        return TILE_NAMES[id] ?? `unknown(${id})`;
    }
    parse_datafile(buf) {
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
        const num_item_types = r32();
        const num_items = r32();
        const num_data = r32();
        const item_block_size = r32();
        const data_block_size = r32();
        const item_types = [];
        for (let i = 0; i < num_item_types; i++) {
            item_types.push({ type_id: r32(), start: r32(), num: r32() });
        }
        const item_offsets = [];
        for (let i = 0; i < num_items; i++)
            item_offsets.push(r32());
        const data_offsets = [];
        for (let i = 0; i < num_data; i++)
            data_offsets.push(r32());
        if (version === 4) {
            for (let i = 0; i < num_data; i++)
                r32(); // data_sizes
        }
        const items_start = pos;
        const items_by_type = new Map();
        for (const it of item_types) {
            const arr = [];
            for (let i = 0; i < it.num; i++) {
                const off = items_start + item_offsets[it.start + i];
                const id = buf.readUInt16LE(off);
                const type_id = buf.readUInt16LE(off + 2);
                const size = buf.readInt32LE(off + 4);
                const n_i32 = size / 4;
                const item_data = [];
                for (let j = 0; j < n_i32; j++) {
                    item_data.push(buf.readInt32LE(off + 8 + j * 4));
                }
                arr.push({ type_id, id, item_data });
            }
            items_by_type.set(it.type_id, arr);
        }
        const data_start = items_start + item_block_size;
        const raw_data = buf.slice(data_start, data_start + data_block_size);
        const data_items = [];
        for (let i = 0; i < num_data; i++) {
            const off = data_offsets[i];
            const next_off = i + 1 < num_data ? data_offsets[i + 1] : data_block_size;
            const chunk = raw_data.slice(off, next_off);
            try {
                data_items.push((0, zlib_1.inflateSync)(chunk));
            }
            catch {
                data_items.push(chunk);
            }
        }
        return { version, items: items_by_type, data_items };
    }
    parse_map(df) {
        const result = {
            datafile_version: df.version,
            groups: [],
        };
        const group_items = df.items.get(ITEM_TYPE_GROUPS) ?? [];
        const layer_items = df.items.get(ITEM_TYPE_LAYERS) ?? [];
        for (const group_item of group_items) {
            const d = group_item.item_data;
            if (d.length < 7)
                continue;
            const group_version = d[0];
            const start_layer = d[5];
            const num_layers = d[6];
            const clipping = group_version >= 2 && d.length >= 8 ? d[7] !== 0 : false;
            const name = group_version >= 3 && d.length >= 15
                ? this.decode_i32_string([d[12], d[13], d[14]])
                : '';
            const group = {
                name,
                x_offset: d[1],
                y_offset: d[2],
                x_parallax: d[3],
                y_parallax: d[4],
                clipping,
                layers: [],
            };
            for (let li = start_layer; li < start_layer + num_layers; li++) {
                const layer_item = layer_items[li];
                if (!layer_item)
                    continue;
                const ld = layer_item.item_data;
                if (ld.length < 7)
                    continue;
                if (ld[1] !== 2)
                    continue;
                const layer_type = ld[6];
                if (![0, 1, 2, 4, 8, 16, 32].includes(layer_type))
                    continue;
                const tilemap_version = ld[3];
                const detail = (ld[2] & 1) !== 0;
                const width = ld[4];
                const height = ld[5];
                const layer_name = tilemap_version >= 3 && ld.length >= 18
                    ? this.decode_i32_string([ld[15], ld[16], ld[17]])
                    : '';
                const data_idx = this.get_data_index(layer_type, tilemap_version);
                if (ld.length <= data_idx)
                    continue;
                const raw_idx = ld[data_idx];
                if (raw_idx < 0 || raw_idx >= df.data_items.length)
                    continue;
                const raw_buf = df.data_items[raw_idx];
                if (!raw_buf)
                    continue;
                const compressed = (layer_type === TilemapLayerType.GAME || layer_type === TilemapLayerType.TILES) &&
                    tilemap_version >= 4;
                const tile_layer = {
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
                if (layer_type === TilemapLayerType.GAME && !result.game_layer)
                    result.game_layer = tile_layer;
                if (layer_type === TilemapLayerType.FRONT && !result.front_layer)
                    result.front_layer = tile_layer;
                if (layer_type === TilemapLayerType.TELE && !result.tele_layer)
                    result.tele_layer = tile_layer;
            }
            result.groups.push(group);
        }
        return result;
    }
    // ============================================================================
    // TILE PARSERS
    // ============================================================================
    parse_tiles(buf, width, height, compressed) {
        const total = width * height;
        const flat = [];
        if (compressed) {
            let p = 0;
            while (flat.length < total && p + 4 <= buf.length) {
                const id = buf.readUInt8(p);
                const flags = buf.readUInt8(p + 1);
                const skip = buf.readUInt8(p + 2);
                p += 4;
                for (let s = 0; s <= skip && flat.length < total; s++) {
                    flat.push({ id, flags });
                }
            }
        }
        else {
            for (let i = 0; i + 4 <= buf.length && flat.length < total; i += 4) {
                flat.push({ id: buf.readUInt8(i), flags: buf.readUInt8(i + 1) });
            }
        }
        return this.flat_to_2d(flat, width, height);
    }
    parse_tele_tiles(buf, width, height) {
        const flat = [];
        for (let i = 0; i + 2 <= buf.length && flat.length < width * height; i += 2) {
            flat.push({ number: buf.readUInt8(i), id: buf.readUInt8(i + 1) });
        }
        return this.flat_to_2d(flat, width, height);
    }
    parse_speedup_tiles(buf, width, height) {
        const total = width * height;
        const byte_per = total > 0 ? Math.floor(buf.length / total) : 6;
        const flat = [];
        for (let n = 0; n < total; n++) {
            const i = n * byte_per;
            flat.push({
                force: buf.readUInt8(i),
                max_speed: byte_per >= 2 ? buf.readUInt8(i + 1) : 0,
                id: byte_per >= 3 ? buf.readUInt8(i + 2) : 0,
                angle: byte_per >= 6 ? buf.readInt16LE(i + 4) : 0,
            });
        }
        return this.flat_to_2d(flat, width, height);
    }
    parse_switch_tiles(buf, width, height) {
        const total = width * height;
        const byte_per = total > 0 ? Math.floor(buf.length / total) : 4;
        const flat = [];
        for (let n = 0; n < total; n++) {
            const i = n * byte_per;
            flat.push({
                number: buf.readUInt8(i),
                id: byte_per >= 2 ? buf.readUInt8(i + 1) : 0,
                flags: byte_per >= 3 ? buf.readUInt8(i + 2) : 0,
                delay: byte_per >= 4 ? buf.readUInt8(i + 3) : 0,
            });
        }
        return this.flat_to_2d(flat, width, height);
    }
    parse_tune_tiles(buf, width, height) {
        const flat = [];
        for (let i = 0; i + 2 <= buf.length && flat.length < width * height; i += 2) {
            flat.push({ number: buf.readUInt8(i), id: buf.readUInt8(i + 1) });
        }
        return this.flat_to_2d(flat, width, height);
    }
    // ============================================================================
    // HELPERS
    // ============================================================================
    get_data_index(layer_type, tilemap_version) {
        let idx;
        switch (layer_type) {
            case TilemapLayerType.GAME:
            case TilemapLayerType.TILES:
                idx = 14;
                break;
            case TilemapLayerType.TELE:
                idx = 18;
                break;
            case TilemapLayerType.SPEEDUP:
                idx = 19;
                break;
            case TilemapLayerType.FRONT:
                idx = 20;
                break;
            case TilemapLayerType.SWITCH:
                idx = 21;
                break;
            case TilemapLayerType.TUNE:
                idx = 22;
                break;
            default: return 14;
        }
        if (tilemap_version < 3 && idx > 14)
            idx -= 3;
        return idx;
    }
    decode_i32_string(ints) {
        const bytes = [];
        for (const v of ints) {
            bytes.push((v >>> 24) & 0xff);
            bytes.push((v >>> 16) & 0xff);
            bytes.push((v >>> 8) & 0xff);
            bytes.push(v & 0xff);
        }
        if (bytes.every(b => b === 0))
            return '';
        bytes.pop();
        for (let i = 0; i < bytes.length; i++)
            bytes[i] = (bytes[i] + 128) & 0xff;
        while (bytes.length > 0 && bytes[bytes.length - 1] === 0)
            bytes.pop();
        return Buffer.from(bytes).toString('utf8');
    }
    flat_to_2d(flat, width, height) {
        const result = [];
        for (let y = 0; y < height; y++) {
            result.push(flat.slice(y * width, y * width + width));
        }
        return result;
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    once(event, listener) {
        return super.once(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    off(event, listener) {
        return super.off(event, listener);
    }
}
exports.MapParser = MapParser;
// ============================================================================
// TILE NAME MAP
// ============================================================================
const TILE_NAMES = {
    0: 'air',
    1: 'solid (hookable)',
    2: 'death',
    3: 'nohook',
    4: 'nolaser',
    5: 'through_cut (nohook + hookthrough)',
    6: 'through (hookthrough)',
    7: 'jump',
    9: 'freeze',
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
exports.default = MapParser;
