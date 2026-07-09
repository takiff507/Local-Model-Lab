import { readFile } from 'node:fs/promises';
import process from 'node:process';

const files = ['src/modelsData.ts', 'electron-main.ts'];
const urls = new Set();
for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/https:\/\/[^'"\s]+/g)) {
    const url = match[0];
    if (url.includes('/resolve/') || url.includes('/releases/download/')) urls.add(url);
  }
}

const failures = [];
for (const url of urls) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(45_000) });
    const size = response.headers.get('content-length') || response.headers.get('x-linked-size') || 'unknown';
    const status = response.ok ? 'OK' : 'FAIL';
    console.log(`${status} ${response.status} ${size} ${url}`);
    if (!response.ok) failures.push(`${response.status} ${url}`);
  } catch (error) {
    console.error(`FAIL ERROR ${url}\n  ${error.message}`);
    failures.push(`ERROR ${url}`);
  }
}

console.log(`\nChecked ${urls.size} downloadable files.`);
if (failures.length) {
  console.error(`${failures.length} link(s) failed:\n${failures.join('\n')}`);
  process.exit(1);
}