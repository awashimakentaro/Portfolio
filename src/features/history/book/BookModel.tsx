'use client';

import { coverWindowRect, coverCrop, coverContainRect, COVER_COPY, LINK_ICONS, coverLinkRects, coverLinkAt, coverPeriodLabel, coverDateLayout } from '@/lib/book-layout.mjs';
import { animated, type SpringValue } from '@react-spring/three';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackSide, CanvasTexture, ExtrudeGeometry, RepeatWrapping, Shape, SRGBColorSpace } from 'three';

import type { BookCategoryId } from './data/projects';
import { CoverLinkFeedback, type CoverLinkRegion } from './CoverLinkFeedback';

const WIDTH = 1.72;
const HEIGHT = 2.4;
const BOARD_DEPTH = 0.045;
export type BookModelProps = {
  title: string;
  category: BookCategoryId;
  cover: string;
  thumbnail?: string;
  thumbnailFit?: 'cover' | 'contain';
  thumbnailInset?: number;
  thumbnailBackground?: string;
  coverPeriod?: string;
  linksInteractive: boolean;
  links?: { demo?: string; github?: string };
  openProgress: SpringValue<number>;
  children?: ReactNode;
  onReady?: () => void;
  onCoverClick?: (event: ThreeEvent<MouseEvent>) => void;
};

/** Beveled hard boards are measured from the binding at x=0. */
function boardGeometry(width: number, height: number, depth: number) {
  const radius = Math.min(0.025, width / 5);
  const half = height / 2;
  const shape = new Shape();
  shape.moveTo(radius, -half);
  shape.lineTo(width - radius, -half);
  shape.quadraticCurveTo(width, -half, width, -half + radius);
  shape.lineTo(width, half - radius);
  shape.quadraticCurveTo(width, half, width - radius, half);
  shape.lineTo(radius, half);
  shape.quadraticCurveTo(0, half, 0, half - radius);
  shape.lineTo(0, -half + radius);
  shape.quadraticCurveTo(0, -half, radius, -half);
  const geometry = new ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSegments: 3, steps: 1,
    bevelSize: 0.009, bevelThickness: 0.009, curveSegments: 5,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function clothTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(256, 256);
  let seed = 149;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const weave = ((x % 4 < 2) !== (y % 4 < 2)) ? 20 : -15;
    const value = 128 + weave + (seed % 29) - 14;
    image.data.set([value, value, value, 255], (y * 256 + x) * 4);
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(2.8, 4);
  return texture;
}

type CoverSurface = { texture: CanvasTexture; aspect: number; links: { x: number; y: number; width: number; height: number; url: string }[] };

type CoverArtwork = { image: HTMLImageElement; left: number; top: number; width: number; height: number };
// Four bounded entries: decode and scan each category image only once, rather
// than reading all of its pixels separately for every book in the carousel.
const artworks = new Map<string, Promise<CoverArtwork | null>>();
function loadArtwork(cover: string): Promise<CoverArtwork | null> {
  const cached = artworks.get(cover);
  if (cached) return cached;
  const pending = new Promise<CoverArtwork | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const source = document.createElement('canvas');
        source.width = image.naturalWidth; source.height = image.naturalHeight;
        const context = source.getContext('2d', { willReadFrequently: true })!;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, source.width, source.height).data;
        let left = source.width, top = source.height, right = -1, bottom = -1;
        for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
          if (pixels[(y * source.width + x) * 4 + 3] < 40) continue;
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
        if (right < left || bottom < top) { left = 0; top = 0; right = source.width - 1; bottom = source.height - 1; }
        left = Math.max(0, left - 2); top = Math.max(0, top - 2);
        resolve({ image, left, top, width: Math.min(source.width - left, right - left + 3), height: Math.min(source.height - top, bottom - top + 3) });
      } catch { artworks.delete(cover); resolve(null); }
    };
    image.onerror = () => { artworks.delete(cover); resolve(null); };
    image.src = cover;
  });
  artworks.set(cover, pending);
  return pending;
}

/** Preserve the cropped artwork and alpha; each book owns its title texture. */
function coverSurface(artwork: CoverArtwork | null, title: string, thumbnail: HTMLImageElement | null, links?: { demo?: string; github?: string }, thumbnailFit: 'cover' | 'contain' = 'cover', thumbnailBackground = '#151616', coverPeriod?: string, thumbnailInset = .08, companyCover = false): CoverSurface {
  const width = artwork?.width ?? 900, height = artwork?.height ?? 1200;
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
  const context = canvas.getContext('2d')!;
  if (artwork) context.drawImage(artwork.image, artwork.left, artwork.top, width, height, 0, 0, canvas.width, canvas.height);
  if (thumbnail) {
    const crop = artwork ?? { left: 0, top: 0, width: 1122, height: 1402 };
    const window = coverWindowRect(crop, canvas.width, canvas.height);
    if (thumbnailFit === 'contain') {
      context.fillStyle = thumbnailBackground;
      context.fillRect(window.x, window.y, window.width, window.height);
      const target = coverContainRect(thumbnail.naturalWidth, thumbnail.naturalHeight, window.width, window.height, thumbnailInset);
      context.drawImage(thumbnail, window.x + target.x, window.y + target.y, target.width, target.height);
    } else {
      const source = coverCrop(thumbnail.naturalWidth, thumbnail.naturalHeight, window.width, window.height);
      context.drawImage(thumbnail, source.x, source.y, source.width, source.height, window.x, window.y, window.width, window.height);
    }
  }
  context.textAlign = 'center'; context.fillStyle = '#f2eee5';
  context.shadowColor = '#000'; context.shadowBlur = 12;
  let fontSize = 76;
  const words = title.split(' ');
  const lines = thumbnail && title.length > 18 && words.length > 1
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [title];
  do {
    context.font = `${fontSize}px "Yu Mincho", Georgia, serif`;
    if (lines.every(line => context.measureText(line).width <= 790)) break;
    fontSize -= 2;
  } while (fontSize > 36);
  const startY = canvas.height * (companyCover ? COVER_COPY.periodTitleY : thumbnail ? COVER_COPY.titleY : COVER_COPY.textOnlyTitleY) - (lines.length - 1) * fontSize * .55;
  lines.forEach((line, index) => context.fillText(line, 512, startY + index * fontSize * 1.2));
  if (coverPeriod) {
    const date = coverDateLayout(artwork ?? { left: 0, top: 0, width: 1122, height: 1402 }, canvas.width, canvas.height);
    const text = coverPeriodLabel(coverPeriod);
    let dateFontSize = date.fontSize;
    context.shadowBlur = 0;
    context.fillStyle = '#c9c1b0';
    context.font = `${dateFontSize}px Georgia, "Yu Mincho", serif`;
    while (context.measureText(text).width > date.maxWidth && dateFontSize > 24) {
      context.font = `${--dateFontSize}px Georgia, "Yu Mincho", serif`;
    }
    context.textAlign = 'right';
    context.fillText(text, date.x, date.y);
    context.textAlign = 'center';
  }
  const actions = [{ key: 'demo' as const, label: 'Demo', url: links?.demo }, { key: 'github' as const, label: 'GitHub', url: links?.github }].filter(item => item.url);
  const hotspots: CoverSurface['links'] = [];
  context.font = '400 46px "Hiragino Sans", "Yu Gothic", sans-serif'; context.shadowBlur = 0;
  const buttons = coverLinkRects(actions.length, canvas.width, canvas.height);
  actions.forEach((action, i) => {
    const button = buttons[i];
    context.beginPath(); context.roundRect(button.x, button.y, button.width, button.height, button.height / 2);
    context.fillStyle = '#0b0d10e8'; context.fill();
    context.lineWidth = 2.5; context.strokeStyle = '#bbb29b99'; context.stroke();
    const y = button.y + button.height / 2 + 16;
    const textWidth = context.measureText(action.label).width, totalWidth = textWidth + 66;
    const left = button.x + (button.width - totalWidth) / 2;
    const icon = LINK_ICONS[action.key];
    context.save(); context.translate(left, button.y + (button.height - 42) / 2); context.scale(1.75, 1.75);
    context.lineWidth = 1.5; context.strokeStyle = '#eeeae0'; context.fillStyle = '#eeeae0';
    if (icon.fill) context.fill(new Path2D(icon.path)); else context.stroke(new Path2D(icon.path));
    context.restore();
    context.fillStyle = '#eeeae0'; context.textAlign = 'left'; context.fillText(action.label, left + 66, y); context.textAlign = 'center';
    hotspots.push({ x: button.x / canvas.width, y: button.y / canvas.height, width: button.width / canvas.width, height: button.height / canvas.height, url: action.url! });
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
  return { texture, aspect: width / height, links: hotspots };
}

/** Hinge and whole-book rotation are parent-owned; the cover is rigid on hover. */
export function BookModel({ title, category, cover, thumbnail, thumbnailFit, thumbnailInset, thumbnailBackground, coverPeriod, links, linksInteractive, openProgress, children, onCoverClick, onReady }: BookModelProps) {
  const geometry = useMemo(() => boardGeometry(WIDTH, HEIGHT, BOARD_DEPTH), []);
  const spineGeometry = useMemo(() => boardGeometry(0.145, HEIGHT, 0.24), []);
  const bump = useMemo(clothTexture, []);
  const [surface, setSurface] = useState<CoverSurface | null>(null);
  const hoveredLink = useRef<CoverLinkRegion | undefined>(undefined);
  const ready = useRef(onReady); ready.current = onReady;
  useEffect(() => {
    if (surface) ready.current?.();
    // Release the previous texture only after its replacement has been committed.
    return () => { surface?.texture.dispose(); };
  }, [surface]);
  useEffect(() => () => { geometry.dispose(); spineGeometry.dispose(); bump.dispose(); }, [geometry, spineGeometry, bump]);
  const demo = links?.demo, github = links?.github;
  useEffect(() => { if (!linksInteractive) hoveredLink.current = undefined; }, [linksInteractive]);
  useEffect(() => {
    let canceled = false;
    // Keep the current cover visible while the replacement is being prepared.
    hoveredLink.current = undefined;
    const loadThumbnail = async () => { if (!thumbnail) return null; const image = new Image(); image.src = thumbnail; try { await image.decode(); return image; } catch { return null; } };
    void Promise.all([loadArtwork(cover), loadThumbnail()]).then(([artwork, image]) => {
      if (canceled) return;
      const created = coverSurface(artwork, title, image, { demo, github }, thumbnailFit, thumbnailBackground, coverPeriod, thumbnailInset, category === 'internship');
      setSurface(created);
    });
    return () => {
      canceled = true;
      document.body.style.cursor = ''; hoveredLink.current = undefined;
    };
  }, [cover, title, category, thumbnail, thumbnailFit, thumbnailInset, thumbnailBackground, coverPeriod, demo, github]);
  const click = (event: ThreeEvent<MouseEvent>) => { hoveredLink.current = undefined; event.stopPropagation(); document.body.style.cursor = ''; onCoverClick?.(event); };
  const coverClick = (event: ThreeEvent<MouseEvent>) => {
    if (linksInteractive && event.uv && openProgress.get() < .002) {
      const y = 1 - event.uv.y;
      const action = coverLinkAt(surface?.links ?? [], event.uv.x, y);
      if (action && (action.url === demo || action.url === github)) { event.stopPropagation(); window.open(action.url, '_blank', 'noopener,noreferrer'); return; }
    }
    click(event);
  };
  const pointerOver = () => { if (openProgress.get() < .002) document.body.style.cursor = 'pointer'; };
  const pointerOut = () => { document.body.style.cursor = ''; hoveredLink.current = undefined; };
  const pointerMove = (event: ThreeEvent<PointerEvent>) => {
    hoveredLink.current = linksInteractive && event.uv && openProgress.get() < .002
      ? coverLinkAt(surface?.links ?? [], event.uv.x, 1 - event.uv.y) : undefined;
  };

  return <group>
    <mesh geometry={geometry} position={[0, 0, -0.08]} castShadow receiveShadow>
      <meshStandardMaterial color="#24282a" roughness={0.83} metalness={0.025} bumpMap={bump} bumpScale={0.004} />
    </mesh>

    {/* The small cut-in leaves the boards and binding visibly thicker than the paper. */}
    <mesh position={[0.8, 0, 0.025]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 2.25, 0.14]} />
      <meshStandardMaterial color="#242628" roughness={0.98} />
    </mesh>
    {Array.from({ length: 12 }, (_, index) => {
      const z = -0.034 + index * 0.011;
      return <group key={index}>
        <mesh position={[1.602, 0, z]}>
          <boxGeometry args={[0.004, 2.248, 0.002]} />
          <meshStandardMaterial color={index % 3 === 0 ? '#414345' : '#333638'} roughness={1} />
        </mesh>
        <mesh position={[0.8, 1.126, z]}>
          <boxGeometry args={[1.6, 0.003, 0.002]} />
          <meshStandardMaterial color="#383b3d" roughness={1} />
        </mesh>
      </group>;
    })}

    {/* The outer binding folds behind the gutter when the boards open. */}
    <animated.group position-z={openProgress.to((progress) => -progress * 0.3)}>
      <mesh geometry={spineGeometry} position={[-0.035, 0, 0.065]} castShadow receiveShadow>
        <meshStandardMaterial color="#202427" roughness={0.83} metalness={0.02} bumpMap={bump} bumpScale={0.007} />
      </mesh>
    </animated.group>

    <animated.group position-z={openProgress.to((progress) => 0.22 - progress * 0.275)} rotation-y={openProgress.to((progress) => -Math.PI * progress)}>
      <mesh geometry={geometry} onClick={onCoverClick ? click : undefined} castShadow receiveShadow onPointerOver={onCoverClick ? pointerOver : undefined} onPointerOut={onCoverClick ? pointerOut : undefined}>
        <meshStandardMaterial color="#171a1c" roughness={0.9} metalness={0.015} bumpMap={bump} bumpScale={0.004} />
      </mesh>
      {surface && <mesh position={[WIDTH / 2, 0, 0.034]} onPointerMove={onCoverClick ? pointerMove : undefined} onClick={onCoverClick ? coverClick : undefined} onPointerOver={onCoverClick ? pointerOver : undefined} onPointerOut={onCoverClick ? pointerOut : undefined}>
        <planeGeometry args={[HEIGHT * surface.aspect, HEIGHT]} />
        <meshStandardMaterial map={surface.texture} transparent alphaTest={0.04} roughness={0.94} metalness={0} />
      </mesh>}
      {surface && surface.links.length > 0 && <CoverLinkFeedback hovered={hoveredLink} aspect={surface.aspect} height={HEIGHT} width={WIDTH} openProgress={openProgress} />}
      <mesh position={[WIDTH / 2, 0, -0.034]}>
        <planeGeometry args={[WIDTH - 0.065, HEIGHT - 0.065]} />
        <meshStandardMaterial color="#1c1e20" roughness={0.96} side={BackSide} />
      </mesh>
    </animated.group>
    {children}
  </group>;
}
