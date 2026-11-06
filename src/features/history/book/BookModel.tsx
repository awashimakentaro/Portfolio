'use client';

import { animated, type SpringValue } from '@react-spring/three';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackSide, CanvasTexture, ExtrudeGeometry, RepeatWrapping, Shape, SRGBColorSpace } from 'three';
import type { BookCategoryId } from './data/projects';

const WIDTH = 1.72;
const HEIGHT = 2.4;
const BOARD_DEPTH = 0.045;
export type BookModelProps = {
  title: string;
  category: BookCategoryId;
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

const coverFiles: Record<BookCategoryId, string> = {
  apps: 'App.png', agents: 'Agent.png', design: 'design.png', internship: 'internship.png',
};

type CoverSurface = { texture: CanvasTexture; aspect: number };

type CoverArtwork = { image: HTMLImageElement; left: number; top: number; width: number; height: number };
// Four bounded entries: decode and scan each category image only once, rather
// than reading all of its pixels separately for every book in the carousel.
const artworks = new Map<BookCategoryId, Promise<CoverArtwork | null>>();
function loadArtwork(category: BookCategoryId): Promise<CoverArtwork | null> {
  const cached = artworks.get(category);
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
      } catch { artworks.delete(category); resolve(null); }
    };
    image.onerror = () => { artworks.delete(category); resolve(null); };
    image.src = `/book-covers/${coverFiles[category]}`;
  });
  artworks.set(category, pending);
  return pending;
}

/** Preserve the cropped artwork and alpha; each book owns its title texture. */
function coverSurface(artwork: CoverArtwork | null, title: string): CoverSurface {
  const width = artwork?.width ?? 900, height = artwork?.height ?? 1200;
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
  const context = canvas.getContext('2d')!;
  if (artwork) context.drawImage(artwork.image, artwork.left, artwork.top, width, height, 0, 0, canvas.width, canvas.height);
  context.textAlign = 'center'; context.fillStyle = '#f2eee5';
  context.shadowColor = '#000'; context.shadowBlur = 12;
  let fontSize = 76;
  const words = title.split(' ');
  const lines = title.length > 18 && words.length > 1
    ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
    : [title];
  do {
    context.font = `${fontSize}px Georgia, serif`;
    if (lines.every(line => context.measureText(line).width <= 790)) break;
    fontSize -= 2;
  } while (fontSize > 36);
  const startY = canvas.height * .78 - (lines.length - 1) * fontSize * .55;
  lines.forEach((line, index) => context.fillText(line, 512, startY + index * fontSize * 1.2));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
  return { texture, aspect: width / height };
}

/** Hinge and whole-book rotation are parent-owned; the cover is rigid on hover. */
export function BookModel({ title, category, openProgress, children, onCoverClick, onReady }: BookModelProps) {
  const geometry = useMemo(() => boardGeometry(WIDTH, HEIGHT, BOARD_DEPTH), []);
  const spineGeometry = useMemo(() => boardGeometry(0.145, HEIGHT, 0.24), []);
  const bump = useMemo(clothTexture, []);
  const [surface, setSurface] = useState<CoverSurface | null>(null);
  const ready = useRef(onReady); ready.current = onReady;
  useEffect(() => { if (surface) ready.current?.(); }, [surface]);
  useEffect(() => () => { geometry.dispose(); spineGeometry.dispose(); bump.dispose(); }, [geometry, spineGeometry, bump]);
  useEffect(() => {
    let canceled = false;
    let created: CoverSurface | null = null;
    setSurface(null);
    void loadArtwork(category).then((artwork) => {
      if (canceled) return;
      created = coverSurface(artwork, title);
      setSurface(created);
    });
    return () => {
      canceled = true;
      created?.texture.dispose(); document.body.style.cursor = '';
    };
  }, [category, title]);
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); document.body.style.cursor = ''; onCoverClick?.(event); };
  const pointerOver = () => { if (openProgress.get() < .002) document.body.style.cursor = 'pointer'; };
  const pointerOut = () => { document.body.style.cursor = ''; };

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
      {surface && <mesh position={[WIDTH / 2, 0, 0.034]} onClick={onCoverClick ? click : undefined} onPointerOver={onCoverClick ? pointerOver : undefined} onPointerOut={onCoverClick ? pointerOut : undefined}>
        <planeGeometry args={[HEIGHT * surface.aspect, HEIGHT]} />
        <meshStandardMaterial map={surface.texture} transparent alphaTest={0.04} roughness={0.94} metalness={0} />
      </mesh>}
      <mesh position={[WIDTH / 2, 0, -0.034]}>
        <planeGeometry args={[WIDTH - 0.065, HEIGHT - 0.065]} />
        <meshStandardMaterial color="#1c1e20" roughness={0.96} side={BackSide} />
      </mesh>
    </animated.group>
    {children}
  </group>;
}
