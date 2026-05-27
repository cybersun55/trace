import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
const outDir = path.join(__dirname, '..', 'public');

async function main() {
  for (const size of [192, 512]) {
    await sharp(svgPath).resize(size, size).png().toFile(path.join(outDir, `icon-${size}.png`));
    console.log(`  Generated icon-${size}.png`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
