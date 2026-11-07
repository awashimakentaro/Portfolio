import test from 'node:test';
import assert from 'node:assert/strict';
import { coverPeriodParts, coverPeriodLabel, coverDateLayout } from '../src/lib/book-layout.mjs';

test('tenure display aligns dates while preserving ongoing periods and omitting approximate suffixes', () => {
  assert.deepEqual(coverPeriodParts('2026年10月〜現在'), { start: '2026.10', end: '現在' });
  assert.deepEqual(coverPeriodParts('2026年6月〜現在'), { start: '2026.06', end: '現在' });
  assert.deepEqual(coverPeriodParts('2025年10月〜2025年12月頃'), { start: '2025.10', end: '2025.12' });
  assert.deepEqual(coverPeriodParts('2025年1月〜2025年9月'), { start: '2025.01', end: '2025.09' });
});

test('unrecognized or invalid tenure formats remain literal; dates are never invented', () => {
  for (const raw of ['勤務時期未確認', '2026年頃〜現在', '2026年13月〜現在', '2025年1月〜2025年0月']) {
    assert.deepEqual(coverPeriodParts(raw), { start: raw, end: '' });
  }
});

test('cover dates preserve precision and shorten only the repeated year', () => {
  for (const [raw, expected] of [
    ['2026年3月〜2026年4月', '2026.03–04'],
    ['2026年10月〜2026年11月', '2026.10–11'],
    ['2026年10月〜現在', '2026.10–現在'],
    ['2026年6月〜現在', '2026.06–現在'],
    ['2026年〜現在', '2026–現在'],
    ['2025年1月', '2025.01'],
    ['2025年12月', '2025.12'],
    ['2026年2月〜2026年2月', '2026.02'],
    ['2025年12月〜2026年2月', '2025.12–2026.02'],
    ['未確認', '未確認'],
  ]) assert.equal(coverPeriodLabel(raw), expected);
});

test('bottom-right date anchor follows the source artwork through alpha cropping', () => {
  for (const crop of [{ left: 99, top: 95, width: 920, height: 1200 }, { left: 108, top: 96, width: 900, height: 1195 }]) {
    const rect = coverDateLayout(crop, 1024, 1365);
    assert.ok(Math.abs(rect.x / 1024 * crop.width + crop.left - 960) < 1e-8);
    assert.ok(Math.abs(rect.y / 1365 * crop.height + crop.top - 1258) < 1e-8);
    assert.ok(rect.x > 1024 * .85 && rect.x < 1024 * .98);
    assert.ok(rect.y > 1365 * .9 && rect.y < 1365);
  }
});


test('zero inset fills a wide cover image to the window width without stretching', async () => {
  const { coverContainRect } = await import('../src/lib/book-layout.mjs');
  const rect = coverContainRect(2364, 1182, 699, 497, 0);
  assert.ok(Math.abs(rect.x) < 1e-8);
  assert.ok(Math.abs(rect.width - 699) < 1e-8);
  assert.ok(Math.abs(rect.height - 349.5) < 1e-8);
  assert.ok(Math.abs(rect.y - (497 - 349.5) / 2) < 1e-8);
  assert.ok(Math.abs(coverContainRect(2364, 1182, 699, 497).width - 699 * .84) < 1e-8);
});
