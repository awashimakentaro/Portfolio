'use client';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { animated, to, useSpring, useSprings, type SpringValue } from '@react-spring/three';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CanvasTexture, Mesh, Texture } from 'three';
import { BOOK_PROJECTS, type BookCategoryId } from './data/projects';
import { BookLeaf } from './BookLeaf';
import { BookModel } from './BookModel';
import { BookRecommendations } from './BookRecommendations';
import { nearestBookSlot } from '@/lib/book-gallery.mjs';
import { BookAtmosphere } from './BookAtmosphere';
import { BookArrival } from './BookArrival';
import { BookLandingSparks } from './BookLandingSparks';
import type { FrameMotion } from '@/contracts/scene';
import { paginateMarkdown, paperTexture } from './textures';
import { parseBookDocument, spreadForPage } from '@/lib/book-document.mjs';
import type { BookAction } from '@/lib/book-document.mjs';
import { documentTexture, actionAt } from './document-textures';
import styles from './BookExperience.module.css';
export type { BookCategoryId } from './data/projects';
import type { BookPublicState } from '@/contracts/book';
export type { BookPublicState } from '@/contracts/book';
import { BookBoundary, BookFallback } from './BookBoundary';
type Phase = 'browsing' | 'opening' | 'reading' | 'dragging' | 'turning' | 'settling' | 'closing';
type Props = { categoryId: BookCategoryId; active: boolean; prepare?: boolean; motionRef?: RefObject<FrameMotion>; onStatusChange?: (status: BookPublicState) => void; closeRequest?: number; onClosed?: () => void };
type PointerEvent3D = ThreeEvent<PointerEvent>;
type CaptureTarget = { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
type LeafHandlers = { onClick: (event: ThreeEvent<MouseEvent>, index: number) => void; onPointerDown: (event: PointerEvent3D, index: number) => void; onPointerMove: (event: PointerEvent3D) => void; onPointerUp: (event: PointerEvent3D) => void; onPointerCancel: (event: PointerEvent3D) => void };

const modulo = (value: number, length: number) => ((value % length) + length) % length;

function PositionedBook({ slot, track, closedScale, openedScale, closedY, progress, children, wide, visibleRadius }: {
  slot: number; track: SpringValue<number>; closedScale: number; openedScale: number; closedY: number;
  progress: SpringValue<number>; children: ReactNode; wide: boolean; visibleRadius: number;
}) {
  const factorAt = (distance: number) => {
    const d = Math.abs(distance);
    const size = d <= 1 ? 1 - d * .3 : d <= 2 ? .7 - (d - 1) * .22 : .48;
    // Buffered copies enter continuously, but do not repeat the same title
    // beyond the three/five visible positions when the shelf is at rest.
    const edge = Math.max(0, Math.min(1, visibleRadius + 1 - d));
    return size * edge * edge * (3 - 2 * edge);
  };
  return <animated.group
    position-x={to([track, progress], (center, p) => {
      const offset = slot - center;
      return (offset * closedScale * (wide ? 1.78 : 2.45) - .86 * closedScale * factorAt(offset)) * (1 - p);
    })}
    position-y={progress.to((p) => closedY * (1 - p))}
    position-z={track.to((center) => -.35 * Math.min(4, Math.abs(slot - center)))}
    scale={to([track, progress], (center, p) => {
      const size = closedScale * factorAt(slot - center);
      return size + (openedScale - size) * p;
    })}>
    {children}
  </animated.group>;
}

function Stage({ categoryId, books, openProgress, leafProgress, textures, phase, handlers, select, motionRef, position, layoutElement, active, onPrepared }: {
  categoryId: BookCategoryId; books: typeof BOOK_PROJECTS; openProgress: SpringValue<number>;
  leafProgress: { progress: SpringValue<number> }[]; textures: ReturnType<typeof paperTexture>[]; phase: Phase; handlers: LeafHandlers; select: (index: number) => void;
  motionRef?: RefObject<FrameMotion>;
  position: number;
  layoutElement: RefObject<HTMLDivElement | null>;
  active: boolean; onPrepared: () => void;
}) {
  const { viewport, size, gl, scene, camera } = useThree();
  const [{ progress: closedProgress }] = useSpring(() => ({ progress: 0 }));
  const [{ center: track }, trackApi] = useSpring(() => ({ center: position, config: { tension: 110, friction: 25, clamp: true } }));
  useEffect(() => {
    trackApi.start({ center: position, immediate: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  }, [position, trackApi]);
  const arrival = useRef({ started: 0, slots: new Set<number>() });
  const wasActive = useRef(false);
  const entranceConsumed = useRef(false);
  if (active && !wasActive.current) {
    arrival.current = { started: performance.now(), slots: new Set(books.length > 1
      ? Array.from({ length: 5 }, (_, n) => position + n - 2)
      : books.map((_, n) => n)) };
    entranceConsumed.current = false;
  }
  wasActive.current = active;
  useEffect(() => { if (phase !== 'browsing') entranceConsumed.current = true; }, [phase]);
  const [readySlots, setReadySlots] = useState(() => new Set<number>());
  const markReady = useCallback((slot: number) => setReadySlots((current) => current.has(slot) ? current : new Set([...current, slot])), []);
  const notified = useRef(false);
  // Include the current spring position when several navigation requests arrive
  // before the previous slide settles. Visible outgoing books stay mounted.
  const rangeStart = Math.min(position, Math.floor(track.get())) - 4;
  const rangeEnd = Math.max(position, Math.ceil(track.get())) + 4;
  const slots = books.length > 1
    ? Array.from({ length: rangeEnd - rangeStart + 1 }, (_, n) => rangeStart + n)
    : books.map((_, n) => n);
  useEffect(() => {
    if (notified.current || readySlots.size < slots.length) return;
    // Upload even the buffered/offscreen covers, not only the materials that
    // happen to face the camera in the resting pose. Upload small batches over
    // frames, then compile shaders before starting the visible entrance.
    const gpuTextures = new Set<Texture>();
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value instanceof Texture) gpuTextures.add(value);
      }
    });
    const pending = [...gpuTextures];
    let canceled = false, frame = 0, index = 0;
    const finishPreparation = () => {
      if (canceled) return;
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
        if (!canceled) { notified.current = true; onPrepared(); }
      }); });
    };
    const prepareNext = () => {
      if (canceled) return;
      try {
        if (index < pending.length) {
          const started = performance.now();
          for (let uploaded = 0; uploaded < 2 && index < pending.length; uploaded++) {
            gl.initTexture(pending[index++]);
            // Keep expensive transfers to one per frame; spare frames can do two.
            if (performance.now() - started >= 4) break;
          }
          frame = requestAnimationFrame(prepareNext);
          return;
        }
        void gl.compileAsync(scene, camera).then(() => {
          if (canceled) return;
          gl.render(scene, camera);
          finishPreparation();
        }).catch(finishPreparation);
      } catch {
        // Prewarming is optional; an unsupported preparation operation should
        // fall back to normal rendering rather than leave the shelf hidden.
        finishPreparation();
      }
    };
    frame = requestAnimationFrame(prepareNext);
    return () => { canceled = true; cancelAnimationFrame(frame); };
  }, [readySlots.size, slots.length, onPrepared, gl, scene, camera]);
  const shadow = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(4, 1);
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, '#000000c0'); gradient.addColorStop(.35, '#00000080'); gradient.addColorStop(1, '#00000000');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => shadow.dispose(), [shadow]);
  // Canvas bleeds beyond the viewport; fit the books to the original HTML
  // region so extending the render surface does not change their final size.
  const layoutWidth = layoutElement.current?.clientWidth ?? size.width;
  const layoutHeight = layoutElement.current?.clientHeight ?? size.height;
  const unit = viewport.height / size.height;
  const topReserve = layoutHeight > 550 ? 142 : 120;
  const bottomReserve = 60;
  const availableHeight = unit * Math.max(layoutHeight * .35, layoutHeight - topReserve - bottomReserve);
  const wide = books.length >= 5;
  const visibleRadius = Math.min(2, Math.floor(books.length / 2));
  const closedScale = Math.min(availableHeight * .88 / 2.5, layoutWidth * unit / (wide ? 8.2 : 6.1));
  const closedY = -(topReserve - bottomReserve) * unit / 2;
  const openedScale = Math.min(layoutHeight * unit * .94 / 2.4, layoutWidth * unit * .98 / 3.6);
  // Include the entire rotated book below its launch pivot, not only its
  // center. Delayed books remain completely above the expanded canvas.
  const launchHeight = viewport.height / 2 - closedY + closedScale * 1.75 + .3;
  return <>
    <ambientLight intensity={1.05} />
    <directionalLight position={[-6, 5, 4]} color="#f1e5d2" intensity={3.1} />
    <directionalLight position={[4, 2, -1]} color="#b6cbdc" intensity={2.0} />
    <directionalLight position={[0, -2, 5]} intensity={0.35} />
    <BookAtmosphere motionRef={motionRef} reading={phase !== 'browsing'}>
    {slots.map((slot) => {
      const i = modulo(slot, books.length);
      const book = books[i];
      const selected = slot === position;
      const offset = slot - position;
      const visible = selected || phase === 'browsing';
      // Rank only the visible books; three-book shelves do not wait for hidden outer slots.
      const arrivalOrder = selected ? visibleRadius * 2
        : Math.max(0, visibleRadius - Math.abs(offset)) * 2 + (offset > 0 ? 1 : 0);
      return <BookArrival key={`${categoryId}-slot-${slot}`} order={arrivalOrder} runKey={Number(active)} enabled={active && phase === 'browsing'} allowEntrance={!entranceConsumed.current && arrival.current.slots.has(slot) && performance.now() - arrival.current.started < 1800} launchHeight={launchHeight}>
      <group visible={visible}><PositionedBook slot={slot} track={track} closedScale={closedScale} openedScale={openedScale} closedY={closedY} progress={selected ? openProgress : closedProgress} wide={wide} visibleRadius={visibleRadius}>
        <BookModel title={book.title} category={book.category} cover={book.cover} thumbnail={book.thumbnail} thumbnailFit={book.thumbnailFit} thumbnailInset={book.thumbnailInset} thumbnailBackground={book.thumbnailBackground} coverPeriod={book.coverPeriod} links={{ demo: book.demoUrl, github: book.githubUrl }} linksInteractive={selected && phase === 'browsing'} onReady={() => markReady(slot)} openProgress={selected ? openProgress : closedProgress} onCoverClick={visible ? () => select(slot) : undefined}>
          {selected && leafProgress.map((leaf, j) => <BookLeaf key={`${book.id}-leaf-${j}`} progress={leaf.progress} front={textures[j * 2]} back={textures[j * 2 + 1]} index={j} count={leafProgress.length}
            onClick={(event) => handlers.onClick(event, j)} onPointerDown={(event) => handlers.onPointerDown(event, j)} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp} onPointerCancel={handlers.onPointerCancel} onPointerOver={() => { if (phase === 'reading') document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }} />)}
        </BookModel>
      </PositionedBook></group></BookArrival>;
    })}
    </BookAtmosphere>
    <BookLandingSparks runKey={Number(active)} enabled={active && phase === 'browsing'} scale={closedScale} floor={closedY - closedScale * 1.2} wide={wide} />
    <animated.mesh position-y={openProgress.to((p) => closedY * (1 - p) -1.25 * (closedScale + (openedScale - closedScale) * p) - .04)} position-z={-.35}>
      <planeGeometry args={[closedScale * 4.1, closedScale * .5]} />
      <meshBasicMaterial map={shadow} transparent depthWrite={false} />
    </animated.mesh>
  </>;
}

function BookExperienceBody({ categoryId, active, prepare = false, motionRef, onStatusChange, closeRequest = 0, onClosed }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const [prepared, setPrepared] = useState(false);
  const [preparation, setPreparation] = useState({ category: categoryId, ready: false });
  if (preparation.category !== categoryId) setPreparation({ category: categoryId, ready: false });
  const stageReady = preparation.category === categoryId && preparation.ready;
  const onPrepared = useCallback(() => setPreparation((current) => current.category === categoryId ? { category: categoryId, ready: true } : current), [categoryId]);
  useEffect(() => { if (prepare || active) setPrepared(true); }, [prepare, active]);
  const present = active && stageReady;
  const books = useMemo(() => BOOK_PROJECTS.filter((book) => book.category === categoryId), [categoryId]);
  const [indices, setIndices] = useState<Record<BookCategoryId, number>>({ apps: 0, agents: 0, design: 0, internship: 0 });
  const position = indices[categoryId];
  const index = modulo(position, books.length);
  const selected = books[index];
  const [content, setContent] = useState({ id: '', markdown: '', images: new Map<string, HTMLImageElement>() });
  const loaded = content.id === selected.id;
  const markdown = loaded ? content.markdown : '';
  const images = content.images;
  const [loadError, setLoadError] = useState(false);
  const [phase, setPhase] = useState<Phase>('browsing');
  const phaseRef = useRef<Phase>('browsing');
  const [spread, setSpread] = useState(0);
  const spreadRef = useRef(0);
  const operation = useRef(0);
  const alive = useRef(true);
  const callbacks = useRef({ onStatusChange, onClosed }); callbacks.current = { onStatusChange, onClosed };
  const reduced = useRef(false);
  const documentPages = useMemo(() => selected.format === 'fixed-pages' && markdown ? parseBookDocument(markdown) : null, [markdown, selected.format]);
  const pages = useMemo(() => documentPages ?? paginateMarkdown(markdown), [documentPages, markdown]);
  const count = Math.max(1, Math.ceil(pages.length / 2));
  const maxSpread = Math.floor(pages.length / 2);
  const resources = useMemo(() => Array.from({ length: count * 2 }, (_, n) => {
    const page = documentPages?.[n];
    return page ? documentTexture(page, images) : { texture: paperTexture(documentPages ? '' : (pages[n] as string ?? '')), hotspots: [] };
  }), [documentPages, pages, count, images]);
  const textures = useMemo(() => resources.map(resource => resource.texture), [resources]);
  useEffect(() => () => textures.forEach((texture) => texture.dispose()), [textures]);
  const [{ progress: openProgress }, openApi] = useSpring(() => ({ progress: 0, config: { tension: 95, friction: 24, clamp: true } }));
  const [leafProgress, leafApi] = useSprings(count, () => ({ progress: 0, config: { mass: .85, tension: 100, friction: 23, clamp: true, precision: .0005 } }), [count]);
  const galleryDrag = useRef<{ x: number; y: number; pointer: number; moving: boolean } | null>(null);
  const horizontalWheel = useRef({ amount: 0, at: 0, committed: 0 });
  const drag = useRef<{ index: number; x: number; y: number; from: number; moved: boolean; pointer: number; target: CaptureTarget } | null>(null);
  const suppressClick = useRef(0);
  const setMode = useCallback((mode: Phase) => {
    phaseRef.current = mode; setPhase(mode);
    callbacks.current.onStatusChange?.(mode === 'browsing' ? 'browsing' : mode === 'closing' ? 'returning' : 'reading');
  }, []);
  useEffect(() => {
    alive.current = true;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = media.matches; }; update(); media.addEventListener('change', update);
    return () => { alive.current = false; operation.current++; media.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    fetch(selected.markdown, { signal: controller.signal }).then((response) => { if (!response.ok) throw Error('load'); return response.text(); })
      .then(async (text) => {
        await document.fonts.load('400 26px "Portfolio Text"').catch(() => []);
        const decoded = new Map<string, HTMLImageElement>();
        if (selected.format === 'fixed-pages') {
          const urls = new Set(parseBookDocument(text).flatMap(page => page.blocks.filter(block => block.type === 'image').map(block => block.src!)));
          await Promise.all([...urls].map(async url => { const image = new Image(); image.src = url; await image.decode(); decoded.set(url, image); }));
        }
        if (!controller.signal.aborted) { setContent({ id: selected.id, markdown: text, images: decoded }); }
      })
      .catch((error) => { if (!controller.signal.aborted && error.name !== 'AbortError') setLoadError(true); });
    return () => controller.abort();
  }, [selected]);
  useEffect(() => { spreadRef.current = 0; setSpread(0); leafApi.set({ progress: 0 }); openApi.set({ progress: 0 }); }, [selected]);

  const release = () => {
    const current = drag.current; drag.current = null;
    if (current) { try { current.target.releasePointerCapture(current.pointer); } catch { /* already released */ } }
  };
  const closeBook = async () => {
    if (phaseRef.current === 'browsing' || phaseRef.current === 'closing') return;
    // Invalidate awaiting open/turn operations before stopping their springs.
    // Returning from them must not commit a page or restore reading mode.
    const id = ++operation.current;
    release();
    suppressClick.current = performance.now() + 450;
    setMode('closing');
    openApi.stop(true); leafApi.stop(true);
    const config = { duration: 320, easing: (t: number) => 1 - Math.pow(1 - t, 3) };
    await Promise.all([
      ...openApi.start({ from: { progress: openProgress.get() }, to: { progress: 0 }, reset: true, immediate: reduced.current, config }),
      ...leafApi.start((i) => ({ from: { progress: leafProgress[i].progress.get() }, to: { progress: 0 }, reset: true, immediate: reduced.current, config })),
    ]);
    if (!alive.current || id !== operation.current) return;
    // Commit the exact resting pose once, without a chain of page returns.
    openApi.set({ progress: 0 }); leafApi.set({ progress: 0 });
    spreadRef.current = 0; setSpread(0);
    setMode('browsing'); callbacks.current.onClosed?.();
  };
  const closeLatest = useRef(closeBook); closeLatest.current = closeBook;
  const openBook = async () => {
    if (phaseRef.current !== 'browsing' || !loaded) return;
    const id = ++operation.current;
    setMode('opening');
    await Promise.all(openApi.start({ progress: 1, immediate: reduced.current, config: { duration: undefined, tension: 95, friction: 24, clamp: true } }));
    if (!alive.current || id !== operation.current) return;
    setMode('reading');
  };
  const animateLeaf = async (i: number, target: number, commit: boolean) => {
    const id = ++operation.current;
    setMode(commit ? 'turning' : 'settling');
    await Promise.all(leafApi.start((j) => j === i ? { progress: target, immediate: reduced.current, config: { duration: undefined, mass: .85, tension: 100, friction: 23, clamp: true, precision: .0005 } } : {}));
    if (!alive.current || id !== operation.current) return;
    if (commit) { spreadRef.current += target === 1 ? 1 : -1; setSpread(spreadRef.current); }
    setMode('reading');
  };
  const turn = (direction: number) => {
    if (phaseRef.current !== 'reading') return;
    const current = spreadRef.current;
    if (direction < 0 && current === 0) { void closeBook(); return; }
    if (direction > 0 && current >= maxSpread) return;
    void animateLeaf(direction > 0 ? current : current - 1, direction > 0 ? 1 : 0, true);
  };
  const jumpTo = async (pageId: string) => {
    if (phaseRef.current !== 'reading' || !documentPages) return;
    const page = documentPages.findIndex(page => page.id === pageId);
    if (page < 0) return;
    const target = spreadForPage(page);
    if (target === spreadRef.current) return;
    const id = ++operation.current;
    setMode('turning');
    while (spreadRef.current !== target) {
      const direction = target > spreadRef.current ? 1 : -1;
      const leaf = direction > 0 ? spreadRef.current : spreadRef.current - 1;
      await Promise.all(leafApi.start(j => j === leaf ? { progress: direction > 0 ? 1 : 0, immediate: reduced.current, config: { duration: 440, easing: (t: number) => t * t * (3 - 2 * t) } } : {}));
      if (!alive.current || id !== operation.current) return;
      spreadRef.current += direction; setSpread(spreadRef.current);
    }
    setMode('reading');
  };
  const runAction = (action: BookAction) => {
    if (phaseRef.current !== 'reading') return;
    if (action.kind === 'page') void jumpTo(action.target);
    else window.open(action.target, '_blank', 'noopener,noreferrer');
  };
  const pageAction = (event: ThreeEvent<MouseEvent | PointerEvent>, i: number) => {
    if (!event.uv) return;
    const back = event.face?.materialIndex === 5;
    const pageIndex = i * 2 + (back ? 1 : 0);
    return actionAt(resources[pageIndex]?.hotspots ?? [], event.uv.x, event.uv.y);
  };
  const lastClose = useRef(closeRequest);
  useEffect(() => { if (lastClose.current === closeRequest) return; lastClose.current = closeRequest; void closeLatest.current(); }, [closeRequest]);
  const actions = useRef({ turn, closeBook }); actions.current = { turn, closeBook };
  const cancelDrag = () => {
    const current = drag.current; if (!current) return;
    release(); suppressClick.current = performance.now() + 400;
    void animateLeaf(current.index, current.from, false);
  };
  const cancelLatest = useRef(cancelDrag); cancelLatest.current = cancelDrag;
  useEffect(() => {
    const cancelGallery = () => {
      const gesture = galleryDrag.current; galleryDrag.current = null;
      if (gesture && surface.current?.hasPointerCapture(gesture.pointer)) surface.current.releasePointerCapture(gesture.pointer);
    };
    const blur = () => { cancelLatest.current(); cancelGallery(); };
    const lost = (event: PointerEvent) => { if (drag.current?.pointer === event.pointerId) cancelLatest.current(); if (galleryDrag.current?.pointer === event.pointerId) cancelGallery(); };
    window.addEventListener('blur', blur); window.addEventListener('lostpointercapture', lost);
    return () => { window.removeEventListener('blur', blur); window.removeEventListener('lostpointercapture', lost); release(); cancelGallery(); openApi.stop(); leafApi.stop(); };
  }, [openApi, leafApi]);
  useEffect(() => {
    if (!active) { cancelLatest.current(); galleryDrag.current = null; }
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { void actions.current.closeBook(); return; }
      if (event.target instanceof Element && event.target.closest('button,a,input,textarea')) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); actions.current.turn(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); actions.current.turn(-1); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [active]);
  const step = (direction: number) => {
    if (phaseRef.current !== 'browsing' || books.length < 2) return;
    // Keep the rail unbounded: wrap only the displayed project index so a
    // last-to-first move travels one slot in the requested direction.
    setIndices((current) => ({ ...current, [categoryId]: current[categoryId] + direction }));
  };
  const handlers: LeafHandlers = {
    onClick: (event, i) => { event.stopPropagation(); if (performance.now() < suppressClick.current) return; const action = pageAction(event, i); if (action) { runAction(action); return; } if (i === spreadRef.current) turn(1); else if (i === spreadRef.current - 1) turn(-1); },
    onPointerDown: (event, i) => {
      event.stopPropagation(); if (phaseRef.current !== 'reading' || !event.uv || pageAction(event, i)) return;
      const from = i < spreadRef.current ? 1 : 0;
      if ((from === 0 && (i !== spreadRef.current || spreadRef.current >= maxSpread || event.uv.x < .72)) || (from === 1 && (i !== spreadRef.current - 1 || event.uv.x > .28))) return;
      const target = event.target as unknown as CaptureTarget;
      target.setPointerCapture(event.pointerId);
      drag.current = { index: i, x: event.clientX, y: event.clientY, from, moved: false, pointer: event.pointerId, target };
      setMode('dragging');
    },
    onPointerMove: (event) => {
      const current = drag.current; if (!current || current.pointer !== event.pointerId) return; event.stopPropagation();
      const dx = event.clientX - current.x;
      if (Math.hypot(dx, event.clientY - current.y) > 8) current.moved = true;
      if (current.moved) leafProgress[current.index].progress.set(Math.max(0, Math.min(1, current.from - dx / Math.max(180, window.innerWidth * .25))));
    },
    onPointerUp: (event) => {
      const current = drag.current; if (!current || current.pointer !== event.pointerId) return; event.stopPropagation();
      const progress = leafProgress[current.index].progress.get(); release();
      suppressClick.current = performance.now() + 400;
      const complete = !current.moved || (current.from === 0 ? progress > .38 : progress < .62);
      void animateLeaf(current.index, complete ? 1 - current.from : current.from, complete);
    },
    onPointerCancel: (event) => { if (drag.current?.pointer === event.pointerId) cancelLatest.current(); },
  };
  const [contextLost, setContextLost] = useState(false);
  const contextCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => contextCleanup.current?.(), []);
  if (contextLost) throw new Error('Book WebGL context lost');
  const publicStatus = phase === 'browsing' ? 'browsing' : phase === 'closing' ? 'returning' : 'reading';
  return <div ref={surface} className={styles.experience} data-present={present} data-stage-ready={stageReady} data-book-status={publicStatus} data-book-phase={phase} data-book-id={selected.id} data-spread={spread} data-book-count={books.length}
    onPointerDownCapture={(event) => {
      if (phaseRef.current !== 'browsing' || books.length < 2 || (event.target instanceof Element && event.target.closest('button,a'))) return;
      if (!galleryDrag.current) galleryDrag.current = { x: event.clientX, y: event.clientY, pointer: event.pointerId, moving: false };
    }}
    onPointerMoveCapture={(event) => {
      const gesture = galleryDrag.current; if (!gesture || gesture.pointer !== event.pointerId || phaseRef.current !== 'browsing') return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.moving && (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy))) { gesture.moving = true; event.currentTarget.setPointerCapture(event.pointerId); }
      if (gesture.moving) {
        event.stopPropagation();
      }
    }}
    onPointerUpCapture={(event) => {
      const gesture = galleryDrag.current; if (!gesture || gesture.pointer !== event.pointerId) return;
      galleryDrag.current = null; if (!gesture.moving) return;
      event.stopPropagation(); suppressClick.current = performance.now() + 450;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const dx = event.clientX - gesture.x;
      if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
    }}
    onPointerCancelCapture={(event) => { if (galleryDrag.current?.pointer !== event.pointerId) return; galleryDrag.current = null; suppressClick.current = performance.now() + 450; }}
    onWheel={(event) => {
      if (phaseRef.current !== 'browsing' || Math.abs(event.deltaX) <= Math.abs(event.deltaY) || books.length < 2 || event.ctrlKey) return;
      const now = performance.now(), wheel = horizontalWheel.current;
      if (now - wheel.committed < 650) return;
      if (now - wheel.at > 180 || Math.sign(wheel.amount) !== Math.sign(event.deltaX)) wheel.amount = 0;
      wheel.at = now; wheel.amount += event.deltaX;
      if (Math.abs(wheel.amount) > 45) { step(wheel.amount > 0 ? 1 : -1); wheel.amount = 0; wheel.committed = now; }
    }}>
    <div className={styles.halo} aria-hidden="true" />
    {prepared && <Canvas fallback={<BookFallback categoryId={categoryId} onStatusChange={onStatusChange} onClosed={onClosed} />} onCreated={({ gl }) => { const lost = () => setContextLost(true); gl.domElement.addEventListener('webglcontextlost', lost, { once: true }); contextCleanup.current = () => gl.domElement.removeEventListener('webglcontextlost', lost); }} frameloop={active ? 'always' : 'demand'} className={styles.canvas} camera={{ position: [0, 0, 8], fov: 25 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true }} onPointerMissed={() => { if (performance.now() >= suppressClick.current) void closeBook(); }}>
      <Stage key={categoryId} active={present} onPrepared={onPrepared} categoryId={categoryId} books={books} openProgress={openProgress} leafProgress={leafProgress} textures={textures} phase={phase} handlers={handlers} motionRef={motionRef} position={position} layoutElement={surface} select={(i) => { if (performance.now() < suppressClick.current) return; if (phaseRef.current === 'reading' && spreadRef.current === 0) { void closeBook(); return; } if (phaseRef.current !== 'browsing') return; if (i === position) void openBook(); else setIndices((current) => ({ ...current, [categoryId]: i })); }} />
    </Canvas>}
    {active && phase === 'browsing' && <div className={styles.browseDock}>
    <div className={styles.controls}>
      <button onClick={() => step(-1)} disabled={books.length < 2} aria-label="前の作品">←</button>
      <div className={styles.pagination} role="status" aria-live="polite" aria-atomic="true">
        <span className={styles.readerSummary}>{books.length}冊中{index + 1}冊目、{selected.title}</span>
        <span key={selected.id} className={styles.currentNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <span className={styles.numberDivider} aria-hidden="true">/</span>
        <span className={styles.totalNumber} aria-hidden="true">{String(books.length).padStart(2, '0')}</span>
      </div>
      <button onClick={() => step(1)} disabled={books.length < 2} aria-label="次の作品">→</button>
    </div>
      <BookRecommendations categoryId={categoryId} books={books} selectedId={selected.id} onSelect={(book) => {
        if (phaseRef.current !== 'browsing') return;
        const target = books.findIndex(candidate => candidate.id === book.id);
        setIndices(current => ({ ...current, [categoryId]: nearestBookSlot(current[categoryId], target, books.length) }));
      }} />
    </div>}
    {active && phase === 'browsing' && (selected.demoUrl || selected.githubUrl) && <div className={styles.coverLinks} aria-label="表紙のリンク">
      {selected.demoUrl && <a href={selected.demoUrl} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>Demo ↗</a>}
      {selected.githubUrl && <a href={selected.githubUrl} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>GitHub ↗</a>}
    </div>}
    {active && phase !== 'browsing' && documentPages && <nav className={styles.accessibleContents} aria-label="本の目次">
      {documentPages[0].blocks.filter(block => block.action?.kind === 'page').map(block => <button key={block.action!.target} disabled={phase !== 'reading'} onClick={() => void jumpTo(block.action!.target)}>{block.action!.label}</button>)}
    </nav>}
    {active && phase !== 'browsing' && <div className={styles.readerControls} aria-label={`${selected.title} の本文操作`}>
      <span className={styles.readerSummary} aria-live="polite">{selected.title} · {spread + 1} / {maxSpread + 1}</span>
      {documentPages && spread > 0 && <button className={styles.contentsReturn} onClick={() => void jumpTo('contents')} disabled={phase !== 'reading'}>目次へ</button>}
      <button onClick={() => void closeBook()} disabled={phase === 'closing'} aria-label="本を閉じて一覧に戻る">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        {phase === 'closing' ? '閉じています…' : '一覧に戻る'}
      </button>
    </div>}
    {active && !loaded && loadError && <p className={styles.notice} role="alert">本文を読み込めませんでした。画面を再読み込みしてください。</p>}
  </div>;
}

export function BookExperience(props: Props) {
  const available = BOOK_PROJECTS.some(book => book.category === props.categoryId);
  if (!available) return <BookFallback key={props.categoryId} {...props} empty />;
  return <BookBoundary fallback={<BookFallback key={props.categoryId} {...props} />}><BookExperienceBody {...props} /></BookBoundary>;
}
