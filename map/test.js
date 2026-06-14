const fs = require('fs');
const { MapParser, is_quad_layer } = require('@twlibn/map');

const orig = MapParser.parse(fs.readFileSync('Linear.map'));
const mirr = MapParser.parse(fs.readFileSync('Linear_m.map'));

fs.writeFileSync('log.txt', '');
const log = (...args) => fs.appendFileSync('log.txt', args.join(' ') + '\n');

let qi = 0;
for (const group of orig.groups) {
    for (const layer of group.layers) {
        if (!is_quad_layer(layer)) continue;
        for (let i = 0; i < layer.quads.length; i++) {
            const q = layer.quads[i];
            const mq = mirr.groups[orig.groups.indexOf(group)]
                ?.layers.filter(is_quad_layer)[
                    group.layers.filter(is_quad_layer).indexOf(layer)
                ]?.quads[i];

            log(`quad #${qi} layer="${layer.name}"`);
            log('  orig points:', q.points.map(p => `(${p.x},${p.y})`).join(' '));
            log('  mirr points:', mq?.points.map(p => `(${p.x},${p.y})`).join(' '));
            log('  orig tex:', q.tex_coords.map(t => `(${t.x},${t.y})`).join(' '));
            log('  mirr tex:', mq?.tex_coords.map(t => `(${t.x},${t.y})`).join(' '));
            qi++;
            //if (qi >= 20) process.exit(0);
        }
    }
}