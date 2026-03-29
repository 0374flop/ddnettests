interface DDNetServer {
    community: string;
    location?: string;
    addresses: string[];
    info?: {
        clients?: unknown[];
        map?: {
            name?: string;
        };
    };
}
export declare function getActiveeuServers(data: {
    servers: DDNetServer[];
} | null): Promise<string[]>;
export {};
