import sharp from 'sharp';

const iconPaths = [
  'public/icon-192.png',
  'public/icon-512.png',
  'public/favicon.png',
  'public/apple-touch-icon.png',
  'src-tauri/icons/32x32.png',
  'src-tauri/icons/128x128.png',
  'src-tauri/icons/128x128@2x.png',
  'src-tauri/icons/256x256.png',
  'src-tauri/icons/icon.png',
];

const sampleInsetRatio = 0.04;
const maxOpaqueAlpha = 8;

async function cornerSamples(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const inset = Math.max(0, Math.floor(Math.min(info.width, info.height) * sampleInsetRatio));
  const coords = [
    [inset, inset],
    [info.width - 1 - inset, inset],
    [inset, info.height - 1 - inset],
    [info.width - 1 - inset, info.height - 1 - inset],
  ];

  return coords.map(([x, y]) => {
    const offset = (y * info.width + x) * info.channels;
    return { x, y, alpha: data[offset + 3] };
  });
}

async function main() {
  const failures = [];

  for (const filePath of iconPaths) {
    const samples = await cornerSamples(filePath);
    const opaqueSamples = samples.filter((sample) => sample.alpha > maxOpaqueAlpha);

    if (opaqueSamples.length > 0) {
      failures.push({ filePath, opaqueSamples });
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      const sampleText = failure.opaqueSamples
        .map((sample) => `(${sample.x},${sample.y}) alpha=${sample.alpha}`)
        .join(', ');
      console.error(`${failure.filePath} has opaque corner pixels: ${sampleText}`);
    }
    process.exit(1);
  }

  console.log(`Verified ${iconPaths.length} icons have transparent corners.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
