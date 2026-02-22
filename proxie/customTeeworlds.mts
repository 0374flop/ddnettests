import * as Teeworlds from 'teeworlds';
import { createProxiedClient } from './botPatch.mts';

let proxyDisconnect: (() => void) | null = null;

const CustomTeeworlds: typeof Teeworlds = {
    ...Teeworlds,
    Client: class extends Teeworlds.Client {
        private _proxyDisconnect?: () => void;

        constructor(ip: string, port: number, nickname: string, options?: any) {
            super(ip, port, nickname, options);
        }

        async connect() {
            const { client, disconnect } = await createProxiedClient(
                (this as any).host,
                (this as any).port,
                (this as any).name,
                (this as any).options
            );

            this._proxyDisconnect = disconnect;
            proxyDisconnect = disconnect;
            (this as any).socket = (client as any).socket;

            return super.connect();
        }

        async Disconnect() {
            // this._proxyDisconnect?.();
            return super.Disconnect();
        }
    } as any
};

export { CustomTeeworlds, proxyDisconnect };