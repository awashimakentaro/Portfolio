import { chapterHeaders } from './book-layout.mjs';
/** @typedef {{kind:'page'|'url', label:string, target:string}} BookAction */
/** @typedef {{type:'heading'|'paragraph'|'image'|'action', text?:string, src?:string, alt?:string, action?:BookAction}} BookBlock */
/** @typedef {{id:string, blocks:BookBlock[], header?:string}} DocumentPage */
/** Explicit page boundaries keep authoring and the physical page order identical. */
export function parseBookDocument(source) {
  const sections = [...source.matchAll(/^<!-- page:([a-z0-9-]+) -->\s*\n([\s\S]*?)(?=^<!-- page:|$(?![\s\S]))/gm)];
  /** @type {DocumentPage[]} */
  const pages = sections.map(([, id, body]) => {
    /** @type {BookBlock[]} */
    const blocks = [];
    for (const chunk of body.trim().split(/\n\s*\n/)) {
      for (const line of chunk.split('\n')) {
        const heading = /^#{1,3}\s+(.+)$/.exec(line);
        const image = /^!\[([^\]]+)\]\(([^\s)]+)\)$/.exec(line);
        const action = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(line);
        if (heading) blocks.push({type:'heading',text:heading[1]});
        else if (image) blocks.push({type:'image',src:image[2],alt:image[1]});
        else if (action) {
          const target = action[2];
          if (target.startsWith('#')) blocks.push({type:'action',action:{kind:'page',label:action[1],target:target.slice(1)}});
          else { const url=new URL(target); if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw Error('不正な本文リンクです。'); blocks.push({type:'action',action:{kind:'url',label:action[1],target}}); }
        } else if (line.trim()) blocks.push({type:'paragraph',text:line.replace(/\*\*/g,'')});
      }
    }
    return {id,blocks};
  });
  if (!pages.length) throw Error('明示的なページがありません。');
  const ids=new Set(pages.map(page=>page.id));
  if(ids.size!==pages.length) throw Error('ページidが重複しています。');
  for(const page of pages) for(const block of page.blocks) if(block.action?.kind==='page'&&!ids.has(block.action.target)) throw Error(`目次の移動先がありません: ${block.action.target}`);
  const headers = chapterHeaders(pages.map(page => page.id), pages.flatMap(page => page.blocks.filter(block => block.action?.kind === 'page').map(block => block.action)));
  return pages.map((page, index) => ({ ...page, header: headers[index] }));
}
/** Page zero is the first right-hand face; flipping sheet zero exposes pages 1+2. */
export const spreadForPage = page => Math.floor((page + 1) / 2);
