const teeworlds = require('teeworlds');
const fs = require('fs');

const server = '45.141.57.22:8352'
const [ adrr, port ] = server.split(':')

const client = new teeworlds.Client(adrr, port, '1', {
    identity: {
        name: "1",
        clan: "Towa Team",
        skin: "Astolfofinho",
        use_custom_color: 1,
        color_body: 16711680,
        color_feet: 16711680,
        country: 804
    }
});
const { reconstructPlayerInput, getRandomSaturatedColor } = require('./reconstruct+color');

let id = -1;

/**
 * 1 - запись,
 * 2 - проигрываем,
 * 3 - повторяем.
 */
const isrecord = 3;

function setfs(data) {
    console.log('setfs')
    try{
        fs.writeFileSync('test.json', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(error);
    }
}

function getfs(){
    console.log('getfs');
    try {
        return fs.readFileSync('test.json', 'utf-8');
    } catch (error) {
        console.error(error);
    }
}

async function exit() {
    if (isrecord === 1) setfs(inputs);
    client.Disconnect()
    setTimeout(() => process.exit(), 1000)
}

let inputs = [];
if (isrecord === 2) inputs = JSON.parse(getfs())

client.connect();
client.on('connected', () => {
    console.log('connected');
    let tick = -1;
    let colorInterval = setInterval(() => {
        const color = getRandomSaturatedColor();
        
        client.game.ChangePlayerInfo({
            name: "1",
            clan: "Towa Team",
            skin: "m_buoumao",
            use_custom_color: 1,
            country: 804,
            color_body: color,
            color_feet: color
        });
    }, 5000);

    client.on('snapshot', async () => {
        const ddnetChar = client.SnapshotUnpacker.getObjExDDNetCharacter(id);
        const char = client.SnapshotUnpacker.getObjCharacter(id);
        if (!(ddnetChar || char)) {
            // console.log(char? true : false, 'char');
            // console.log(ddnetChar? true : false, 'ddnetChar')
            return;
        }

        if (isrecord === 1) {
            inputs.push({
                raw: {
                    ddnetChar,
                    char
                },
                input: reconstructPlayerInput(char, ddnetChar)
            });
        } else if (isrecord === 2) {
            tick++;
            const input = inputs[tick]?.input
            if (!input) {
                await exit();
                return;
            }
            client.movement.input = {
                ...input
            }
        } else if (isrecord === 3) {
            client.movement.input = {
                ...reconstructPlayerInput(char, ddnetChar)
            }
        }
    });
});

process.on('SIGINT', async () => {
    await exit()
});

process.stdin.on('data', (data) => {
    id = Number(data.toString().trim());
    console.log(id);
});

function changeID(newid) {
    id = newid
}

module.exports = {
    client,
    changeID
}