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
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const ddbot = __importStar(require("ddbot.js-0374"));
const franc_1 = require("franc");
const translate_1 = require("./translate");
const ddmaster = __importStar(require("ddmaster"));
const rumas2 = __importStar(require("rumas2"));
const Cteeworlds = rumas2.createCustomTeeworlds('wss://kit-touched-commonly.ngrok-free.app');
const activeBots = [];
async function main(addrr, nameBot = 'TranslatorBot') {
    const [ip, portStr] = addrr.split(':');
    const port = parseInt(portStr);
    const identity = ddbot.DDUtils.DefaultIdentity(nameBot);
    identity.clan = '';
    identity.skin = 'aowuwu';
    identity.use_custom_color = 1;
    identity.color_body = 16711680;
    identity.color_feet = 16711680;
    identity.country = 804;
    const bot = new ddbot.Bot(identity, undefined); //, Cteeworlds);
    activeBots.push(bot);
    // Модуль чата
    const chat = new ddbot.StandardModules.Chat(bot);
    chat.start();
    // Модуль реконнекта
    const reconnect = new ddbot.StandardModules.Reconnect(bot);
    reconnect.start(-1, true);
    bot.on('connect', () => {
        console.log(`${nameBot} connected to ${addrr}`);
        //setTimeout(() => {
        //chat.send('Ку всем');
        //}, 1251);
    });
    bot.on('disconnect', (reason) => {
        console.log(`${nameBot} disconnected from ${addrr}: ${reason}`);
    });
    // Антиспам
    let timemsg = 0;
    chat.on('chat', (msg, autormsg, text, team, client_id) => {
        console.log(`${addrr} ${nameBot} ${client_id} ${team} '${autormsg}' : ${text}`);
        if (text === 'exit')
            return exit2();
        if (autormsg === nameBot)
            return;
        if (Date.now() - timemsg < 3000)
            return;
        timemsg = Date.now();
        const messageToTranslate = text.trim();
        if (!messageToTranslate)
            return;
        const detectedLang = (0, franc_1.franc)(messageToTranslate, { minLength: 3, only: ['rus', 'eng'] });
        if (detectedLang === 'rus') {
            (0, translate_1.translateText)(messageToTranslate, 'ru', 'en')
                .then((translated) => chat.send(`${autormsg}: ${translated}`))
                .catch((e) => console.log('translate error:', e));
        }
        else if (detectedLang !== 'und') {
            (0, translate_1.translateText)(messageToTranslate, 'en', 'ru')
                .then((translated) => chat.send(`${autormsg}: ${translated}`))
                .catch((e) => console.log('translate error:', e));
        }
    });
    async function exit2() {
        console.log(`${nameBot} shutting down...`);
        await bot.disconnect();
    }
    await bot.connect(ip, port, 20000).catch((e) => {
        console.log(`${nameBot} failed to connect to ${addrr}:`, e.message);
    });
    return bot;
}
async function exit1() {
    console.log('Shutting down all bots...');
    await Promise.all(activeBots.map(b => b.disconnect()));
    await (0, translate_1.gracefulShutdown)();
    process.exit(0);
}
process.on('SIGINT', exit1);
///*
(async () => {
    await (0, translate_1.ensureServer)();
    const servers = await ddmaster.getDDNetServers(); //await getActiveeuServers(await ddmaster.getrawDDNetServers());
    console.log(`Found ${servers.length} active ddnet linear servers.`);
    for (const addrr of servers) {
        console.log(`Starting bot on server ${addrr}`);
        setTimeout(() => {
            main(addrr, 'TranslatorBot').catch((e) => console.log(`${addrr}:`, e.message));
        }, 1000);
    }
})();
//*/
