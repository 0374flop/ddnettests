// Run: node check_crc.js Linear.map
// Computes CRC the same way DDNet does (simple unsigned byte sum)
// and prints what MAP_CHANGE should report.

const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error('Usage: node check_crc.js <mapfile>'); process.exit(1); }

const data = fs.readFileSync(file);
let crc = 0;
for (let i = 0; i < data.length; i++) crc = (crc + data[i]) >>> 0;

console.log(`File: ${file}`);
console.log(`Size: ${data.length} bytes`);
console.log(`CRC (unsigned byte sum): 0x${crc.toString(16).toUpperCase()} (${crc})`);
console.log(`First 16 bytes: ${[...data.slice(0,16)].map(b=>b.toString(16).padStart(2,'0')).join(' ')}`);
console.log(`Last  16 bytes: ${[...data.slice(-16)].map(b=>b.toString(16).padStart(2,'0')).join(' ')}`);

// Also check if there's a downloadedmaps version to compare
const path = require('path');
const base = path.basename(file, '.map');
const downloadedPath = `downloadedmaps/${base}_${crc.toString(16).padStart(8,'0')}.map`;
console.log(`\nExpected downloaded file: ${downloadedPath}`);
if (fs.existsSync(downloadedPath)) {
    const downloaded = fs.readFileSync(downloadedPath);
    let crc2 = 0;
    for (let i = 0; i < downloaded.length; i++) crc2 = (crc2 + downloaded[i]) >>> 0;
    console.log(`Downloaded file CRC: 0x${crc2.toString(16).toUpperCase()}`);
    console.log(`Size match: ${data.length === downloaded.length}`);
    // Find first differing byte
    const minLen = Math.min(data.length, downloaded.length);
    let firstDiff = -1;
    for (let i = 0; i < minLen; i++) {
        if (data[i] !== downloaded[i]) { firstDiff = i; break; }
    }
    if (firstDiff === -1) console.log('Files are IDENTICAL');
    else console.log(`First differing byte at offset ${firstDiff} (chunk ${Math.floor(firstDiff/512)}): original=0x${data[firstDiff].toString(16)} downloaded=0x${downloaded[firstDiff].toString(16)}`);
} else {
    console.log('Downloaded file not found (run from server directory)');
}
