const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const width = 256;
const height = 256;
const outputPath = path.join(__dirname, '../src/assets/background-patterns/soft-noise.png');
const raw = Buffer.alloc(height * (1 + width * 4));
let state = 0x6d2b79f5;

function randomByte() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state >>> 24;
}

for (let y = 0; y < height; y++) {
  const row = y * (1 + width * 4);
  raw[row] = 0;

  for (let x = 0; x < width; x++) {
    const index = row + 1 + x * 4;
    const value = 96 + randomByte() % 64;
    raw[index] = value;
    raw[index + 1] = value;
    raw[index + 2] = value;
    raw[index + 3] = 255;
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', header),
  pngChunk('IDAT', zlib.deflateSync(raw)),
  pngChunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync(outputPath, png);
