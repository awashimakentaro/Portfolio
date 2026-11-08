import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = await readFile(new URL('../src/features/portfolio/frame-assets.ts', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../src/features/portfolio/frame-manifest.generated.json', import.meta.url), 'utf8'));
const code = stripTypeScriptTypes(source.replace("import bundles from './frame-manifest.generated.json';", `const bundles = ${JSON.stringify(manifest)};`), { mode: 'transform' });
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
  const paths = [];
  globalThis.fetch = async url => {
    paths.push(url);
    const bundle = manifest.find(bundle => bundle.poster === url);
    assert.ok(bundle, 'reduced motion downloads only the four content-hashed posters');
    const first = await readFile(new URL(`../assets/frames/${bundle.directory}/frame_001.webp`, import.meta.url));
    return new Response(first, { headers: { 'Content-Type': 'image/webp' } });
  };
  URL.revokeObjectURL = url => { revoked.push(url); originalRevoke(url); };
  const assets = new FrameAssets(100);
  const updates = [];
  await assets.load(new AbortController().signal, (loaded, total) => updates.push([loaded, total]), true);
  assert.deepEqual(updates.at(-1), [4, 4]);
  assert.equal(paths.length, 4);
  assert.match(assets.get('loop-1', 1), /^blob:/);
  assets.dispose(); assets.dispose();
  assert.equal(revoked.length, 4);
  assert.throws(() => assets.get('loop-1', 1));
});

test('eight bundles restore all 968 original frames byte-for-byte with monotonic progress', async t => {
  const original = globalThis.fetch;
  const originalRevoke = URL.revokeObjectURL;
  const revoked = [];
  t.after(() => { globalThis.fetch = original; URL.revokeObjectURL = originalRevoke; });
  const paths = [];
  globalThis.fetch = async url => {
    paths.push(url);
    const bundle = manifest.find(bundle => bundle.url === url);
    assert.ok(bundle);
    const parts = await Promise.all(bundle.lengths.map((_, n) => readFile(new URL(`../assets/frames/${bundle.directory}/frame_${String(n + 1).padStart(3, '0')}.webp`, import.meta.url))));
    return new Response(Buffer.concat(parts));
  };
  URL.revokeObjectURL = url => { revoked.push(url); originalRevoke(url); };
  const assets = new FrameAssets();
  const updates = [];
  await assets.load(new AbortController().signal, (loaded, total) => updates.push([loaded, total]));
  assert.equal(paths.length, 8);
  assert.equal(new Set(paths).size, 8);
  assert.deepEqual(updates.at(-1), [968, 968]);
  assert.ok(updates.every(([loaded, total], i) => total === 968 && (i === 0 || loaded >= updates[i - 1][0])));
  for (const bundle of manifest) for (let n = 1; n <= 121; n++) {
    const blob = await original(assets.get(bundle.directory, n));
    assert.equal(blob.headers.get('content-type'), 'image/webp');
    const actual = Buffer.from(await blob.arrayBuffer());
    const expected = await readFile(new URL(`../assets/frames/${bundle.directory}/frame_${String(n).padStart(3, '0')}.webp`, import.meta.url));
    assert.deepEqual(actual, expected, `${bundle.directory}/${n}`);
  }
  assets.dispose(); assets.dispose();
  assert.equal(revoked.length, 968);
});

test('truncated bundles retry once, reject, and never report ready', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = new Map(), updates = [];
  globalThis.fetch = async url => {
    calls.set(url, (calls.get(url) ?? 0) + 1);
    return new Response(new Uint8Array([1, 2, 3]));
  };
  const assets = new FrameAssets();
  await assert.rejects(assets.load(new AbortController().signal, (loaded, total) => updates.push([loaded, total]), true), /bundle size/);
  assert.ok([...calls.values()].some(count => count === 2));
  assert.ok(updates.every(([loaded, total]) => loaded < total));
  assert.throws(() => assets.get('loop-1', 1));
});

test('a broken response stream retries successfully without progress going backwards', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = new Map(), updates = [];
  globalThis.fetch = async url => {
    const count = (calls.get(url) ?? 0) + 1;
    calls.set(url, count);
    const bundle = manifest.find(bundle => bundle.poster === url);
    const bytes = await readFile(new URL(`../assets/frames/${bundle.directory}/frame_001.webp`, import.meta.url));
    if (bundle.directory === 'loop-1' && count === 1) {
      let first = true;
      return new Response(new ReadableStream({ pull(controller) {
        if (first) { first = false; controller.enqueue(bytes.subarray(0, bytes.length / 2)); }
        else controller.error(new Error('Broken connection'));
      } }));
    }
    return new Response(bytes);
  };
  const assets = new FrameAssets();
  await assets.load(new AbortController().signal, (loaded, total) => updates.push([loaded, total]), true);
  assert.equal(calls.get(manifest.find(bundle => bundle.directory === 'loop-1').poster), 2);
  assert.deepEqual(updates.at(-1), [4, 4]);
  assert.ok(updates.every(([loaded], i) => i === 0 || loaded >= updates[i - 1][0]));
  assets.dispose();
});

test('cancelling a streaming bundle aborts outstanding requests and releases completed frames', async t => {
  const original = globalThis.fetch;
  const originalRevoke = URL.revokeObjectURL;
  const revoked = [], signals = [], updates = [];
  const controller = new AbortController();
  t.after(() => { globalThis.fetch = original; URL.revokeObjectURL = originalRevoke; });
  URL.revokeObjectURL = url => { revoked.push(url); originalRevoke(url); };
  globalThis.fetch = async (url, { signal }) => {
    const bundle = manifest.find(bundle => bundle.poster === url);
    if (bundle.directory === 'loop-1') return new Response(await readFile(new URL('../assets/frames/loop-1/frame_001.webp', import.meta.url)));
    signals.push(signal);
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  };
  const assets = new FrameAssets();
  const loading = assets.load(controller.signal, (loaded, total) => updates.push([loaded, total]), true);
  // Wait for the completed poster to be retained before cancelling the other requests.
  for (let i = 0; i < 100; i++) {
    try { assets.get('loop-1', 1); break; } catch { await new Promise(resolve => setTimeout(resolve, 1)); }
  }
  assert.match(assets.get('loop-1', 1), /^blob:/);
  controller.abort();
  await assert.rejects(loading);
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(revoked.length, 1);
  assert.ok(updates.every(([loaded, total]) => loaded < total));
});
