import * as ddbot from '../../../ddbot.js/lib/index.js';
import { CustomTeeworlds, proxyDisconnect } from "./customTeeworlds.mts"
const bot = new ddbot.Bot(undefined, undefined, CustomTeeworlds);
const chat = new ddbot.StandardModules.Chat(bot);
(async () => {

bot.on('connect', () => {
    console.log('Бот подключился к серверу!');
});

bot.on('disconnect', () => {
    console.log('Бот отключился от сервера!');
});
const [address, port] = '45.141.57.22:8380'.split(':');
await bot.connect(address, parseInt(port), 100000);
chat.start();

chat.on('chat', (msgraw, autormsg, text, team, client_id) => {
    console.log(`${client_id}: ${autormsg}: ${text}`);
});

})();

process.on('SIGINT', async () => {
    await bot.disconnect();
    if (typeof proxyDisconnect === 'function') {
        await proxyDisconnect();
    }
    process.exit();
});