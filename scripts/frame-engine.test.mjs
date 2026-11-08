import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = (await readFile(new URL('../src/features/portfolio/frame-engine.ts', import.meta.url), 'utf8'))
  .replace(/^import .*from '@\/contracts\/scene';$/m, "const sceneIds = ['profile','about','history','contact'];")
  .replace(/^import .*from '\.\/frame-assets';$/m, "const framePath = (directory, frame) => `${directory}/${frame}`;");
const code = stripTypeScriptTypes(source, { mode: 'transform' });
const { FrameEngine } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

function setup(t, reduced = false, failImage = () => false) {
  const originals = Object.fromEntries(['Image', 'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, globalThis[key]]));
  const frames = new Map(), draws = [], states = [], motions = [], requested = [];
  let nextId = 0, clock = 0;
  const context = { fillRect() {}, save() {}, restore() {}, translate() {}, scale() {}, drawImage(image) { draws.push(image.src ?? 'capture'); } };
  const canvas = { width: 1280, height: 720, clientWidth: 1280, clientHeight: 720, getContext: () => context };
  globalThis.Image = class { naturalWidth = 1280; naturalHeight = 720; decode() { return failImage(this.src) ? Promise.reject(new Error('decode failed')) : Promise.resolve(); } };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.document = { createElement: () => ({ ...canvas }) };
  globalThis.requestAnimationFrame = callback => { const id = ++nextId; frames.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const engine = new FrameEngine(canvas, { get: (group, frame) => { requested.push(`${group}/${frame}`); return `${group}/${frame}`; } }, state => states.push({ ...state }), motion => motions.push({ ...motion }), reduced);
  t.after(() => { engine.dispose(); for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  async function tick() {
    await Promise.resolve(); clock += 34;
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(clock);
    await Promise.resolve();
  }
  return { engine, draws, states, motions, requested, tick };
}

test('initial Profile and a playing destination can both be interrupted by forward movement', async t => {
  const { engine, tick, motions } = setup(t);
  assert.equal(engine.move(1), 'busy');
  await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'profile', phase: 'playing' });
  assert.equal(engine.move(1), 'accepted');
  await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'about', phase: 'playing' });
  assert.equal(motions.at(-1).progress, 0);
  assert.equal(engine.move(1), 'accepted');
  await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'history', phase: 'playing' });
  assert.equal(motions.at(-1).progress, 0);
});

test('backward moves jump to destination loops without reverse transition clips', async t => {
  const { engine, tick, draws, motions } = setup(t);
  await tick(); engine.navigate('contact'); await tick();
  for (const [scene, loop] of [['history', 'loop-3/1'], ['about', 'loop-2/1'], ['profile', 'loop-1/1']]) {
    draws.length = 0;
    assert.equal(engine.move(-1), 'accepted');
    await tick();
    assert.deepEqual(engine.getSnapshot(), { scene, phase: 'loop' });
    assert.ok(draws.includes(loop));
    assert.ok(draws.every(image => image === loop || image === 'capture'));
    assert.equal(motions.at(-1).direction, -1);
  }
  assert.equal(engine.move(-1), 'boundary');
});

test('rapid commands follow the requested destination while a new frame is decoding', async t => {
  const { engine, tick } = setup(t);
  await tick();
  assert.equal(engine.move(1), 'accepted');
  assert.equal(engine.move(1), 'accepted');
  assert.equal(engine.move(-1), 'accepted');
  await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'about', phase: 'loop' });
});

test('uninterrupted forward playback retains every frame and then enters its loop', async t => {
  const { engine, tick, draws } = setup(t);
  await tick();engine.move(1);
  for (let i = 0; i < 140; i++) await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'about', phase: 'loop' });
  for (let n = 1; n <= 121; n++) assert.ok(draws.includes(`one/${n}`), `missing forward frame ${n}`);
});

test('Profile preloads the About transition and its camera move starts after the blend', async t => {
  const { engine, tick, requested, motions, draws } = setup(t);
  await tick();
  for (let n = 1; n <= 6; n++) assert.ok(requested.includes(`one/${n}`), `About head ${n} is prepared during Profile`);
  engine.move(1);await tick();
  assert.equal(motions.at(-1).scene, 'about');
  assert.equal(motions.at(-1).progress, 0);
  // Six 34ms ticks are still within the 220ms handoff. No camera frame is hidden.
  for (let n = 0; n < 6; n++) { await tick(); assert.equal(motions.at(-1).progress, 0); }
  await tick();
  assert.equal(motions.at(-1).progress, 0);
  await tick();
  assert.equal(motions.at(-1).progress, 1 / 120);
  for (let n = 0; n < 135; n++) await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'about', phase: 'loop' });
  for (let n = 1; n <= 121; n++) assert.ok(draws.includes(`one/${n}`));
});

test('returning to Profile keeps the backward skip, then forward replays the About transition', async t => {
  const { engine, tick, motions } = setup(t);
  await tick();engine.navigate('about');await tick();
  engine.move(-1);await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'profile', phase: 'loop' });
  assert.equal(motions.at(-1).direction, -1);
  engine.move(1);await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'about', phase: 'playing' });
  assert.equal(motions.at(-1).direction, 1);
  assert.equal(motions.at(-1).progress, 0);
});

test('pause, disposal, boundaries and reduced motion preserve their safeguards', async t => {
  const { engine, tick, motions } = setup(t, true);
  await tick();engine.pause();
  assert.equal(engine.move(1), 'not-ready');
  engine.resume();assert.equal(engine.move(1), 'accepted');await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'about', phase: 'loop' });
  engine.move(-1);await tick();assert.equal(motions.at(-1).direction, -1);
  engine.navigate('contact');await tick();assert.equal(engine.move(1), 'boundary');
  engine.dispose();assert.equal(engine.move(-1), 'not-ready');
});

test('selecting the current scene preserves playback progress and loops in every section', async t => {
  const { engine, tick, motions, states } = setup(t);
  await tick();
  for (const scene of ['profile', 'about', 'history', 'contact']) {
    if (scene !== 'profile') { engine.navigate(scene); await tick(); }
    for (let n = 0; n < 20; n++) await tick();
    const progress = motions.at(-1).progress;
    const notifications = states.length;
    const snapshot = engine.getSnapshot();
    assert.equal(engine.getDestination(), scene);
    assert.equal(engine.navigate(scene), 'accepted');
    assert.equal(engine.getSnapshot(), snapshot);
    assert.equal(states.length, notifications);
    await tick();
    assert.ok(motions.at(-1).progress > progress, `${scene} continues rather than restarting`);
    for (let n = 0; n < 140; n++) await tick();
    assert.equal(engine.getSnapshot().phase, 'loop');
    const loopSnapshot = engine.getSnapshot();
    engine.navigate(scene); await tick();
    assert.equal(engine.getSnapshot(), loopSnapshot);
    assert.equal(motions.at(-1).phase, 'loop');
  }
});

test('the pending destination is used for repeated navigation before its first paint', async t => {
  const { engine, tick, states } = setup(t);
  await tick(); engine.navigate('history');
  assert.equal(engine.getDestination(), 'history');
  const notifications = states.length;
  engine.navigate('history');
  assert.equal(states.length, notifications);
  // The previously painted scene remains selectable to cancel a pending move.
  engine.navigate('profile'); await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'profile', phase: 'loop' });
});

test('explicit retry still restarts the same destination after a decode failure', async t => {
  let fail = true;
  const { engine, tick } = setup(t, false, src => fail && src === 'one/1');
  await tick(); engine.navigate('about'); await tick(); await tick();
  assert.equal(engine.getSnapshot().phase, 'error');
  fail = false;
  engine.retry(); await tick();
  assert.deepEqual(engine.getSnapshot(), { scene: 'about', phase: 'playing' });
});
