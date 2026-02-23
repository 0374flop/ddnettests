import * as ddbot from '../../../ddbot.js/lib/index.js';
import { CustomTeeworlds } from "./customTeeworlds.mts"
const bot = new ddbot.Bot(undefined, undefined, CustomTeeworlds);
const chat = new ddbot.StandardModules.Chat(bot);
(async () => {

chat.on('chat', (msgraw, autormsg, text, team, client_id) => {
    console.log(`${client_id}: ${autormsg}: ${text}`);
});
chat.start();

bot.on('connect', () => {
    console.log('Бот подключился к серверу!');
});

bot.on('disconnect', () => {
    console.log('Бот отключился от сервера!');
});
const [address, port] = '45.141.57.22:8380'.split(':');
await bot.connect(address, parseInt(port), 100000);

})();

process.on('SIGINT', async () => {
    await bot.disconnect();
    process.exit();
});