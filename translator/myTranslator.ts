import { main } from './translator-bot';
import * as ddmaster from 'ddmaster';
import * as ddbot from 'ddbot.js-0374';

const PLAYER_NAME = '0374_bober';
const INTERVAL_MS = 300_000; // 5 минут

let currentBot: ddbot.Bot | null = null;

async function start(): Promise<void> {
    if (currentBot) {
        currentBot.destroy(); // destroy сам отключает и чистит все listeners включая Reconnect
        currentBot = null;
    }

    const servers = await ddmaster.findDDNetPlayerByName(PLAYER_NAME);
    const serverAddresses = await ddmaster.getDDNetServers({ servers });

    if (serverAddresses.length === 0) {
        console.log(`Игрок ${PLAYER_NAME} не найден на серверах ДДНета.`);
        return;
    }

    console.log(`Игрок ${PLAYER_NAME} найден на серверах:`, serverAddresses);
    currentBot = await main(serverAddresses[0]!, 'TranslatorBot');
}

start();
setInterval(start, INTERVAL_MS);