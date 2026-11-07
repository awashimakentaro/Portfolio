import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContentStore, configuration } from './book-preview/content.mjs';
import { parseBookDocument } from '../src/lib/book-document.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ids = ['contents', 'about', 'responsibilities', 'work', 'decisions', 'outcome', 'reflection'];
const labels = ['インターンについて', '担当範囲', '実際に行ったこと', '工夫・判断', '成果', '振り返り'];

for (const company of ['hr-cloud', 'pr-times', 'eyes-japan']) {
  test(`${company}: draft and published contents retain all six internship chapters`, async () => {
    const book = await createContentStore(root).loadBook(`internship/${company}`);
    assert.deepEqual(book.pages.map(page => page.id), ids);
    const published = parseBookDocument(await readFile(`${root}/books/internship/${company}/published.md`, 'utf8'));
    assert.deepEqual(published.map(page => page.id), ids);
    for (const pages of [book.pages, published]) {
      const contents = pages[0].blocks.filter(block => block.type === 'action');
      assert.deepEqual(contents.map(block => block.action?.target ?? block.target), ids.slice(1));
      assert.deepEqual(contents.map(block => block.action?.label ?? block.label), labels.map((label, i) => `${String(i + 1).padStart(2, '0')}　${label}`));
    }
    assert.deepEqual(published.slice(1).map(page => page.header), labels.map((label, i) => `${String(i + 1).padStart(2, '0')} ${label}`));
    // Missing information stays genuinely empty, but remains a reachable page.
    const missing = company === 'pr-times' ? ['work', 'decisions', 'outcome'] : company === 'hr-cloud' ? ['work'] : [];
    for (const id of missing) assert.equal(published.find(page => page.id === id).blocks.length, 0);
  });
}

test('Eyes-Japan uses the confirmed June–October range in draft and publication', async () => {
  const draft = await configuration(`${root}/books/internship/eyes-japan/book.ts`);
  const publication = await configuration(`${root}/books/internship/eyes-japan/publication.ts`);
  assert.equal(draft.details.period, '2026年6月〜2026年10月');
  assert.equal(publication.coverPeriod, draft.details.period);
});
