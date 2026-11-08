import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, mkdir, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareFrameBundles } from './prepare-frame-bundles.mjs';

test('generated bundles preserve every WebP and use immutable content-hashed URLs', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'portfolio-frame-bundles-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = fileURLToPath(new URL('../', import.meta.url));
  await mkdir(path.join(root, 'src/features/portfolio'), { recursive: true });
  await symlink(path.join(repo, 'assets'), path.join(root, 'assets'), 'dir');
  const bundles = await prepareFrameBundles(root);
  assert.equal(bundles.length, 8);
  for (const bundle of bundles) {
    assert.equal(bundle.lengths.length, 121);
    const bytes = await readFile(path.join(root, 'public', bundle.url));
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 20);
    assert.ok(bundle.url.endsWith(`${hash}.bin`));
    assert.equal(bytes.length, bundle.lengths.reduce((a, b) => a + b, 0));
    let offset = 0;
    for (const [i, length] of bundle.lengths.entries()) {
      const original = await readFile(path.join(repo, 'assets/frames', bundle.directory, `frame_${String(i + 1).padStart(3, '0')}.webp`));
      assert.deepEqual(bytes.subarray(offset, offset + length), original);
      offset += length;
    }
    if (bundle.poster) assert.deepEqual(await readFile(path.join(root, 'public', bundle.poster)), bytes.subarray(0, bundle.lengths[0]));
  }
  assert.deepEqual(await prepareFrameBundles(root), bundles, 'identical source bytes reuse the same URLs across deployments');
  const config = JSON.parse(await readFile(path.join(repo, 'vercel.json'), 'utf8'));
  const header = config.headers.find(rule => rule.source === '/frame-assets/:path*');
  assert.ok(header.headers.some(header => header.key === 'Cache-Control' && header.value.includes('max-age=31536000, immutable')));
});
