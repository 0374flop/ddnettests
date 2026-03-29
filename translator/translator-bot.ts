import * as ddbot from 'ddbot.js-0374';
import { franc } from 'franc';
import { getActiveeuServers } from './eu';
import { translateText, ensureServer, gracefulShutdown } from './translate';
import * as ddmaster from 'ddmaster';

const activeBots: ddbot.Bot[] = [];

export async function main(addrr: string, nameBot: string = 'TranslatorBot'): Promise<ddbot.Bot> {
    const [ip, portStr] = addrr.split(':');
    const port = parseInt(portStr);

    const identity = ddbot.DDUtils.DefaultIdentity(nameBot);
    identity.clan = '';
    identity.skin = 'aowuwu';
    identity.use_custom_color = 1;
    identity.color_body = 16711680;
    identity.color_feet = 16711680;
    identity.country = 804;

    const bot = new ddbot.Bot(identity);
    activeBots.push(bot);

    // Модуль чата
    const chat = new ddbot.StandardModules.Chat(bot);
    chat.start();

    // Модуль реконнекта
    const reconnect = new ddbot.StandardModules.Reconnect(bot);
    reconnect.start(-1, true);

    bot.on('connect', () => {
        console.log(`${nameBot} connected to ${addrr}`);

        setTimeout(() => {
            chat.send('Ку всем');
        }, 1251);
    });

    bot.on('disconnect', (reason: string | null) => {
        console.log(`${nameBot} disconnected from ${addrr}: ${reason}`);
    });

    // Антиспам
    let timemsg = 0;

    chat.on('chat', (msg: unknown, autormsg: string, text: string, team: number, client_id: number) => {
        console.log(`${addrr} ${nameBot} ${client_id} ${team} '${autormsg}' : ${text}`);

        if (text === 'exit') return exit2();
        if (autormsg === nameBot) return;

        if (Date.now() - timemsg < 3000) return;
        timemsg = Date.now();

        const messageToTranslate = text.trim();
        if (!messageToTranslate) return;

        const detectedLang = franc(messageToTranslate, { minLength: 3, only: ['rus', 'eng'] })

        if (detectedLang === 'rus') {
            translateText(messageToTranslate, 'ru', 'en')
                .then((translated: string) => chat.send(`${autormsg}: ${translated}`))
                .catch((e) => console.log('translate error:', e));
        } else if (detectedLang !== 'und') {
            translateText(messageToTranslate, 'en', 'ru')
                .then((translated: string) => chat.send(`${autormsg}: ${translated}`))
                .catch((e) => console.log('translate error:', e));
        }
    });

    async function exit2(): Promise<void> {
        console.log(`${nameBot} shutting down...`);
        await bot.disconnect();
    }

    await bot.connect(ip, port, 20000);
    return bot;
}

async function exit1(): Promise<void> {
    console.log('Shutting down all bots...');
    await Promise.all(activeBots.map(b => b.disconnect()));
    await gracefulShutdown();
    process.exit(0);
}

process.on('SIGINT', exit1);
/*
(async () => {
    await ensureServer();
    const servers: string[] = await getActiveeuServers(await ddmaster.getrawDDNetServers());
    console.log(`Found ${servers.length} active ddnet linear servers.`);
    for (const addrr of servers) {
        console.log(`Starting bot on server ${addrr}`);
        setTimeout(() => {
            main(addrr, 'TranslatorBot');
        }, 1000);
    }
})();
*/