import { cp, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = new URL('../scroll-preview/assets-webp/', import.meta.url);
const target = new URL('../public/frames/', import.meta.url);
const bookContentSource = new URL('../src/features/history/book/data/content/', import.meta.url);
const bookContentTarget = new URL('../public/book-content/', import.meta.url);
const groups = ['idle', 'one', 'two', 'three', 'loop-1', 'loop-2', 'loop-3', 'loop-4'];
for (const group of groups) {
  const entries = await readdir(new URL(`${group}/`, source));
  for (let n = 1; n <= 121; n++) {
    if (!entries.includes(`frame_${String(n).padStart(3, '0')}.webp`)) throw new Error(`Missing frame: ${group}/${n}`);
  }
}
await mkdir(target, { recursive: true });
await cp(fileURLToPath(source), fileURLToPath(target), { recursive: true });
const bookContent = await readdir(bookContentSource);
if (bookContent.length < 7 || bookContent.some((filename) => !filename.endsWith('.md'))) {
  throw new Error('Expected Markdown book content files, including all 7 original works.');
}
await mkdir(bookContentTarget, { recursive: true });
await cp(fileURLToPath(bookContentSource), fileURLToPath(bookContentTarget), { recursive: true });
console.log(`Prepared 8 sequences (968 WebP frames) and ${bookContent.length} Markdown book contents. Originals unchanged.`);
