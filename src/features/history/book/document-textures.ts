import { repeatsChapterHeading } from '@/lib/book-layout.mjs';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { DocumentPage, BookAction } from '@/lib/book-document.mjs';
export type PageHotspot = { x: number; y: number; width: number; height: number; action: BookAction };
const WIDTH=768, HEIGHT=1080;
const BODY='"Portfolio Text", "Hiragino Sans", sans-serif';
// Keep the fixed-page reader aligned with Book Studio's paper typography.
const TEXT_COLORS={body:'#c1c7cc',heading:'#d9bd91',label:'#a9a397',link:'#c9b78e'};
export function documentTexture(page: DocumentPage, images: Map<string, HTMLImageElement>) {
  const canvas=document.createElement('canvas');canvas.width=WIDTH * 1.5;canvas.height=HEIGHT * 1.5;
  const ctx=canvas.getContext('2d')!;ctx.scale(1.5,1.5);
  ctx.fillStyle='#1b1b1a';ctx.fillRect(0,0,WIDTH,HEIGHT);
  const shade=ctx.createLinearGradient(0,0,WIDTH,0);shade.addColorStop(0,'#0005');shade.addColorStop(.12,'#0000');shade.addColorStop(1,'#0002');ctx.fillStyle=shade;ctx.fillRect(0,0,WIDTH,HEIGHT);
  const hotspots:PageHotspot[]=[];
  if (page.header) {
    ctx.font=`400 25px ${BODY}`;ctx.fillStyle=TEXT_COLORS.label;ctx.fillText(page.header,94,64);
  }
  let y=128;
  const paragraph=(text:string,font:string,lineHeight:number,color:string) => {
    ctx.font=font;ctx.fillStyle=color;
    let line='';
    for(const char of text) { if(ctx.measureText(line+char).width>580&&line&&!/[、。！？）」』】]/u.test(char)){ctx.fillText(line,94,y);y+=lineHeight;line='';}line+=char; }
    if(line){ctx.fillText(line,94,y);y+=lineHeight;}
  };
  const toc=page.id==='contents';
  for(const block of page.blocks){
    if(block.type==='heading') {
      if (repeatsChapterHeading(block.text!, page.header)) continue;
      ctx.font=`400 27px ${BODY}`;ctx.fillStyle=TEXT_COLORS.heading;ctx.fillText(block.text!,94,y);y+=46;
    } else if(block.type==='image') {
      const image=images.get(block.src!);if(image){const scale=Math.min(580/image.naturalWidth,250/image.naturalHeight);const w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,94+(580-w)/2,y-16,w,h);y+=h+24;}
    } else if(block.type==='paragraph') {
      paragraph(block.text!,`400 26px ${BODY}`,43,TEXT_COLORS.body);y+=20;
    } else if(block.action) {
      const action=block.action;
      ctx.strokeStyle='#ffffff20';ctx.beginPath();ctx.moveTo(94,y+38);ctx.lineTo(674,y+38);ctx.stroke();
      ctx.font=`${toc?30:26}px ${BODY}`;ctx.fillStyle=action.kind==='page'?TEXT_COLORS.heading:TEXT_COLORS.link;ctx.fillText(action.label,94,y+8);ctx.textAlign='right';ctx.fillText(action.kind==='page'?'→':'↗',674,y+8);ctx.textAlign='left';
      hotspots.push({x:78,y:y-32,width:610,height:80,action});y+=toc?112:70;
    }
  }
  if(y>1000) throw Error(`${page.id}: 原稿が紙面に収まりません。ページを分けてください。`);
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
  return {texture,hotspots};
}
export function actionAt(hotspots:PageHotspot[], u:number,v:number){
  const x=u*WIDTH,y=(1-v)*HEIGHT;
  return hotspots.find(hit=>x>=hit.x&&x<=hit.x+hit.width&&y>=hit.y&&y<=hit.y+hit.height)?.action;
}
