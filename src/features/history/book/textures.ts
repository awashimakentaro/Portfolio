import { CanvasTexture, SRGBColorSpace } from 'three';

const WIDTH = 768, HEIGHT = 1080, FONT = '32px serif';
export function paginateMarkdown(markdown: string): string[] {
  const text = markdown.replace(/^---[\s\S]*?---\s*/, '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*/g, '').trim();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = FONT;
  const pages: string[] = [];
  let lines: string[] = [], line = '';
  const pushLine = () => {
    lines.push(line); line = '';
    if (lines.length === 14) { pages.push(lines.join('\n')); lines = []; }
  };
  const sections = text.split(/\n\s*\n/);
  if (sections.length > 1) sections.splice(0, 2, `${sections[0]}\n\n${sections[1]}`);
  for (const section of sections) {
    for (const character of section) {
      if (character === '\n') { pushLine(); continue; }
      if (context.measureText(line + character).width > 588 && line) pushLine();
      line += character;
    }
    if (line) pushLine();
    if (lines.length) { pages.push(lines.join('\n')); lines = []; }
  }
  if (line) pushLine();
  if (lines.length) pages.push(lines.join('\n'));
  return pages.length ? pages : ['本文は準備中です。'];
}
export function paperTexture(text: string, number?: number): CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#25262a'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let n = 0; n < 18000; n++) {
    ctx.fillStyle = n % 2 ? '#ffffff05' : '#00000009';
    ctx.fillRect((n * 251.3) % WIDTH, (n * 113.7) % HEIGHT, 1, 1);
  }
  const gutter = ctx.createLinearGradient(0, 0, WIDTH, 0);
  gutter.addColorStop(0, '#00000060'); gutter.addColorStop(.13, '#00000000');
  gutter.addColorStop(.85, '#00000000'); gutter.addColorStop(1, '#00000018');
  ctx.fillStyle = gutter; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.font = FONT; ctx.fillStyle = '#eeeae2';
  text.split('\n').forEach((line, index) => ctx.fillText(line, 90, 150 + index * 54));
  if (number !== undefined) { ctx.font = '20px serif'; ctx.fillStyle = '#a3a09b'; ctx.textAlign = 'center'; ctx.fillText(String(number), WIDTH / 2, 1010); }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
