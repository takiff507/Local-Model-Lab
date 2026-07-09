import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = process.cwd();
const sourcePath = path.join(root, 'branding', 'logo-source.png');
const masterPath = path.join(root, 'branding', 'logo-master.png');

const source = sharp(sourcePath).ensureAlpha();
const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });

for (let index = 0; index < data.length; index += 4) {
  const luminance = Math.max(data[index], data[index + 1], data[index + 2]);
  if (luminance <= 18) {
    data[index + 3] = 0;
  } else if (luminance < 58) {
    data[index + 3] = Math.round(((luminance - 18) / 40) * data[index + 3]);
  }
}

const trimmed = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
  .png()
  .toBuffer();

const master = await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{
    input: await sharp(trimmed).resize(850, 850, { fit: 'inside' }).png().toBuffer(),
    gravity: 'center',
  }])
  .png()
  .toBuffer();

await fs.mkdir(path.join(root, 'build', 'appx'), { recursive: true });
await fs.writeFile(masterPath, master);
await fs.writeFile(path.join(root, 'public', 'logo.png'), master);
await fs.writeFile(path.join(root, 'website', 'assets', 'logo.png'), master);

const renderSquare = (size) => sharp(master).resize(size, size, { fit: 'contain' }).png().toBuffer();
const faviconSizes = await Promise.all([16, 32, 48].map(renderSquare));
await fs.writeFile(path.join(root, 'website', 'assets', 'favicon.ico'), await pngToIco(faviconSizes));
await fs.writeFile(path.join(root, 'public', 'favicon.ico'), await pngToIco(faviconSizes));

const electronSizes = await Promise.all([16, 24, 32, 48, 64, 128, 256].map(renderSquare));
await fs.writeFile(path.join(root, 'build', 'icon.ico'), await pngToIco(electronSizes));

const appxAssets = {
  'Square44x44Logo.png': [44, 44],
  'Square71x71Logo.png': [71, 71],
  'Square150x150Logo.png': [150, 150],
  'Square310x310Logo.png': [310, 310],
  'StoreLogo.png': [50, 50],
};

for (const [filename, [width, height]] of Object.entries(appxAssets)) {
  await fs.writeFile(
    path.join(root, 'build', 'appx', filename),
    await sharp(master).resize(width, height, { fit: 'contain' }).png().toBuffer(),
  );
}

await fs.writeFile(
  path.join(root, 'build', 'appx', 'Wide310x150Logo.png'),
  await sharp({
    create: {
      width: 310,
      height: 150,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: await sharp(master).resize(138, 138, { fit: 'contain' }).png().toBuffer(),
      gravity: 'center',
    }])
    .png()
    .toBuffer(),
);

console.log('Generated transparent Local Model Lab brand assets.');
