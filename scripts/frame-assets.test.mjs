import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = await readFile(new URL('../src/features/portfolio/frame-assets.ts', import.meta.url), 'utf8');
const code = stripTypeScriptTypes(source, { mode: 'transform' });
const { FrameAssets } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('stalled response headers and bodies time out, retry, then reject', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  for (const stage of ['headers', 'body']) {
    let attempts = 0;
    globalThis.fetch = async (_url, { signal }) => {
      attempts++;
      const stalled = () => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      if (stage === 'headers') return stalled();
      return { ok: true, blob: stalled };
    };
    const assets = new FrameAssets(15);
    await assert.rejects(assets.load(new AbortController().signal, () => {}, true), /timed out/);
    assert.ok(attempts >= 5, 'failed requests are retried');
    assets.dispose();
  }
});

test('successful reduced loading retains four URLs and dispose revokes them', async t => {
  const original = globalThis.fetch;
  const originalRevoke = URL.revokeObjectURL;
  const revoked = [];
  t.after(() => { globalThis.fetch = original; URL.revokeObjectURL = originalRevoke; });
  globalThis.fetch = async () => new Response(new Blob(['image'], { type: 'image/webp' }));
  URL.revokeObjectURL = url => { revoked.push(url); originalRevoke(url); };
  const assets = new FrameAssets(100);
  const updates = [];
  await assets.load(new AbortController().signal, (loaded, total) => updates.push([loaded, total]), true);
  assert.deepEqual(updates.at(-1), [4, 4]);
  assert.match(assets.get('loop-1', 1), /^blob:/);
  assets.dispose(); assets.dispose();
  assert.equal(revoked.length, 4);
  assert.throws(() => assets.get('loop-1', 1));
});
