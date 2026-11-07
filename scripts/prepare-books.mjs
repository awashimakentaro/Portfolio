import { readFile, writeFile, mkdir, realpath, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseBookDocument } from '../src/lib/book-document.mjs';
import { configuration } from './book-preview/content.mjs';

/** Read only publication.ts: a malformed draft must not affect a release. */
export async function prepareBooks(root) {
  const catalog = [], contents = new Map(), media = new Map(), ids = new Set();
  const booksRoot = await realpath(path.join(root, 'books'));
  for (const category of ['apps', 'agents', 'design', 'internship']) {
    let entries;
    try { entries = await readdir(path.join(booksRoot, category), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const directory = path.join(booksRoot, category, entry.name);
      const publicationFile = path.join(directory, 'publication.ts');
      try { await readFile(publicationFile); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      const resolvedDirectory = await realpath(directory);
      if (!resolvedDirectory.startsWith(booksRoot + path.sep) || path.dirname(await realpath(publicationFile)) !== resolvedDirectory) throw Error('公開設定の範囲外参照です。');
      const book = await configuration(publicationFile);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(book.id) || book.id === 'sample-app' || book.id !== entry.name || book.category !== category || ids.has(book.id)) throw Error(`${category}/${entry.name}: 公開id/categoryが不正または重複しています。`);
      ids.add(book.id);
      if (typeof book.title !== 'string' || !book.title.trim() || book.file !== './published.md' || !Number.isFinite(book.order)) throw Error(`${book.id}: publication.file/title/orderを確認してください。`);
      if (!/^\/book-covers\/[A-Za-z0-9_-]+\.png$/.test(book.cover)) throw Error(`${book.id}: 公開用装丁を確認してください。`);
      const coversRoot = await realpath(path.join(root, 'public/book-covers'));
      if (path.dirname(await realpath(path.join(root, 'public', book.cover))) !== coversRoot) throw Error('公開装丁の範囲外参照です。');
      const links = book.links ?? {};
      if (typeof links !== 'object' || Array.isArray(links)) throw Error(`${book.id}: 公開リンク設定を確認してください。`);
      for (const key of ['demo', 'github']) if (links[key] !== undefined) {
        const url = new URL(links[key]);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error(`${book.id}: 公開リンクにはhttp(s)を指定してください。`);
      }
      const snapshot = await realpath(path.join(directory, book.file));
      if (path.dirname(snapshot) !== resolvedDirectory) throw Error(`${book.id}: 公開本文の範囲外参照です。`);
      let body = await readFile(snapshot, 'utf8');
      const mediaUrl = async relative => {
        if (typeof relative !== 'string' || !relative.startsWith('./images/')) throw Error(`${book.id}: 画像はimages内を指定してください。`);
        const image = await realpath(path.resolve(directory, relative));
        const imageRoot = await realpath(path.join(directory, 'images'));
        if (!image.startsWith(imageRoot + path.sep) || !/\.(png|jpe?g|webp|avif)$/i.test(image)) throw Error(`${book.id}: 不正な画像参照です。`);
        const name = `${book.id}/${path.basename(image)}`;
        if (media.has(name) && media.get(name).file !== image) throw Error('同名の画像があります。');
        media.set(name, { file: image, data: await readFile(image) });
        return `/book-media/${name}`;
      };
      let thumbnail;
      if (book.thumbnail) thumbnail = await mediaUrl(book.thumbnail);
      if (book.thumbnailFit !== undefined && !['cover', 'contain'].includes(book.thumbnailFit)) throw Error(`${book.id}: thumbnailFitが不正です。`);
      if (book.thumbnailInset !== undefined && (!Number.isFinite(book.thumbnailInset) || book.thumbnailInset < 0 || book.thumbnailInset > .2)) throw Error(`${book.id}: thumbnailInsetが不正です。`);
      if (book.thumbnailBackground !== undefined && !/^#[0-9a-f]{6}$/i.test(book.thumbnailBackground)) throw Error(`${book.id}: thumbnailBackgroundが不正です。`);
      if (!thumbnail && (book.thumbnailFit !== undefined || book.thumbnailInset !== undefined || book.thumbnailBackground !== undefined)) throw Error(`${book.id}: 表紙画像なしでは画像配置を指定できません。`);
      if (book.coverPeriod !== undefined && (typeof book.coverPeriod !== 'string' || !book.coverPeriod.trim())) throw Error(`${book.id}: 制作・在籍期間は空でない文字列を指定してください。`);
      if (book.format !== undefined && book.format !== 'fixed-pages') throw Error('本文形式が不正です。');
      if (book.format === 'fixed-pages') {
        const pages = parseBookDocument(body);
        for (const page of pages) for (const block of page.blocks) if (block.type === 'image') {
          const url = await mediaUrl(block.src);
          body = body.replaceAll(`](${block.src})`, `](${url})`);
        }
      }
      contents.set(`${book.id}.md`, body);
      catalog.push({ id: book.id, title: book.title, category, cover: book.cover,
        markdown: `/book-content/${book.id}.md`, ...(book.format ? { format: book.format } : {}), ...(thumbnail ? { thumbnail, ...(book.thumbnailFit ? { thumbnailFit: book.thumbnailFit } : {}), ...(book.thumbnailInset !== undefined ? { thumbnailInset: book.thumbnailInset } : {}), ...(book.thumbnailBackground ? { thumbnailBackground: book.thumbnailBackground } : {}) } : {}), order: book.order,
        ...(book.coverPeriod ? { coverPeriod: book.coverPeriod } : {}),
        ...(links.demo ? { demoUrl: links.demo } : {}), ...(links.github ? { githubUrl: links.github } : {}) });
    }
  }
  catalog.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const outputCatalog = catalog.map(({ order, ...book }) => book);
  // Validate all inputs before replacing generated files.
  const output = path.join(root, 'public/book-content');
  await mkdir(output, { recursive: true });
  for (const [name, value] of media) { const target = path.join(root, 'public/book-media', name); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, value.data); }
  for (const [name, data] of contents) await writeFile(path.join(output, name), data);
  for (const name of await readdir(output)) if (name.endsWith('.md') && !contents.has(name)) await rm(path.join(output, name));
  await writeFile(path.join(root, 'src/features/history/book/data/catalog.generated.json'), JSON.stringify(outputCatalog, null, 2) + '\n');
  return outputCatalog;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Synced ${(await prepareBooks(fileURLToPath(new URL('../', import.meta.url)))).length} published books.`);
}
