const fs = require('fs');
const { MapParser, MapWriter, is_tile_layer, is_quad_layer, is_sound_layer } = require('@twlibn/map');

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) {
    console.error('Usage: node mirror.js <input.map> <output.map>');
    process.exit(1);
}

const map = MapParser.parse(fs.readFileSync(input));
const W = map.game_layer.width;
const TILE_SIZE = 1 << 10;

const mirrorFlags = flags => (flags & 8) ? (flags ^ 1) : (flags ^ 2);
const mirrorTiles = tiles => tiles.map(row =>
    [...row].reverse().map(t => t ? { ...t, flags: mirrorFlags(t.flags) } : t)
);
const mirrorXfp = x => W * TILE_SIZE - x;

for (const group of map.groups) {
    group.x_offset = -group.x_offset;
    for (const layer of group.layers) {
        if (is_tile_layer(layer)) {
            if (layer.tiles)         layer.tiles         = mirrorTiles(layer.tiles);
            if (layer.tele_tiles)    layer.tele_tiles    = mirrorTiles(layer.tele_tiles);
            if (layer.speedup_tiles) layer.speedup_tiles = mirrorTiles(layer.speedup_tiles);
            if (layer.switch_tiles)  layer.switch_tiles  = mirrorTiles(layer.switch_tiles);
            if (layer.tune_tiles)    layer.tune_tiles    = mirrorTiles(layer.tune_tiles);
            if (layer.speedup_tiles)
                for (const row of layer.speedup_tiles)
                    for (const t of row)
                        if (t) t.angle = (360 - t.angle) % 360;
        } else if (is_quad_layer(layer)) {
            for (const q of layer.quads) {
                for (const p of q.points) p.x = mirrorXfp(p.x);

                const origPoints = [...q.points];
                const origColors = [...q.colors];
                const origTex = [...q.tex_coords];

                q.points[0] = origPoints[1];
                q.points[1] = origPoints[0];
                q.points[2] = origPoints[3];
                q.points[3] = origPoints[2];

                q.colors[0] = origColors[1];
                q.colors[1] = origColors[0];
                q.colors[2] = origColors[3];
                q.colors[3] = origColors[2];

                q.tex_coords[0] = origTex[1];
                q.tex_coords[1] = origTex[0];
                q.tex_coords[2] = origTex[3];
                q.tex_coords[3] = origTex[2];
            }
        } else if (is_sound_layer(layer)) {
            for (const s of layer.sources) s.x = mirrorXfp(s.x);
        }
    }
}

fs.writeFileSync(output, MapWriter.write(map));
console.log('done:', output);