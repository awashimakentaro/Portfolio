'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameState, FrameMotion, SceneId } from '@/contracts/scene';
import type { BookPublicState } from '@/features/history/book/BookExperience';
import { PortfolioUI } from '@/features/ui/PortfolioUI';
import { FrameEngine } from './frame-engine';

export function Portfolio() {
  const stage = useRef<HTMLElement>(null);
  const motion = useRef<FrameMotion>({ scene: 'profile', phase: 'playing', progress: 0, loopProgress: 0, direction: 1 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<FrameEngine | null>(null);
  const bookStatus = useRef<BookPublicState>('browsing');
  const pendingNavigation = useRef<SceneId | null>(null);
  const [closeRequest, setCloseRequest] = useState(0);
  const [state, setState] = useState<FrameState>({ scene: 'profile', phase: 'loading' });
  const [displayScene, setDisplayScene] = useState<SceneId>('profile');
  const displaySceneRef = useRef(displayScene); displaySceneRef.current = displayScene;
  const applyMotionStyle = useCallback((snapshot: FrameMotion) => {
    stage.current?.style.setProperty('--scene-progress', String(snapshot.progress));
    stage.current?.style.setProperty('--loop-progress', String(snapshot.loopProgress));
    stage.current?.style.setProperty('--motion-energy', String(snapshot.phase === 'playing' ? Math.sin(snapshot.progress * Math.PI) : .12 * (1 - Math.cos(snapshot.loopProgress * Math.PI * 2))));
  }, []);
  useEffect(() => {
    if (state.scene === displayScene || state.phase === 'loading' || state.phase === 'error') return;
    // Backward playback reaches the previous scene only at the end of the clip.
    // History also waits for its camera move on forward arrival.
    // `loop` is published only after the first decoded stop frame is painted.
    const returning = motion.current.direction === -1;
    if ((returning || state.scene === 'history') && state.phase !== 'loop') return;
    const delayed = state.scene === 'contact' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setDisplayScene(state.scene), delayed ? 750 : 0);
    return () => clearTimeout(timer);
  }, [state.scene, state.phase, displayScene]);
  useEffect(() => { if (motion.current.scene === displayScene) applyMotionStyle(motion.current); }, [displayScene, applyMotionStyle]);
  useEffect(() => {
    if (!canvas.current) return;
    let player: FrameEngine;
    try { player = new FrameEngine(canvas.current, setState, (snapshot) => {
      motion.current = snapshot;
      if (snapshot.scene === displaySceneRef.current) applyMotionStyle(snapshot);
    }); }
    catch { setState({ scene: 'profile', phase: 'error' }); return; }
    engine.current = player;
    let wheelAmount = 0;
    let lastWheelAt = 0;
    let touchY: number | null = null;
    let touchX = 0;
    function wheel(event: WheelEvent) {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (bookStatus.current !== 'browsing') { wheelAmount = 0; return; }
      const now = performance.now();
      if (player.getSnapshot().phase !== 'loop') { wheelAmount = 0; return; }
      if (now - lastWheelAt > 180 || Math.sign(wheelAmount) !== Math.sign(event.deltaY)) wheelAmount = 0;
      lastWheelAt = now;
      wheelAmount += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (Math.abs(wheelAmount) >= 30) {
        player.move(wheelAmount > 0 ? 1 : -1);
        wheelAmount = 0;
      }
    }
    function key(event: KeyboardEvent) {
      if (event.target instanceof Element && event.target.closest('button,a,input,textarea,select,[contenteditable="true"]')) return;
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); if (bookStatus.current === 'browsing') player.move(1); }
      if (['ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); if (bookStatus.current === 'browsing') player.move(-1); }
    }
    function touchStart(event: TouchEvent) {
      if (event.target instanceof Element && event.target.closest('button,a')) return;
      touchY = event.touches[0]?.clientY ?? null;
      touchX = event.touches[0]?.clientX ?? 0;
    }
    function touchEnd(event: TouchEvent) {
      if (touchY === null) return;
      const touch = event.changedTouches[0];
      const delta = touchY - (touch?.clientY ?? touchY);
      if (touch && Math.abs(delta) > 40 && Math.abs(delta) > Math.abs(touch.clientX - touchX) && bookStatus.current === 'browsing') player.move(delta > 0 ? 1 : -1);
      touchY = null;
    }
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchend', touchEnd, { passive: true });
    window.addEventListener('resize', player.resize);
    return () => {
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchend', touchEnd);
      window.removeEventListener('resize', player.resize);
      player.dispose(); engine.current = null;
    };
  }, []);
  const navigate = useCallback((scene: SceneId) => {
    if (bookStatus.current !== 'browsing') {
      pendingNavigation.current = scene;
      setCloseRequest((value) => value + 1);
      return;
    }
    engine.current?.navigate(scene);
  }, []);
  const handleBookStatusChange = useCallback((status: BookPublicState) => { bookStatus.current = status; }, []);
  const handleBookClosed = useCallback(() => {
    bookStatus.current = 'browsing';
    const target = pendingNavigation.current;
    pendingNavigation.current = null;
    if (target) engine.current?.navigate(target);
  }, []);
  return <main ref={stage} className="portfolio" data-scene={state.scene} data-phase={state.phase}>
    <canvas ref={canvas} className="frame-canvas" aria-hidden="true" />
    <PortfolioUI prepareBooks={state.phase === 'loop' || state.scene === 'history'} scene={displayScene} transitionPending={state.scene !== displayScene} motionRef={motion} onNavigate={navigate} onBookStatusChange={handleBookStatusChange} onBookClosed={handleBookClosed} closeRequest={closeRequest} />
    {state.phase === 'loading' && <div className="playback-status" role="status">映像を読み込んでいます</div>}
    {state.phase === 'error' && <div className="playback-status" role="alert">映像を読み込めませんでした。<button onClick={() => engine.current ? engine.current.retry() : window.location.reload()}>再試行</button></div>}
  </main>;
}
