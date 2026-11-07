import * as nodeModule from 'node:module';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const categories = new Set(['apps', 'agents', 'design', 'internship']);
const statuses = new Set(['draft', 'ready']);
const layouts = new Set(['text', 'image-text', 'statement', 'process']);
const imageTypes = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.avif', 'image/avif'], ['.gif', 'image/gif'],
]);

function check(value, message) { if (!value) throw new Error(message); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function inside(root, file) { const rel = path.relative(root, file); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); }

/** Repository-owned configuration is code, just like the application's TS metadata. */
export async function configuration(file) {
  check(typeof nodeModule.stripTypeScriptTypes === 'function', '制作プレビューにはNode.js 22.13以降が必要です。');
  const source = await readFile(file, 'utf8');
  const code = nodeModule.stripTypeScriptTypes(source);
  const result = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  check(result.default && typeof result.default === 'object', `${path.basename(file)} にdefault設定が必要です。`);
  return result.default;
}

export function validateBook(book) {
  check(text(book.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.id), 'book.ts: idは半角小文字・数字・ハイフンで指定してください。');
  check(text(book.title), 'book.ts: titleを入力してください。');
  check(categories.has(book.category), 'book.ts: categoryを確認してください。');
  check(statuses.has(book.status), 'book.ts: statusはdraftまたはreadyです。');
  check(book.links && typeof book.links === 'object', 'book.ts: linksを指定してください（未登録なら{}）。');
  for (const key of ['demo', 'github']) {
    if (book.links[key] === undefined) continue;
    let url;
    try { url = new URL(book.links[key]); } catch { throw new Error(`book.ts: ${key}のURLを確認してください。`); }
    check(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, `book.ts: ${key}にはhttp(s)のURLを指定してください。`);
  }
  if (book.details !== undefined) {
    check(book.details && typeof book.details === 'object' && !Array.isArray(book.details), 'book.ts: detailsを確認してください。');
    for (const key of ['summary', 'period', 'role', 'company']) if (book.details[key] !== undefined) check(text(book.details[key]), `book.ts: details.${key}は空でない文字列です。`);
  }
  check(Array.isArray(book.pages) && book.pages.length > 0, 'book.ts: pagesに1ページ以上登録してください。');
  const ids = new Set(), files = new Set();
  for (const page of book.pages) {
    check(page && text(page.id) && !ids.has(page.id), 'book.ts: ページidが未入力または重複しています。');
    check(text(page.file) && !files.has(page.file), 'book.ts: ページファイルが未入力または重複しています。');
    check(layouts.has(page.layout), `${page.file}: layoutはtext / image-text / statement / processです。`);
    check(statuses.has(page.status), `${page.file}: statusを確認してください。`);
    if (page.presentation !== undefined) {
      const style = page.presentation;
      check(style && typeof style === 'object' && !Array.isArray(style), `${page.file}: presentationを確認してください。`);
      for (const key of ['section', 'callout']) if (style[key] !== undefined) check(text(style[key]), `${page.file}: ${key}は空でない文字列です。`);
      check(style.accent === undefined, `${page.file}: ページ別の色分けは廃止しました。presentation.accentを削除してください。`);
      if (style.facts !== undefined) check(Array.isArray(style.facts) && style.facts.length <= 4 && style.facts.every(fact => fact && text(fact.label) && text(fact.value)), `${page.file}: factsにはlabelとvalueを持つ項目を4つまで指定できます。`);
    }
    ids.add(page.id); files.add(page.file);
  }
  return book;
}

/** A deliberately small, literal Markdown subset; raw HTML is never executed. */
export function parseMarkdown(source) {
  const lines = source.replace(/<!--[^]*?-->/g, '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    const image = /^!\[([^\]]*)\]\(([^\s)]+)\)$/.exec(line);
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (image) { blocks.push({ type: 'image', alt: image[1], file: image[2] }); index++; continue; }
    const action = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(line);
    if (action) {
      const target = action[2];
      if (target.startsWith('#')) blocks.push({ type: 'action', label: action[1], target: target.slice(1), kind: 'page' });
      else { const url = new URL(target); check(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, '本文リンクのURLを確認してください。'); blocks.push({ type: 'action', label: action[1], target, kind: 'url' }); }
      index++; continue;
    }
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); index++; continue; }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) { quote.push(lines[index].trim().replace(/^>\s?/, '')); index++; }
      blocks.push({ type: 'quote', text: quote.join('\n') }); continue;
    }
    if (/^(?:-{3,}|\*{3,})$/.test(line)) { blocks.push({ type: 'rule' }); index++; continue; }
    const list = /^(?:([-*+])|(\d+)\.)\s+(.+)$/.exec(line);
    if (list) {
      const items = [], ordered = Boolean(list[2]);
      while (index < lines.length) {
        const item = /^(?:([-*+])|(\d+)\.)\s+(.+)$/.exec(lines[index].trim());
        if (!item || Boolean(item[2]) !== ordered) break;
        items.push(item[3]); index++;
      }
      blocks.push({ type: 'list', ordered, items }); continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim()) {
      const current = lines[index].trim();
      if (paragraph.length && /^(?:#{1,6}\s|!\[|>\s?|[-*+]\s|\d+\.\s|---+$)/.test(current)) break;
      paragraph.push(current); index++;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }
  return blocks;
}

export function createContentStore(projectRoot) {
  const root = path.resolve(projectRoot), booksRoot = path.join(root, 'books');
  const assets = new Map();

  async function bookFolder(folder) {
    check(text(folder) && /^(apps|agents|design|internship)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder), '作品フォルダ名はカテゴリ/作品idで指定してください。');
    const realBooks = await realpath(booksRoot);
    const target = await realpath(path.join(booksRoot, folder));
    check(inside(realBooks, target) && target !== realBooks, 'books内の作品フォルダを指定してください。');
    return target;
  }

  async function folders() {
    const result = [];
    for (const category of categories) {
      let entries;
      try { entries = await readdir(path.join(booksRoot, category), { withFileTypes: true }); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      for (const entry of entries) if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) result.push(`${category}/${entry.name}`);
    }
    return result.sort();
  }

  function checkLocation(book, folder) {
    check(folder === `${book.category}/${book.id}`, 'book.tsのcategory・idをフォルダ配置と一致させてください。');
    return book;
  }

  async function listBooks() {
    const books = [], errors = [], ids = new Set();
    for (const folder of await folders()) {
      try {
        const directory = await bookFolder(folder);
        const book = checkLocation(validateBook(await configuration(path.join(directory, 'book.ts'))), folder);
        check(!ids.has(book.id), `作品id「${book.id}」が重複しています。`);
        ids.add(book.id);
        books.push({ folder, id: book.id, title: book.title, category: book.category, status: book.status });
      } catch (error) { errors.push({ folder, message: error.message }); }
    }
    return { books, errors };
  }

  async function revision(folder) {
    const directory = await bookFolder(folder);
    const hash = createHash('sha256');
    async function fingerprint(target) {
      try {
        const entry = await stat(target, { bigint: true });
        if (entry.isDirectory()) {
          for (const name of (await readdir(target, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
            if (!name.isSymbolicLink()) await fingerprint(path.join(target, name.name));
          }
        } else hash.update(`${target}:${entry.size}:${entry.mtimeNs}:${entry.ctimeNs}`);
      } catch (error) { if (error.code !== 'ENOENT') throw error; hash.update(`missing:${target}`); }
    }
    for (const name of await folders()) { hash.update(name); await fingerprint(path.join(booksRoot, name, 'book.ts')); }
    for (const name of ['book.ts', 'cover.ts', 'pages', 'images']) await fingerprint(path.join(directory, name));
    await fingerprint(path.join(booksRoot, 'types.ts'));
    await fingerprint(path.join(root, 'public/book-covers'));
    return hash.digest('hex').slice(0, 20);
  }

  async function within(base, requested, label) {
    check(text(requested) && !path.isAbsolute(requested) && !requested.includes('\0'), `${label}: 相対パスで指定してください。`);
    const realBase = await realpath(base);
    const file = await realpath(path.resolve(base, requested));
    check(inside(realBase, file) && file !== realBase, `${label}: 指定範囲の外を参照できません。`);
    check((await stat(file)).isFile(), `${label}: ファイルではありません。`);
    return { file, base: realBase };
  }

  async function loadBook(folder) {
    const directory = await bookFolder(folder);
    // Capture before reading: a save during this load must trigger the next poll.
    const version = await revision(folder);
    const book = checkLocation(validateBook(await configuration(path.join(directory, 'book.ts'))), folder);
    const cover = await configuration(path.join(directory, 'cover.ts'));
    check(statuses.has(cover.status) && cover.titleTreatment === 'large' && ['small', 'large'].includes(cover.imageTreatment), 'cover.ts: statusと表紙の表示設定を確認してください。');
    const pendingAssets = new Map(), warnings = [];
    async function imageAsset(file, allowedRoot) {
      const realRoot = await realpath(allowedRoot), resolved = await realpath(file);
      check(inside(realRoot, resolved) && resolved !== realRoot, '画像は作品のimages内、装丁はpublic/book-covers内を参照してください。');
      check(imageTypes.has(path.extname(resolved).toLowerCase()) && (await stat(resolved)).isFile(), '画像形式はPNG/JPEG/WebP/AVIF/GIFに対応しています。');
      const token = createHash('sha256').update(`${folder}\0${resolved}`).digest('hex');
      pendingAssets.set(token, { file: resolved, base: realRoot, folder });
      return `/assets/${token}?v=${version}`;
    }
    check(text(cover.binding) && !path.isAbsolute(cover.binding), 'cover.ts: bindingを相対パスで指定してください。');
    const bindingUrl = await imageAsset(path.resolve(directory, cover.binding), path.join(root, 'public/book-covers'));
    let coverImage;
    if (cover.image !== undefined) {
      check(cover.image && text(cover.image.file) && text(cover.image.alt), 'cover.ts: imageにfileとaltを指定してください。');
      check(cover.image.fit === undefined || ['cover', 'contain'].includes(cover.image.fit), 'cover.ts: image.fitはcoverかcontainを指定してください。');
      check(cover.image.background === undefined || /^#[0-9a-f]{6}$/i.test(cover.image.background), 'cover.ts: image.backgroundは6桁のHEX色を指定してください。');
      check(cover.image.inset === undefined || (Number.isFinite(cover.image.inset) && cover.image.inset >= 0 && cover.image.inset <= .2), 'cover.ts: image.insetは0〜0.2で指定してください。');
      coverImage = { url: await imageAsset(path.resolve(directory, cover.image.file), path.join(directory, 'images')), alt: cover.image.alt, fit: cover.image.fit ?? 'cover', inset: cover.image.inset ?? .08, background: cover.image.background ?? '#151616' };
    }
    const pages = [];
    for (const page of book.pages) {
      const { file } = await within(directory, page.file, page.file);
      const realPages = await realpath(path.join(directory, 'pages'));
      check(inside(realPages, file) && path.extname(file) === '.md', `${page.file}: pages内のMarkdownを指定してください。`);
      const blocks = parseMarkdown(await readFile(file, 'utf8'));
      for (const block of blocks) {
        if (block.type !== 'image') continue;
        check(text(block.alt), `${page.file}: 画像の説明を入力してください。`);
        block.url = await imageAsset(path.resolve(path.dirname(file), block.file), path.join(directory, 'images'));
        delete block.file;
      }
      for (const block of blocks) if (block.type === 'action' && block.kind === 'page') check(book.pages.some(page => page.id === block.target), `目次の移動先がありません: ${block.target}`);
      if (!blocks.length) warnings.push(`${page.file}: 本文が空です。`);
      if (page.layout === 'text' && blocks.some(block => block.type === 'image')) warnings.push(`${page.file}: 画像入りの原稿です。layoutをimage-textに変更してください。`);
      const style = page.presentation;
      const presentation = style ? {
        section: style.section, callout: style.callout,
        facts: style.facts?.map(fact => ({ label: fact.label, value: fact.value })),
      } : undefined;
      pages.push({ id: page.id, file: page.file, layout: page.layout, status: page.status, presentation, blocks });
    }
    if (book.status === 'ready' && (cover.status !== 'ready' || pages.some(page => page.status !== 'ready'))) warnings.push('本がreadyですが、表紙または本文にdraftが残っています。');
    // Replace this book's explicit allowlist only after a complete valid reload.
    for (const [token, asset] of assets) if (asset.folder === folder) assets.delete(token);
    for (const [token, asset] of pendingAssets) assets.set(token, asset);
    return {
      folder, id: book.id, title: book.title, category: book.category, status: book.status,
      links: { demo: book.links.demo, github: book.links.github }, details: book.details,
      cover: { bindingUrl, image: coverImage, titleTreatment: cover.titleTreatment, imageTreatment: cover.imageTreatment, status: cover.status },
      pages, revision: version, warnings,
    };
  }

  async function asset(token) {
    const entry = assets.get(token);
    check(entry, '画像が見つかりません。プレビューを再読み込みしてください。');
    const current = await realpath(entry.file);
    check(current === entry.file && inside(entry.base, current), '画像の参照先が変更されています。');
    return { file: current, type: imageTypes.get(path.extname(current).toLowerCase()) };
  }
  return { listBooks, loadBook, revision, asset };
}
