import * as ddbot from '../../../ddbot.js/lib/index.js';
import { CustomTeeworlds, proxyDisconnect } from "./customTeeworlds.mts"
const bot = new ddbot.Bot(undefined, undefined, CustomTeeworlds);
(async () => {

bot.on('connect', () => {
    console.log('Бот подключился к серверу!');
});

bot.on('disconnect', () => {
    console.log('Бот отключился от сервера!');
});

await bot.connect('26.230.124.233', 8303, 100000);

})();

process.on('SIGINT', async () => {
    await bot.disconnect();
    if (typeof proxyDisconnect === 'function') {
        await proxyDisconnect();
    }
    process.exit();
});