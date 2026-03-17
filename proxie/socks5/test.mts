import * as MT from './mintest.mjs';
const [DDNET_HOST, DDNET_PORT1] = '85.215.138.194:8309'.split(':');
const DDNET_PORT = parseInt(DDNET_PORT1);
MT.testProxyLive('185.176.94.75', 41397, DDNET_HOST, DDNET_PORT).then(ok => {
    console.log(`Proxy test result: ${ok}`);
});