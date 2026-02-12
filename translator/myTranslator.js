const { main, getBotname } = require('./echo-bot.js');
const ddmaster = require('ddmaster');
const { bot } = require('ddbot.js-0374');

const nameman = '0374_bober';

async function start() {
    bot.removeBot(getBotname());
    const servers = await ddmaster.findDDNetPlayerByName(nameman);
    const serverAddresses = await ddmaster.getDDNetServers(servers);
    if (serverAddresses.length === 0) {
        console.log(`Игрок ${nameman} не найден на серверах ДДНета.`);
    } else {
        console.log(`Игрок ${nameman} найден на серверах:`, serverAddresses);
        main(serverAddresses[0], 'TranslatorBot');
    }
}

start();
setInterval(async () => {
    await start();
}, 300000);