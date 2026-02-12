const ddmaster = require('ddmaster');

async function getActiveeuServers(data) {

    const result = data.servers
        .filter(server => {
            if (server.community !== 'ddnet') return false;
            const loc = (server.location || '').toLowerCase();

            const isEs = loc.startsWith('eu:');
            if (!isEs) return false;

            const players = server.info?.clients?.length || 0;
            if (players < 2) return false;

            const map = (server.info?.map?.name || '').toLowerCase();
            if (map !=='linear') return false;

            return true;
        })
        .map(server => {
            const addr = server.addresses.find(a => a.startsWith('tw-0.7')) || server.addresses[0];

            const parts = addr.split('://');
            if (parts.length === 2) return parts[1];
            return addr.replace(/^[^/]+:\/\/*/, '');
        });

    return result;
}

module.exports = { getActiveeuServers };

if (require.main === module) {
    (async () => {
        const servers = await ddmaster.getrawDDNetServers();
        const res = await getActiveeuServers(servers);
        console.log(JSON.stringify(res, null, 2));
    })();
}
