import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneWheelGesture } from '../src/lib/scene-wheel-gesture.mjs';

test('one wheel gesture moves once; momentum cannot skip multiple scenes', () => {
  const wheel = new SceneWheelGesture();
  assert.equal(wheel.consume(10, 0), null);
  assert.equal(wheel.consume(20, 10), 1);
  for (let now = 20; now < 500; now += 20) assert.equal(wheel.consume(100, now), null);
  assert.equal(wheel.consume(30, 700), 1);
});

test('a new gesture or a deliberate direction change works before the clip ends', () => {
  const wheel = new SceneWheelGesture();
  assert.equal(wheel.consume(50, 0), 1);
  assert.equal(wheel.consume(-50, 20), -1);
  assert.equal(wheel.consume(-20, 40), null);
  assert.equal(wheel.consume(-30, 250), -1);
  wheel.reset();
  assert.equal(wheel.consume(30, 251), 1);
  assert.equal(wheel.consume(NaN, 252), null);
  assert.equal(wheel.consume(0, 253), null);
});
