const dgram = require('dgram');

const tester = dgram.createSocket('udp4');
tester.send('hello', 7, 'echo.ipv4.hetzner.com', err => {
    console.log('Echo send:', err ? 'error ' + err.message : 'sent');
});
tester.on('message', (msg, rinfo) => {
    console.log(`Echo reply! from ${rinfo.address}:${rinfo.port} → "${msg.toString()}"`);
});
tester.on('error', e => console.log('Tester error:', e.message));
setTimeout(() => tester.close(), 15000);