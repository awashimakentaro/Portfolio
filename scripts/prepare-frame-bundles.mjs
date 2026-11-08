import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const groups = ['idle', 'one', 'two', 'three', 'loop-1', 'loop-2', 'loop-3', 'loop-4'];
const digest = data => createHash('sha256').update(data).digest('hex').slice(0, 20);

/** Package the original WebP bytes without resizing, re-encoding or reordering. */
export async function prepareFrameBundles(root) {
  const target = path.join(root, 'public/frame-assets');
  await mkdir(target, { recursive: true });
  const bundles = [], keep = new Set();
  for (const directory of groups) {
    const frames = [];
    for (let n = 1; n <= 121; n++) {
      const file = path.join(root, 'assets/frames', directory, `frame_${String(n).padStart(3, '0')}.webp`);
      const bytes = await readFile(file);
      if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw Error(`Invalid WebP: ${file}`);
      frames.push(bytes);
    }
    const bytes = Buffer.concat(frames);
    const name = `${directory}-${digest(bytes)}.bin`;
    await writeFile(path.join(target, name), bytes); keep.add(name);
    const entry = { directory, url: `/frame-assets/${name}`, lengths: frames.map(frame => frame.length) };
    if (directory.startsWith('loop-')) {
      const poster = `${directory}-poster-${digest(frames[0])}.webp`;
      await writeFile(path.join(target, poster), frames[0]); keep.add(poster);
      entry.poster = `/frame-assets/${poster}`;
    }
    bundles.push(entry);
  }
  // Only this generated directory is pruned; the source frames remain untouched.
  for (const name of await readdir(target)) if (!keep.has(name)) await rm(path.join(target, name));
  await writeFile(path.join(root, 'src/features/portfolio/frame-manifest.generated.json'), JSON.stringify(bundles, null, 2) + '\n');
  return bundles;
}
