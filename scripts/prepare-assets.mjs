import { prepareBooks } from './prepare-books.mjs';
import { prepareFrameBundles } from './prepare-frame-bundles.mjs';
import { cp, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = new URL('../assets/frames/', import.meta.url);
const target = new URL('../public/frames/', import.meta.url);
const groups = ['idle', 'one', 'two', 'three', 'loop-1', 'loop-2', 'loop-3', 'loop-4'];
for (const group of groups) {
  const entries = await readdir(new URL(`${group}/`, source));
  for (let n = 1; n <= 121; n++) {
    if (!entries.includes(`frame_${String(n).padStart(3, '0')}.webp`)) throw new Error(`Missing frame: ${group}/${n}`);
  }
}
await mkdir(target, { recursive: true });
await cp(fileURLToPath(source), fileURLToPath(target), { recursive: true });
await prepareFrameBundles(fileURLToPath(new URL('../', import.meta.url)));
const books = await prepareBooks(fileURLToPath(new URL('../', import.meta.url)));
console.log(`Prepared 8 sequences (968 WebP frames) and ${books.length} published books.`);
