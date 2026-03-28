import * as ddbot from 'ddbot.js-0374';
import fs from 'fs';
import { CustomTeeworlds } from './customTeeworlds';
// @ts-ignore
import { reconstructPlayerInput, getRandomSaturatedColor } from './reconstruct+color';

export type Mode = 1 | 2 | 3;

export type CreateBotOptions = {
    server: string;
    id?: number;
    mode?: Mode;
};

export type InputRecord = {
    raw: {
        ddnetChar: any;
        char: any;
    };
    input: any;
};

export type createBotout = {
    bot: ddbot.Bot;
    start(): Promise<void>;
    stop(): Promise<void>;
    setID(newid: number): void;
    setMode(mode: Mode): void;
}

export function createBot(options: CreateBotOptions): createBotout {
    const bot = new ddbot.Bot(undefined, undefined, CustomTeeworlds);

    const [address, portStr] = options.server.split(':');
    const port = parseInt(portStr);

    let id: number = options.id ?? -1;
    let isrecord: number = options.mode ?? 3;

    let inputs: InputRecord[] = [];
    let tick = -1;

    function setfs(data: InputRecord[]) {
        try {
            fs.writeFileSync('test.json', JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(e);
        }
    }

    function getfs(): InputRecord[] {
        try {
            const data = fs.readFileSync('test.json', 'utf-8');
            return JSON.parse(data);
        } catch {
            return [];
        }
    }

    if (isrecord === 2) {
        inputs = getfs();
    }

    async function exit() {
        if (isrecord === 1) setfs(inputs);
        await bot.disconnect();
    }

    bot.on('connect', () => {
        console.log('[bot] connected');

        setInterval(() => {
            const client = bot.bot_client;
            if (!client) return;

            const color = getRandomSaturatedColor();

            try { client.game.ChangePlayerInfo({
                name: "1",
                clan: "Towa Team",
                skin: "m_buoumao",
                use_custom_color: 1,
                country: 804,
                color_body: color,
                color_feet: color
            }); } catch {}
        }, 5000);
    });

    bot.on('snapshot', () => {
        const client = bot.bot_client;
        if (!client) return;

        const ddnetChar = client.SnapshotUnpacker.getObjExDDNetCharacter(id);
        const char = client.SnapshotUnpacker.getObjCharacter(id);

        if (!(ddnetChar || char)) return;

        if (isrecord === 1) {
            inputs.push({
                raw: { ddnetChar, char },
                input: reconstructPlayerInput(char, ddnetChar)
            });
        } else if (isrecord === 2) {
            tick++;
            const input = inputs[tick]?.input;

            if (!input) {
                exit();
                return;
            }

            client.movement.input = { ...input };
        } else if (isrecord === 3) {
            client.movement.input = {
                ...reconstructPlayerInput(char, ddnetChar)
            };
        }
    });

    return {
        bot,

        async start() {
            await bot.connect(address, port, 100000);
        },

        async stop() {
            await exit();
        },

        setID(newid: number) {
            id = newid;
        },

        setMode(mode: Mode) {
            isrecord = mode;
            if (mode === 2) {
                inputs = getfs();
                tick = -1;
            }
        }
    };
}