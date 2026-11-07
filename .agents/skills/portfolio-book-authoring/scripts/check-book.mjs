import { fileURLToPath } from 'node:url';
import { createContentStore } from '../../../../scripts/book-preview/content.mjs';

const folder = process.argv[2];
if (!folder) {
  console.error('使い方: node .agents/skills/portfolio-book-authoring/scripts/check-book.mjs <カテゴリ/作品id>');
  process.exitCode = 1;
} else {
  try {
    const store = createContentStore(fileURLToPath(new URL('../../../../', import.meta.url)));
    const listing = await store.listBooks();
    const listed = listing.books.find(book => book.folder === folder);
    const catalogError = listing.errors.find(error => error.folder === folder);
    if (!listed) throw new Error(catalogError?.message ?? '作品フォルダが一覧にありません。');
    const book = await store.loadBook(folder);
    const internshipChapters = [
      ['about', 'インターンについて'], ['responsibilities', '担当範囲'],
      ['work', '実際に行ったこと'], ['decisions', '工夫・判断'],
      ['outcome', '成果'], ['reflection', '振り返り'],
    ];
    const emptyChapters = book.category === 'internship'
      ? book.pages.filter(page => internshipChapters.some(([id]) => id === page.id) && !page.blocks.length) : [];
    const issues = book.warnings.filter(warning => !emptyChapters.some(page => warning === `${page.file}: 本文が空です。`));
    if (book.category === 'internship') {
      const contents = book.pages.find(page => page.id === 'contents')?.blocks.filter(block => block.type === 'action' && block.kind === 'page') ?? [];
      const expectedIds = ['contents', ...internshipChapters.map(([id]) => id)];
      const actualIds = book.pages.map(page => page.id).filter(id => expectedIds.includes(id));
      if (actualIds.join() !== expectedIds.join() || contents.length !== internshipChapters.length || internshipChapters.some(([id, label], index) => contents[index]?.target !== id || contents[index]?.label !== `${String(index + 1).padStart(2, '0')}　${label}`)) {
        issues.push('Internshipは共通6章の名前・順序・目次の移動先を揃えてください。');
      }
    }
    if (!book.details?.period) issues.push('制作・在籍時期を確認し、book.ts.details.periodへ登録して表紙右下に表示してください。');
    for (const page of book.pages) {
      const text = [
        ...page.blocks.map(block => block.text ?? block.items?.join('\n') ?? block.alt ?? ''),
        page.presentation?.section ?? '', page.presentation?.callout ?? '',
        ...(page.presentation?.facts ?? []).map(fact => `${fact.label} ${fact.value}`),
      ].join('\n');
      if (/【(?:記入待ち|ここに|未入力)|入力予定|仮本文/.test(text)) issues.push(`${page.file}: 記入待ちの文が残っています。`);
    }
    console.log(JSON.stringify({
      folder, title: book.title, status: book.status, pages: book.pages.length,
      cover: { status: book.cover.status, image: Boolean(book.cover.image), imageTreatment: book.cover.imageTreatment, period: book.details?.period, links: Object.entries(book.links).filter(([, url]) => url).map(([label, url]) => ({ label, url })) },
      preview: `http://127.0.0.1:3015/?folder=${encodeURIComponent(folder)}`,
      emptyChapters: emptyChapters.map(page => page.id),
      issues, visualCheck: 'このコマンドは表示確認を行いません。登録済みDemo/GitHubの常時表示と中央のみのリンク操作、表紙右下の制作・在籍時期、全見開きをブラウザーで確認してください。',
    }, null, 2));
    if (issues.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
