const http = require('http');
const fs = require('fs');
const path = require('path');

class ControleBot {
    constructor(client) {
        if (typeof client !== 'object') {
            if (typeof client == 'function') {
                this.input = client;
            } else {
                throw new Error('Клиент не объект, или функция');
            }
        }
        this.client = client;
        this.server = undefined;
    }

    /**
     * Отправляет input боту.
     * @param {object} input
     */
    sendInput(input) {
        if (this.input) {
            this.input(input);
        } else if (this.client.movement.input) this.client.movement.input = { ...input };
    }

    StartServer(port = 3000) {
        this.server = http.createServer((req, res) => {
            if (req.method === 'GET' && req.url === '/') {
                const html = fs.readFileSync(
                    path.join(__dirname, 'index.html'),
                    'utf8'
                );
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
                return;
            }

            if (req.method === 'POST' && req.url === '/input') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const input = JSON.parse(body);
                        this.sendInput(input);
                        res.writeHead(200);
                        res.end('ok');
                    } catch (e) {
                        res.writeHead(400);
                        res.end('bad input');
                    }
                });
                return;
            }

            res.writeHead(404);
            res.end();
        });

        this.server.listen(port, () => {
            console.log(`http://localhost:${port}`);
        });
    }

    StopServer() {
        if (!this.server) return;
        this.server.close();
        this.server.removeAllListeners();
        this.server = null;
    }
}

module.exports = ControleBot;

/*
const ddjson = require('./ddjson')
ddjson.changeID(-1)

const test = new ControleBot(ddjson.client);

test.StartServer(1214);
*/