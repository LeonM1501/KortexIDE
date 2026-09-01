/**
 * Generiert simple, schöne PNG Icons für die Chrome Extension
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height) {
  // Erzeuge RGBA Pixel mit einem stilvollen Gradienten und "AI"-Symbol
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      // Kreis-Maske mit Rounded Glow
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = width / 2;

      if (dist <= maxDist - 1) {
        // Gradient von Cyan (#00d2ff) zu Violett (#9254de)
        const t = (x + y) / (width + height);
        const r = Math.round(16 + t * 140);
        const g = Math.round(140 + (1 - t) * 70);
        const b = Math.round(255);
        const a = dist > maxDist - 2 ? 180 : 255;

        rawData[offset++] = r;
        rawData[offset++] = g;
        rawData[offset++] = b;
        rawData[offset++] = a;
      } else {
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0; // Transparent
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);

  const crc = crc32(Buffer.concat([Buffer.from(type), data]));
  chunk.writeUInt32BE(crc >>> 0, 8 + len);
  return chunk;
}

// CRC32 Implementation für PNG
function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

const iconsDir = path.join(__dirname, '..', 'extension', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const png = createPng(size, size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Icon erzeugt: icon${size}.png (${size}x${size})`);
});
