const { getActiveeuServers } = require('./eu.js'); // ну калище
const { franc } = require('franc');
const { bot, botClassAndLoger } = require('ddbot.js-0374'); // мой мусор
const DebugLogger = require('Loger0374')
const { translateText, ensureServer, stopServer, gracefulShutdown } = require('./translate.js'); // мусор которы писал ИИ потому что я не знаю питон
const botdebug = botClassAndLoger.logDebuger;
// botdebug.setDebugMode(true, true, true); тута можно включить полные логи

const logDebuger = new DebugLogger('bot', true, true, null, true);

var botName2;

async function main(addrr, nameBot = 'Meow') {

    const identitybot = {
        name: nameBot,
        clan: "",
        skin: "aowuwu",
        use_custom_color: 1,
        color_body: 16711680,
        color_feet: 16711680,
        country: 804
    };

    const botName = await bot.createBot(addrr, nameBot, {
        identity: identitybot,
        reconnect: true,
        reconnectAttempts: -1,
        randreconnect: true
    });
    botName2 = botName;

    bot.connectBot(botName); // подкюлчаем

    const botClient = bot.getBotClient(botName);

    // Подписка на событие подключения
    bot.on(`${botName}:connect`, () => {
        let timemsg = 0; // время

        setTimeout(() => {
            botClient.game.Say('Ку всем');
        }, 1251);

        setInterval(() => {
            botClient.movement.Fire();
        }, 150);

        // подписка на чат
        bot.on(`${botName}:ChatNoSystem`, (msgraw, autormsg, text, team, client_id) => {
            logDebuger.logDebug(`${addrr} ${botName} ${client_id} ${team} '${autormsg}' : ${text}`);

            if (text == 'exit') return exit2();
            if (autormsg === nameBot) return;

            if (Date.now() - timemsg < 3000) return; // антиспам
            timemsg = Date.now();
            let messageToTranslate = text.trim();

            // Если ничего не осталось — выходим
            if (!messageToTranslate) return;

            // Определяем язык
            const detectedLang = franc(messageToTranslate, { minLength: 3, whitelist: ['rus', 'eng'] });

            if (detectedLang === 'rus') {
                translateText(messageToTranslate, 'ru', 'en')
                    .then(translated => botClient.game.Say(`${autormsg}: ${translated}`))
                    .catch(() => {});
            } else if (detectedLang !== 'und') { // всё что не русский и не undefined
                translateText(messageToTranslate, 'en', 'ru')
                        .then(translated => botClient.game.Say(`${autormsg}: ${translated}`))
                        .catch(() => {});
            }
        });
    });

    // Выход
    async function exit2() {
        logDebuger.logDebug('Shutting down...');
        await bot.disconnectBot(botName); // отключаем
    }
}

function getBotname() {
    return botName2;
}

const emitter = require('events');
if (require.main === module) {
    const time1 = 1000;
    (async () => {
        await ensureServer();
        const servers = await getActiveeuServers();
        emitter.setMaxListeners(servers.length * 6);
        logDebuger.logDebug(`Found ${servers.length} active ddnet linear servers.`);
        servers.forEach(addrr => {
            logDebuger.logDebug(`Starting bot on server ${addrr}`);
            setTimeout(() => {
                main(addrr, 'TranslatorBot');
            }, time1);
        });
    })();
} else {
    module.exports = { main, getBotname };
}

async function exit1() {
    logDebuger.logDebug('Shutting down...');
    await bot.disconnectAllBots(); // отключаем всех ботов
    await gracefulShutdown(); // убиваем переводчик
    process.exit(0); // завершаем процес
}
process.on('SIGINT', exit1); // Ctrl+C