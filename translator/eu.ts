interface DDNetServer {
    community: string;
    location?: string;
    addresses: string[];
    info?: {
        clients?: unknown[];
        map?: { name?: string };
    };
}

export async function getActiveeuServers(data: { servers: DDNetServer[] } | null): Promise<string[]> {
    if (!data) return [];

    return data.servers
        .filter(server => {
            if (server.community !== 'ddnet') return false;

            const loc = (server.location || '').toLowerCase();
            if (!loc.startsWith('eu:')) return false;

            const players = server.info?.clients?.length || 0;
            if (players < 2) return false;

            const map = (server.info?.map?.name || '').toLowerCase();
            if (map !== 'linear') return false;

            return true;
        })
        .map(server => {
            const addr = server.addresses.find((a: string) => a.startsWith('tw-0.7')) || server.addresses[0];
            const parts = addr.split('://');
            if (parts.length === 2) return parts[1];
            return addr.replace(/^[^/]+:\/\/*/, '');
        });
}