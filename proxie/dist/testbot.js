"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBot = createBot;
const ddbot = __importStar(require("ddbot.js-0374"));
const fs_1 = __importDefault(require("fs"));
const customTeeworlds_1 = require("./customTeeworlds");
// @ts-ignore
const reconstruct_color_1 = require("./reconstruct+color");
function createBot(options) {
    const bot = new ddbot.Bot(undefined, undefined, customTeeworlds_1.CustomTeeworlds);
    const [address, portStr] = options.server.split(':');
    const port = parseInt(portStr);
    let id = options.id ?? -1;
    let isrecord = options.mode ?? 3;
    let inputs = [];
    let tick = -1;
    function setfs(data) {
        try {
            fs_1.default.writeFileSync('test.json', JSON.stringify(data, null, 2));
        }
        catch (e) {
            console.error(e);
        }
    }
    function getfs() {
        try {
            const data = fs_1.default.readFileSync('test.json', 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return [];
        }
    }
    if (isrecord === 2) {
        inputs = getfs();
    }
    async function exit() {
        if (isrecord === 1)
            setfs(inputs);
        await bot.disconnect();
    }
    bot.on('connect', () => {
        console.log('[bot] connected');
        setInterval(() => {
            const client = bot.bot_client;
            if (!client)
                return;
            const color = (0, reconstruct_color_1.getRandomSaturatedColor)();
            try {
                client.game.ChangePlayerInfo({
                    name: "1",
                    clan: "Towa Team",
                    skin: "m_buoumao",
                    use_custom_color: 1,
                    country: 804,
                    color_body: color,
                    color_feet: color
                });
            }
            catch { }
        }, 5000);
    });
    bot.on('snapshot', () => {
        const client = bot.bot_client;
        if (!client)
            return;
        const ddnetChar = client.SnapshotUnpacker.getObjExDDNetCharacter(id);
        const char = client.SnapshotUnpacker.getObjCharacter(id);
        if (!(ddnetChar || char))
            return;
        if (isrecord === 1) {
            inputs.push({
                raw: { ddnetChar, char },
                input: (0, reconstruct_color_1.reconstructPlayerInput)(char, ddnetChar)
            });
        }
        else if (isrecord === 2) {
            tick++;
            const input = inputs[tick]?.input;
            if (!input) {
                exit();
                return;
            }
            client.movement.input = { ...input };
        }
        else if (isrecord === 3) {
            client.movement.input = {
                ...(0, reconstruct_color_1.reconstructPlayerInput)(char, ddnetChar)
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
        setID(newid) {
            id = newid;
        },
        setMode(mode) {
            isrecord = mode;
            if (mode === 2) {
                inputs = getfs();
                tick = -1;
            }
        }
    };
}
