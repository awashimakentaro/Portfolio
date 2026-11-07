import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createContentStore, configuration } from './book-preview/content.mjs';
import { parseBookDocument } from '../src/lib/book-document.mjs';

// Explicit local publication action. Ordinary draft saves never call this.
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=process.argv[2];
const store=createContentStore(root);
await store.loadBook(folder); // Validate page order, images and the contents targets first.
const directory=path.join(root,'books',folder);
const book=await configuration(path.join(directory,'book.ts'));
const cover=await configuration(path.join(directory,'cover.ts'));
const publication=await configuration(path.join(directory,'publication.ts'));
const parts=[];
for(const page of book.pages){
  const raw=await readFile(path.join(directory,page.file),'utf8');
  parts.push(`<!-- page:${page.id} -->\n\n${raw.replace(/!\[([^\]]+)\]\(([^)]+)\)/g,(_all,alt,image)=>`![${alt}](./${path.relative(directory,path.resolve(path.dirname(path.join(directory,page.file)),image)).split(path.sep).join('/')})`)}`);
}
const snapshot=parts.join('\n\n');parseBookDocument(snapshot);
await writeFile(path.join(directory,'published.md'),snapshot);
const { thumbnail, thumbnailFit, thumbnailInset, thumbnailBackground, coverPeriod, ...existing } = publication;
const next={...existing,title:book.title,format:'fixed-pages',links:book.links,...(book.details?.period ? {coverPeriod:book.details.period}:{}),...(cover.image?{thumbnail:cover.image.file,thumbnailFit:cover.image.fit ?? 'cover',...(cover.image.inset !== undefined?{thumbnailInset:cover.image.inset}:{}),...(cover.image.background?{thumbnailBackground:cover.image.background}:{})}:{})};
await writeFile(path.join(directory,'publication.ts'),`import type { BookPublication } from '../../types';\nexport default ${JSON.stringify(next,null,2)} satisfies BookPublication;\n`);
console.log(`Snapshot prepared: ${folder}. Run npm run book:sync to generate local site assets.`);
