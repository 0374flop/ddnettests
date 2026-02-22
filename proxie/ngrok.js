const ngrokmodule = require('@ngrok/ngrok');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const ngroktokenpath = path.join(__dirname, 'ngrok.token');
const ngrokdata = fs.readFileSync(ngroktokenpath, { encoding: 'utf-8' }).split(' ');

class ngrok extends EventEmitter {
    constructor(port, authtoken = ngrokdata[0], domain = ngrokdata[1], server) {
        super();
        this.urlhttp = '';
        this.urlws = '';
        server.listen(port, async () => {
            console.log(`HTTP сервер запущен на порту ${port}, http://localhost:${port}`);


            const listener = await ngrokmodule.connect({
                addr: port,
                authtoken,
                domain
            });

            this.urlhttp = listener.url();
            this.urlws = this.urlhttp.replace('https://', 'wss://').replace('http://', 'ws://');
            
            this.emit('ready', { http: this.urlhttp, ws: this.urlws });
        });
    }

    get url() {
        return [this.urlhttp, this.urlws]
    }
}

module.exports = {
    ngrok
}