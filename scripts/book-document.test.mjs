import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseBookDocument, spreadForPage } from '../src/lib/book-document.mjs';
test('six contents targets map to the published chapters, including process continuation pages', async () => {
  const source=await readFile(new URL('../books/design/awashima-portfolio/published.md',import.meta.url),'utf8');
  const pages=parseBookDocument(source);
  assert.deepEqual(pages.map(page => page.id), ['contents', 'about', 'context', 'process', 'process-wireframe', 'process-prototype', 'review', 'outcome', 'tools']);
  const actions=pages[0].blocks.filter(block=>block.action?.kind==='page');
  assert.equal(actions.length,6);
  assert.deepEqual(actions.map(block=>spreadForPage(pages.findIndex(page=>page.id===block.action.target))),[1,1,2,3,4,4]);
  assert.ok(pages[1].blocks.some(block=>block.type==='image'));
  assert.equal(pages[1].blocks.filter(block=>block.action?.kind==='url').length,2);
});
test('invalid contents targets, duplicate IDs and unsafe URLs are rejected', () => {
  assert.throws(()=>parseBookDocument('<!-- page:contents -->\n\n[Missing](#absent)'),/移動先/);
  assert.throws(()=>parseBookDocument('<!-- page:a -->\n\nA\n\n<!-- page:a -->\n\nB'),/重複/);
  assert.throws(()=>parseBookDocument('<!-- page:a -->\n\n[Unsafe](javascript:alert)'),/リンク/);
  assert.throws(()=>parseBookDocument('plain text'),/ページ/);
});

test('chapter headers follow contents numbering and continue on both sides of every chapter', async () => {
  const pages=parseBookDocument(await readFile(new URL('../books/design/awashima-portfolio/published.md',import.meta.url),'utf8'));
  assert.equal(pages[0].header,'目次');
  assert.deepEqual(pages.slice(1).map(page=>page.header),[
    '01 作品について','02 課題・背景・目標','03 制作プロセス','03 制作プロセス','03 制作プロセス','04 検証・改善','05 成果と効果','06 使用技術・ツール',
  ]);
});

test('cover window follows cropped artwork coordinates and photographs always fill it without distortion', async () => {
  const { coverWindowRect, coverCrop, COVER_WINDOW } = await import('../src/lib/book-layout.mjs');
  for(const crop of [{left:99,top:95,width:920,height:1200},{left:108,top:96,width:900,height:1195}]) {
    const window=coverWindowRect(crop,1024,1365);
    assert.ok(Math.abs(window.x/1024*crop.width+crop.left-COVER_WINDOW.x)<1e-8);
    assert.ok(Math.abs(window.height/1365*crop.height-COVER_WINDOW.height)<1e-8);
    for(const [width,height] of [[1920,1080],[600,1200],[1000,1000]]) {
      const source=coverCrop(width,height,window.width,window.height);
      assert.ok(source.x>=0&&source.y>=0&&source.width<=width+1e-8&&source.height<=height+1e-8);
      assert.ok(Math.abs(source.width/source.height-window.width/window.height)<1e-8);
    }
  }
});

test('repeated chapter titles are suppressed but subsection headings survive', async () => {
  const { repeatsChapterHeading, chapterHeaders }=await import('../src/lib/book-layout.mjs');
  assert.equal(repeatsChapterHeading('制作プロセス','03 制作プロセス'),true);
  assert.equal(repeatsChapterHeading('目次','目次'),true);
  assert.equal(repeatsChapterHeading('学ぶ・調べる','03 制作プロセス'),false);
  assert.equal(repeatsChapterHeading('課題',undefined),false);
  assert.deepEqual(chapterHeaders(['contents','process','continued'],[{kind:'page',target:'process',label:'03 制作プロセス'}]),['目次','01 制作プロセス','01 制作プロセス']);
});

test('cover button centers and edges are clickable while the gap is not', async () => {
  const { coverLinkRects, coverLinkAt }=await import('../src/lib/book-layout.mjs');
  for(const count of [1,2]) {
    const buttons=coverLinkRects(count,1024,1365);
    for(const button of buttons){
      assert.equal(coverLinkAt(buttons,button.x+1,button.y+1),button);
      assert.equal(coverLinkAt(buttons,button.x+button.width-1,button.y+button.height-1),button);
      assert.ok(button.height/1365*455>=44);
    }
    assert.equal(coverLinkAt(buttons,0,0),undefined);
  }
  const buttons=coverLinkRects(2,1,1);
  assert.equal(coverLinkAt(buttons,.51,.82),undefined);
  assert.deepEqual(coverLinkRects(0,1,1),[]);
});
