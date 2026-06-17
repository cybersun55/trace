import sharp from 'sharp';
import toIco from 'to-ico';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const outDir = path.join(__dirname, '..', 'public');
const tauriIconDir = path.join(rootDir, 'src-tauri', 'icons');
const sourcePath = path.join(outDir, 'icon-source.png');
const iconsetDir = path.join(tauriIconDir, 'Trace.iconset');
const run = promisify(execFile);

const roundedCornerRatio = 0.23;

const publicIcons = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['favicon.png', 32],
  ['apple-touch-icon.png', 180],
];

const tauriPngIcons = [
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['256x256.png', 256],
  ['icon.png', 512],
  ['Square30x30Logo.png', 30],
  ['Square44x44Logo.png', 44],
  ['Square71x71Logo.png', 71],
  ['Square89x89Logo.png', 89],
  ['Square107x107Logo.png', 107],
  ['Square142x142Logo.png', 142],
  ['Square150x150Logo.png', 150],
  ['Square284x284Logo.png', 284],
  ['Square310x310Logo.png', 310],
  ['StoreLogo.png', 50],
];

const iconsetIcons = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

const icoSizes = [16, 24, 32, 48, 64, 128, 256];

let sourceBuffer;

function roundedMask(size) {
  const radius = Math.round(size * roundedCornerRatio);
  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/>
    </svg>
  `);
}

function roundedIcon(size) {
  return sharp(sourceBuffer)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: roundedMask(size), blend: 'dest-in' }])
    .png();
}

async function writePngSet(baseDir, icons) {
  for (const [fileName, size] of icons) {
    await roundedIcon(size).toFile(path.join(baseDir, fileName));
    console.log(`  Generated ${path.relative(rootDir, path.join(baseDir, fileName))}`);
  }
}

async function writeIcns() {
  await fs.rm(iconsetDir, { recursive: true, force: true });
  await fs.mkdir(iconsetDir, { recursive: true });
  await writePngSet(iconsetDir, iconsetIcons);
  await run('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(tauriIconDir, 'icon.icns')]);
  await fs.rm(iconsetDir, { recursive: true, force: true });
  console.log('  Generated src-tauri/icons/icon.icns');
}

async function writeIco() {
  const pngBuffers = await Promise.all(
    icoSizes.map((size) => roundedIcon(size).toBuffer()),
  );
  await fs.writeFile(path.join(tauriIconDir, 'icon.ico'), await toIco(pngBuffers));
  console.log('  Generated src-tauri/icons/icon.ico');
}

async function main() {
  sourceBuffer = await fs.readFile(sourcePath);
  await writePngSet(outDir, publicIcons);
  await writePngSet(tauriIconDir, tauriPngIcons);
  await writeIcns();
  await writeIco();
}

main().catch((err) => { console.error(err); process.exit(1); });
