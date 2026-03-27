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
exports.bot = void 0;
exports.changeID = changeID;
const ddbot = __importStar(require("ddbot.js-0374"));
const fs_1 = __importDefault(require("fs"));
const customTeeworlds_1 = require("./customTeeworlds");
const reconstruct_color_1 = require("./reconstruct+color");
const bot = new ddbot.Bot(undefined, undefined, customTeeworlds_1.CustomTeeworlds);
exports.bot = bot;
const server = '45.141.57.22:8352';
const [address, port] = server.split(':');
let id = -1;
/**
 * 1 - запись,
 * 2 - проигрываем,
 * 3 - повторяем.
 */
const isrecord = 3;
function setfs(data) {
    console.log('setfs');
    try {
        fs_1.default.writeFileSync('test.json', JSON.stringify(data, null, 2));
    }
    catch (e) {
        console.error(e);
    }
}
function getfs() {
    console.log('getfs');
    try {
        return fs_1.default.readFileSync('test.json', 'utf-8');
    }
    catch (e) {
        console.error(e);
    }
}
async function exit() {
    if (isrecord === 1)
        setfs(inputs);
    await bot.disconnect();
    setTimeout(() => process.exit(), 1000);
}
let inputs = [];
if (isrecord === 2)
    inputs = JSON.parse(getfs() || '[]');
let tick = -1;
bot.on('connect', () => {
    console.log('connected');
    setInterval(() => {
        const color = (0, reconstruct_color_1.getRandomSaturatedColor)();
        bot.bot_client.game.ChangePlayerInfo({
            name: "1",
            clan: "Towa Team",
            skin: "m_buoumao",
            use_custom_color: 1,
            country: 804,
            color_body: color,
            color_feet: color
        });
    }, 5000);
});
bot.on('snapshot', () => {
    const ddnetChar = bot.bot_client.SnapshotUnpacker.getObjExDDNetCharacter(id);
    const char = bot.bot_client.SnapshotUnpacker.getObjCharacter(id);
    if (!(ddnetChar || char))
        return;
    if (isrecord === 1) {
        inputs.push({
            raw: {
                ddnetChar,
                char
            },
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
        bot.bot_client.movement.input = {
            ...input
        };
    }
    else if (isrecord === 3) {
        bot.bot_client.movement.input = {
            ...(0, reconstruct_color_1.reconstructPlayerInput)(char, ddnetChar)
        };
    }
});
process.on('SIGINT', async () => {
    await exit();
});
process.stdin.on('data', (data) => {
    id = Number(data.toString().trim());
    console.log(id);
});
function changeID(newid) {
    id = newid;
}
(async () => {
    await bot.connect(address, parseInt(port), 100000);
})();
