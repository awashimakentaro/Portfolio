import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { nearestBookSlot } from '../src/lib/book-gallery.mjs';

test('recommendation jumps keep the nearest carousel copy after forward and backward wraps', () => {
  for (const count of [1, 3, 5, 10]) {
    for (let position = -30; position <= 30; position++) {
      for (let target = 0; target < count; target++) {
        const slot = nearestBookSlot(position, target, count);
        assert.equal(((slot % count) + count) % count, target);
        assert.ok(Math.abs(slot - position) <= count / 2);
        if (((position % count) + count) % count === target) assert.equal(slot, position);
      }
    }
  }
  // Presence-Note is just to the left of Diet App across the wrap.
  assert.equal(nearestBookSlot(0, 4, 5), -1);
  assert.equal(nearestBookSlot(-1, 0, 5), 0);
});

test('missing or unavailable recommendation targets leave the selection unchanged', () => {
  for (const [target, count] of [[-1, 5], [5, 5], [0, 0], [1.5, 3]]) {
    assert.equal(nearestBookSlot(13, target, count), 13);
  }
});

test('every curated recommendation resolves to a published book in the same category', async () => {
  const source = await readFile(new URL('../src/features/history/book/data/recommendations.ts', import.meta.url), 'utf8');
  const { BOOK_RECOMMENDATIONS } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
  const catalog = JSON.parse(await readFile(new URL('../src/features/history/book/data/catalog.generated.json', import.meta.url), 'utf8'));
  assert.deepEqual(BOOK_RECOMMENDATIONS, {
    apps: 'pfc-tracker', agents: 'engineer-learning',
    design: 'awashima-portfolio', internship: 'hr-cloud',
  });
  for (const [category, id] of Object.entries(BOOK_RECOMMENDATIONS)) {
    assert.equal(typeof id, 'string');
    assert.ok(catalog.some(book => book.id === id && book.category === category), `${category}/${id}`);
  }
});
