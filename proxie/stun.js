const { WebSocketServer } = require('ws');
const http = require('http');
const { ngrok } = require('./ngrok.js');

const server = http.createServer();
const wss = new WebSocketServer({ server });
const peers = new Map();

wss.on('connection', (ws) => {
    let myId = null;

    ws.on('message', (data) => {
        const msg = JSON.parse(data);

        if (msg.type === 'register') {
            myId = msg.id;
            peers.set(myId, ws);
            console.log(`[+] ${myId} подключился`);
            ws.send(JSON.stringify({ type: 'registered' }));
        }

        if (msg.type === 'signal') {
            const target = peers.get(msg.to);
            if (target) {
                target.send(JSON.stringify({
                    type: 'signal',
                    from: myId,
                    data: msg.data
                }));
            }
        }
    });

    ws.on('close', () => {
        if (myId) {
            peers.delete(myId);
            console.log(`[-] ${myId} отключился`);
        }
    });
});

const tunnel = new ngrok(8080, undefined, undefined, server);

tunnel.on('ready', ({ http, ws }) => {
    console.log(`\nСигналинг доступен на: ${ws}`);
});