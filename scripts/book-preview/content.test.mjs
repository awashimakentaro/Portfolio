import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createContentStore, parseMarkdown } from './content.mjs';
import { createPreviewServer } from './server.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'portfolio-book-preview-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = path.join(root, 'books/design/example');
  for (const dir of ['pages', 'images']) await mkdir(path.join(folder, dir), { recursive: true });
  await mkdir(path.join(root, 'public/book-covers'), { recursive: true });
  await writeFile(path.join(root, 'public/book-covers/design.png'), 'test cover');
  await writeFile(path.join(folder, 'images/screen.png'), 'test image');
  await writeFile(path.join(folder, 'notes.md'), 'PRIVATE AUTHOR NOTES');
  await writeFile(path.join(folder, 'pages/01.md'), '# 概要\n\n![画面](../images/screen.png)\n\n説明です。');
  await writeFile(path.join(folder, 'pages/02.md'), '# 判断\n\n本文です。');
  const config = {
    id: 'example', title: 'Example Book', category: 'design', status: 'draft', links: {},
    pages: [
      { id: 'one', file: './pages/01.md', layout: 'image-text', status: 'draft' },
      { id: 'two', file: './pages/02.md', layout: 'text', status: 'draft' },
    ],
  };
  const cover = { binding: '../../../public/book-covers/design.png', image: { file: './images/screen.png', alt: '画面' }, titleTreatment: 'large', imageTreatment: 'small', status: 'draft' };
  const saveBook = () => writeFile(path.join(folder, 'book.ts'), `export default ${JSON.stringify(config)};`);
  const saveCover = () => writeFile(path.join(folder, 'cover.ts'), `export default ${JSON.stringify(cover)};`);
  await saveBook(); await saveCover();
  return { root, folder, config, cover, saveBook, saveCover, store: createContentStore(root) };
}

test('explicit page order, draft state, referenced images; notes are excluded', async t => {
  const { store } = await fixture(t);
  const listing = await store.listBooks();
  assert.equal(listing.books[0].folder, 'design/example');
  const book = await store.loadBook('design/example');
  assert.equal(book.status, 'draft');
  assert.deepEqual(book.pages.map(page => page.id), ['one', 'two']);
  assert.equal(book.pages[0].blocks[1].type, 'image');
  assert.match(book.cover.bindingUrl, /^\/assets\/[a-f0-9]{64}\?v=/);
  assert.doesNotMatch(JSON.stringify(book), /PRIVATE AUTHOR NOTES/);
  const token = book.pages[0].blocks[1].url.split('/assets/')[1].split('?')[0];
  assert.match((await store.asset(token)).file, /images\/screen.png$/);
  await assert.rejects(store.asset('notes.md'));
});

test('logo placement survives authoring and publication without cropping or unsafe style values', async t => {
  const { root, folder, cover, saveCover, store } = await fixture(t);
  cover.image.fit = 'contain'; cover.image.background = '#27426e';
  await saveCover();
  const book = await store.loadBook('design/example');
  assert.equal(book.cover.image.fit, 'contain');
  assert.equal(book.cover.image.background, '#27426e');
  assert.equal(book.cover.image.inset, .08);
  cover.image.inset = 0; await saveCover();
  assert.equal((await store.loadBook('design/example')).cover.image.inset, 0);
  const { coverContainRect } = await import('../../src/lib/book-layout.mjs');
  for (const [width, height] of [[99, 91], [126, 57], [157, 43]]) {
    const placed = coverContainRect(width, height, 699, 497);
    assert.ok(placed.x >= 699 * .08 - 1e-8 && placed.y >= 497 * .08 - 1e-8);
    assert.ok(placed.x + placed.width <= 699 * .92 + 1e-8);
    assert.ok(placed.y + placed.height <= 497 * .92 + 1e-8);
    assert.ok(Math.abs(placed.width / placed.height - width / height) < 1e-8);
  }
  await mkdir(path.join(root, 'src/features/history/book/data'), { recursive: true });
  await writeFile(path.join(folder, 'published.md'), '# Public');
  const publication = { id: 'example', title: 'Example', category: 'design', file: './published.md', cover: '/book-covers/design.png', order: 0,
    thumbnail: './images/screen.png', thumbnailFit: 'contain', thumbnailInset: 0, thumbnailBackground: '#27426e' };
  await writeFile(path.join(folder, 'publication.ts'), `export default ${JSON.stringify(publication)};`);
  const { prepareBooks } = await import('../prepare-books.mjs');
  const [published] = await prepareBooks(root);
  assert.equal(published.thumbnailFit, 'contain');
  assert.equal(published.thumbnailBackground, '#27426e');
  assert.equal(published.thumbnailInset, 0);
  cover.image.inset = -.1; await saveCover();
  await assert.rejects(store.loadBook('design/example'), /inset/);
  cover.image.inset = .08;
  publication.thumbnailInset = .3;
  await writeFile(path.join(folder, 'publication.ts'), `export default ${JSON.stringify(publication)};`);
  await assert.rejects(prepareBooks(root), /thumbnailInset/);
  publication.thumbnailInset = 0;
  cover.image.background = 'url(https://invalid.example)'; await saveCover();
  await assert.rejects(store.loadBook('design/example'), /background/);
  publication.thumbnailFit = 'stretch';
  await writeFile(path.join(folder, 'publication.ts'), `export default ${JSON.stringify(publication)};`);
  await assert.rejects(prepareBooks(root), /thumbnailFit/);
});

test('employment period reaches previews and explicit internship publications', async t => {
  const { root, config, saveBook, store } = await fixture(t);
  config.details = { period: '2026年6月〜現在' }; await saveBook();
  assert.equal((await store.loadBook('design/example')).details.period, '2026年6月〜現在');
  const folder = path.join(root, 'books/internship/intern');
  await mkdir(folder, { recursive: true });
  await mkdir(path.join(root, 'src/features/history/book/data'), { recursive: true });
  await writeFile(path.join(folder, 'published.md'), '# Internship');
  const publication = { id: 'intern', title: 'Intern', category: 'internship', file: './published.md', cover: '/book-covers/design.png', order: 0, coverPeriod: '2025年10月〜2025年12月頃' };
  const save = () => writeFile(path.join(folder, 'publication.ts'), `export default ${JSON.stringify(publication)};`);
  await save();
  const { prepareBooks } = await import('../prepare-books.mjs');
  assert.equal((await prepareBooks(root))[0].coverPeriod, publication.coverPeriod);
  publication.coverPeriod = ' '; await save();
  await assert.rejects(prepareBooks(root), /期間/);
});

test('cover periods are published for all four categories without promoting drafts', async t => {
  const { root } = await fixture(t);
  await mkdir(path.join(root, 'src/features/history/book/data'), { recursive: true });
  const { prepareBooks } = await import('../prepare-books.mjs');
  for (const category of ['apps', 'agents', 'design', 'internship']) {
    const id = `period-${category}`;
    const folder = path.join(root, 'books', category, id);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'published.md'), '# Existing public body');
    const publication = { id, title: id, category, file: './published.md', cover: '/book-covers/design.png', order: 0, coverPeriod: '2026年10月〜現在' };
    await writeFile(path.join(folder, 'publication.ts'), `export default ${JSON.stringify(publication)};`);
  }
  const books = await prepareBooks(root);
  assert.equal(books.length, 4);
  for (const book of books) {
    assert.equal(book.coverPeriod, '2026年10月〜現在');
    assert.equal(await readFile(path.join(root, 'public/book-content', `${book.id}.md`), 'utf8'), '# Existing public body');
  }
});

test('reordered and odd manuscripts stay explicit, without automatic pagination', async t => {
  const { store, config, saveBook, folder } = await fixture(t);
  await writeFile(path.join(folder, 'pages/03.md'), '# 長い原稿\n\n' + '文字'.repeat(1500));
  config.pages = [config.pages[1], config.pages[0], { id: 'three', file: './pages/03.md', layout: 'text', status: 'draft' }];
  await saveBook();
  const book = await store.loadBook('design/example');
  assert.deepEqual(book.pages.map(page => page.id), ['two', 'one', 'three']);
  assert.equal(book.pages.length, 3);
  assert.equal(book.pages[2].blocks[1].text.length, 3000);
});

test('saving Markdown, images and metadata changes revision and reloads TypeScript', async t => {
  const { store, config, saveBook, folder } = await fixture(t);
  const first = await store.revision('design/example');
  await writeFile(path.join(folder, 'pages/02.md'), '# 新しい原稿\n\n保存した文章');
  assert.notEqual(await store.revision('design/example'), first);
  const second = await store.revision('design/example');
  config.title = 'Changed title'; await saveBook();
  assert.equal((await store.loadBook('design/example')).title, 'Changed title');
  assert.notEqual(await store.revision('design/example'), second);
  const third = await store.revision('design/example');
  await writeFile(path.join(folder, 'images/screen.png'), 'changed image data');
  assert.notEqual(await store.revision('design/example'), third);
});

test('invalid settings report errors and a failed reload keeps previous image allowlist', async t => {
  const { store, config, saveBook } = await fixture(t);
  const book = await store.loadBook('design/example');
  const token = book.cover.bindingUrl.split('/assets/')[1].split('?')[0];
  config.links.demo = 'javascript:alert(1)'; await saveBook();
  await assert.rejects(store.loadBook('design/example'), /http\(s\)/);
  assert.ok(await store.asset(token));
  config.links.demo = 'https://example.com'; await saveBook();
  assert.equal((await store.loadBook('design/example')).links.demo, 'https://example.com');
  config.pages[1].id = config.pages[0].id; await saveBook();
  await assert.rejects(store.loadBook('design/example'), /重複/);
});

test('a save during configuration loading is still detected by the next poll', async t => {
  const { store, folder, config } = await fixture(t);
  const file = path.join(folder, 'book.ts');
  const updated = `export default ${JSON.stringify({ ...config, title: 'Saved during load' })};`;
  // A deterministic save during module evaluation, rather than a timing-based delay.
  await writeFile(file, `import { writeFile } from 'node:fs/promises';\nawait writeFile(${JSON.stringify(file)}, ${JSON.stringify(updated)});\nexport default ${JSON.stringify(config)};`);
  const previous = await store.loadBook('design/example');
  assert.equal(previous.title, 'Example Book');
  assert.notEqual(previous.revision, await store.revision('design/example'));
  assert.equal((await store.loadBook('design/example')).title, 'Saved during load');
});

test('page and image paths cannot expose notes or escape through symlinks', async t => {
  const { store, config, saveBook, cover, saveCover, folder } = await fixture(t);
  await assert.rejects(store.loadBook('../Example'), /フォルダ名/);
  config.pages[0].file = './notes.md'; await saveBook();
  await assert.rejects(store.loadBook('design/example'), /pages内/);
  config.pages[0].file = './pages/01.md'; await saveBook();
  cover.image.file = './notes.md'; await saveCover();
  await assert.rejects(store.loadBook('design/example'), /images内/);
  await symlink(path.join(folder, 'notes.md'), path.join(folder, 'images/secret.png'));
  cover.image.file = './images/secret.png'; await saveCover();
  await assert.rejects(store.loadBook('design/example'), /images内/);
});

test('catalog updates include new books, skip templates, and report inconsistent IDs', async t => {
  const { store, root, config, folder } = await fixture(t);
  const before = await store.revision('design/example');
  await mkdir(path.join(root, 'books/_templates/project'), { recursive: true });
  await mkdir(path.join(root, 'books/design/other'), { recursive: true });
  await writeFile(path.join(root, 'books/design/other/book.ts'), await readFile(path.join(folder, 'book.ts')));
  assert.notEqual(await store.revision('design/example'), before);
  const duplicate = await store.listBooks();
  assert.equal(duplicate.books.length, 1);
  assert.match(duplicate.errors[0].message, /一致/);
  await writeFile(path.join(root, 'books/design/other/book.ts'), `export default ${JSON.stringify({ ...config, id: 'other' })};`);
  assert.equal((await store.listBooks()).books.length, 2);
});

test('Markdown subset handles headings, images and lists, removes author comments, keeps HTML literal', () => {
  const blocks = parseMarkdown('# 見出し\n\n<!-- comment -->\n![画面](../images/a.png)\n\n- 項目1\n- 項目2\n\n1. 最初\n2. 次\n\n---\n\n<script>alert(1)</script>');
  assert.deepEqual(blocks.map(block => block.type), ['heading', 'image', 'list', 'list', 'rule', 'paragraph']);
  assert.equal(blocks[2].ordered, false);
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks.at(-1).text, '<script>alert(1)</script>');
  assert.doesNotMatch(JSON.stringify(blocks), /comment/);
});

test('editorial layouts and optional presentation metadata survive loading and validate', async t => {
  const { store, config, saveBook } = await fixture(t);
  config.pages[0].layout = 'statement';
  config.pages[0].presentation = { section: '伝えたいこと', callout: '伝える要点', facts: [{ label: '担当', value: '全工程' }] };
  config.pages[1].layout = 'process';
  await saveBook();
  const book = await store.loadBook('design/example');
  assert.equal(book.pages[0].presentation.section, '伝えたいこと');
  assert.equal(book.pages[0].presentation.facts[0].value, '全工程');
  assert.equal(book.pages[1].layout, 'process');
  config.pages[0].presentation.accent = 'unrecognized'; await saveBook();
  await assert.rejects(store.loadBook('design/example'), /accent/);
});

test('block quotes preserve line breaks and inline emphasis remains literal data', () => {
  const blocks = parseMarkdown('# 題名\n\n> デザインと\n> エンジニアリング\n\n**強調** と <script>alert(1)</script>');
  assert.deepEqual(blocks[1], { type: 'quote', text: 'デザインと\nエンジニアリング' });
  assert.equal(blocks[2].text, '**強調** と <script>alert(1)</script>');
});

test('HTTP server exposes only preview endpoints and allowlisted images', async t => {
  const { root } = await fixture(t);
  const server = createPreviewServer(root);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base)).status, 200);
  const response = await fetch(`${base}/api/book?folder=design%2Fexample`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const book = await response.json();
  assert.equal((await fetch(base + book.cover.image.url)).status, 200);
  for (const route of ['/books/design/example/notes.md', '/public/book-covers/design.png', '/assets/unknown']) {
    assert.notEqual((await fetch(base + route)).status, 200);
  }
  assert.equal((await fetch(`${base}/api/book?folder=../Example`)).status, 400);
  assert.equal((await fetch(`${base}/api/books`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/api/books`, { headers: { origin: 'https://example.com' } })).status, 403);
});

test('category folders and metadata must match; all four categories are discoverable', async t => {
  const { root, store, config } = await fixture(t);
  for (const category of ['apps', 'agents', 'internship']) {
    const directory = path.join(root, 'books', category, category);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'book.ts'), `export default ${JSON.stringify({ ...config, category, id: category })};`);
  }
  assert.deepEqual(new Set((await store.listBooks()).books.map(book => book.category)), new Set(['apps', 'agents', 'design', 'internship']));
  await assert.rejects(store.loadBook('design/../../outside'), /フォルダ名/);
  await writeFile(path.join(root, 'books/apps/apps/book.ts'), `export default ${JSON.stringify({ ...config, category: 'internship', id: 'apps' })};`);
  assert.match((await store.listBooks()).errors[0].message, /一致/);
});

test('publication exports only explicit snapshots and public links; drafts stay out', async t => {
  const { prepareBooks } = await import('../prepare-books.mjs');
  const { root, config, saveBook, folder } = await fixture(t);
  await mkdir(path.join(root, 'src/features/history/book/data'), { recursive: true });
  await mkdir(path.join(root, 'books/_samples'), { recursive: true });
  await writeFile(path.join(root, 'books/_samples/sample-app.md'), '# sample');
  await writeFile(path.join(folder, 'published.md'), '# Published snapshot');
  config.links.demo = 'https://draft.example.com';
  const publication = { id: 'example', title: 'Example', category: 'design', file: './published.md', cover: '/book-covers/design.png', order: 0 };
  const savePublication = () => writeFile(path.join(folder, 'publication.ts'), `export default ${JSON.stringify(publication)};`);
  await savePublication();
  await saveBook();
  await writeFile(path.join(folder, 'book.ts'), 'invalid unfinished TypeScript {');
  await mkdir(path.join(root, 'books/apps/unfinished'), { recursive: true });
  const catalog = await prepareBooks(root);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].demoUrl, undefined);
  assert.equal(await readFile(path.join(root, 'public/book-content/example.md'), 'utf8'), '# Published snapshot');
  const outputs = await readFile(path.join(root, 'src/features/history/book/data/catalog.generated.json'), 'utf8');
  assert.doesNotMatch(outputs, /draft.example|PRIVATE|pages\/|notes/);
  await assert.rejects(readFile(path.join(root, 'public/book-content/sample-app.md')), /ENOENT/);
  publication.file = './notes.md'; await savePublication();
  await assert.rejects(prepareBooks(root), /publication.file/);
  assert.equal(await readFile(path.join(root, 'public/book-content/example.md'), 'utf8'), '# Published snapshot');
  await rm(path.join(folder, 'publication.ts'));
  assert.equal((await prepareBooks(root)).length, 0);
  await assert.rejects(readFile(path.join(root, 'public/book-content/example.md')), /ENOENT/);
});

test('studio parses actionable contents and validates their destinations', async t => {
  const { store, folder } = await fixture(t);
  await writeFile(path.join(folder, 'pages/01.md'), '# 目次\n\n[次のページ](#two)\n\n[Demo](https://example.com)');
  const book=await store.loadBook('design/example');
  assert.deepEqual(book.pages[0].blocks.map(block=>block.type),['heading','action','action']);
  await writeFile(path.join(folder, 'pages/01.md'), '# 目次\n\n[Missing](#none)');
  await assert.rejects(store.loadBook('design/example'), /移動先/);
});
