import { createBot } from "./testbot";
import type { createBotout } from "./testbot";

let count: number = 7;
let botmap: Map<number, createBotout> = new Map();

for (let i = 1; i <= count; i++) {
    const bot = createBot({
        server: '45.141.57.22:8380',
        mode: 3
    });
    bot.bot.on('error', () => {
        botmap.forEach((bot) => {
            bot.stop();
        });
        setTimeout(() => process.exit(), 1000);
    })

    bot.start();
    botmap.set(i, bot);
}

process.stdin.on('data', (data) => {
    const text = data.toString().trim();
    const newID = Number(text);

    botmap.forEach((bot) => {
        bot.setID(newID);
    });
});

process.on('SIGINT', () => {
    botmap.forEach((bot) => {
        bot.stop();
    });

    setTimeout(() => process.exit(), 1000);
});