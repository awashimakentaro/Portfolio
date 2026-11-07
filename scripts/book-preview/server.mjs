import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as nodeModule from 'node:module';
import path from 'node:path';
import { createContentStore } from './content.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const files = new Map([['/fonts/zen-kaku-gothic-new-regular.woff', ['../../public/fonts/zen-kaku-gothic-new-regular.woff', 'font/woff']], ['/book-layout.mjs', ['../../src/lib/book-layout.mjs', 'text/javascript; charset=utf-8']], ['/', ['index.html', 'text/html; charset=utf-8']], ['/studio.css', ['studio.css', 'text/css; charset=utf-8']], ['/studio.js', ['studio.js', 'text/javascript; charset=utf-8']], ['/launch.js', ['launch.js', 'text/javascript; charset=utf-8']]]);

export function createPreviewServer(root = projectRoot) {
  const store = createContentStore(root);
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    const json = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.setHeader('Allow', 'GET, HEAD'); json(405, { error: '読み取り専用のプレビューです。' }); return; }
      const host = request.headers.host ?? '';
      if (!/^(?:127\.0\.0\.1|localhost):\d+$/.test(host)) { json(403, { error: 'ローカルから接続してください。' }); return; }
      if (request.headers.origin && ![`http://${host}`].includes(request.headers.origin)) { json(403, { error: '接続元を確認してください。' }); return; }
      const url = new URL(request.url, `http://${host}`);
      if (url.searchParams.get('folder') === 'Awashima-Portfolio') url.searchParams.set('folder', 'design/awashima-portfolio');
      if (url.pathname === '/api/books') { json(200, await store.listBooks()); return; }
      if (url.pathname === '/api/book') { json(200, await store.loadBook(url.searchParams.get('folder'))); return; }
      if (url.pathname === '/api/revision') { json(200, { revision: await store.revision(url.searchParams.get('folder')) }); return; }
      if (url.pathname.startsWith('/assets/')) {
        const asset = await store.asset(url.pathname.slice('/assets/'.length));
        const data = await readFile(asset.file);
        response.writeHead(200, { 'Content-Type': asset.type }); response.end(request.method === 'HEAD' ? undefined : data); return;
      }
      if (files.has(url.pathname)) {
        const [file, type] = files.get(url.pathname);
        const body = await readFile(new URL(file, import.meta.url));
        response.writeHead(200, { 'Content-Type': type }); response.end(request.method === 'HEAD' ? undefined : body); return;
      }
      if (url.pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      json(404, { error: 'このページはありません。' });
    } catch (error) {
      json(400, { error: error.code === 'ENOENT' ? '必要なファイルが見つかりません。原稿・画像・設定のパスを確認してください。' : error.message });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (typeof nodeModule.stripTypeScriptTypes !== 'function') { console.error('制作プレビューにはNode.js 22.13以降が必要です。'); process.exit(1); }
  const port = Number(process.env.BOOK_PREVIEW_PORT ?? 3015);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('BOOK_PREVIEW_PORTは1〜65535で指定してください。'); process.exit(1); }
  const server = createPreviewServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `ポート${port}は使用中です。BOOK_PREVIEW_PORTで別の番号を指定してください。` : error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Book Studio: http://127.0.0.1:${port}\n原稿の保存後、自動でプレビューを更新します。終了: Ctrl+C`));
}
