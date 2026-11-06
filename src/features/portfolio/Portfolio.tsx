'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameState, FrameMotion, SceneId } from '@/contracts/scene';
import type { BookPublicState } from '@/features/history/book/BookExperience';
import { PortfolioUI } from '@/features/ui/PortfolioUI';
import { LoadingScreen, type IntroPhase } from '@/features/ui/LoadingScreen';
import { FrameEngine } from './frame-engine';
import { FrameAssets, FRAME_ASSET_COUNT } from './frame-assets';

export function Portfolio() {
  const stage = useRef<HTMLElement>(null);
  const motion = useRef<FrameMotion>({ scene: 'profile', phase: 'playing', progress: 0, loopProgress: 0, direction: 1 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<FrameEngine | null>(null);
  const bookStatus = useRef<BookPublicState>('browsing');
  const pendingNavigation = useRef<SceneId | null>(null);
  const [closeRequest, setCloseRequest] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [introPhase, setIntroPhase] = useState<IntroPhase>('loading');
  const interactive = useRef(false);
  const introReduced = useRef(false);
  const [loading, setLoading] = useState({ loaded: 0, total: FRAME_ASSET_COUNT, ready: false, error: false });
  const [state, setState] = useState<FrameState>({ scene: 'profile', phase: 'loading' });
  const [displayScene, setDisplayScene] = useState<SceneId>('profile');
  const displaySceneRef = useRef(displayScene); displaySceneRef.current = displayScene;
  const applyMotionStyle = useCallback((snapshot: FrameMotion) => {
    stage.current?.style.setProperty('--scene-progress', String(snapshot.progress));
    stage.current?.style.setProperty('--loop-progress', String(snapshot.loopProgress));
    stage.current?.style.setProperty('--motion-energy', String(snapshot.phase === 'playing' ? Math.sin(snapshot.progress * Math.PI) : .12 * (1 - Math.cos(snapshot.loopProgress * Math.PI * 2))));
  }, []);
  useEffect(() => {
    if (!loading.ready) return;
    if (introReduced.current) {
      setIntroPhase('done'); interactive.current = true; engine.current?.resume();
      return;
    }
    setIntroPhase('complete');
    const reveal = setTimeout(() => { setIntroPhase('revealing'); engine.current?.resume(); }, 480);
    const finish = setTimeout(() => { setIntroPhase('done'); interactive.current = true; }, 1680);
    return () => { clearTimeout(reveal); clearTimeout(finish); };
  }, [loading.ready]);
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
    let player: FrameEngine | null = null;
    const controller = new AbortController();
    const assets = new FrameAssets();
    interactive.current = false; setIntroPhase('loading');
    setLoading({ loaded: 0, total: FRAME_ASSET_COUNT, ready: false, error: false });
    setDisplayScene('profile');
    setState({ scene: 'profile', phase: 'loading' });
    bookStatus.current = 'browsing'; pendingNavigation.current = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    introReduced.current = reduced;
    let initialFramePainted = false;
    void assets.load(controller.signal, (loaded, total) => {
      if (!controller.signal.aborted) setLoading({ loaded, total, ready: false, error: false });
    }, reduced).then(() => {
      if (controller.signal.aborted || !canvas.current) return;
      player = new FrameEngine(canvas.current, assets, (snapshot) => {
        setState(snapshot);
        if (snapshot.phase === 'error') setLoading((current) => ({ ...current, error: true }));
        if (!initialFramePainted && (snapshot.phase === 'playing' || snapshot.phase === 'loop')) {
          initialFramePainted = true;
          player?.pause();
          setLoading((current) => ({ ...current, ready: true }));
        }
      }, (snapshot) => {
        motion.current = snapshot;
        if (snapshot.scene === displaySceneRef.current) applyMotionStyle(snapshot);
      }, reduced);
      engine.current = player;
    }).catch(() => {
      if (!controller.signal.aborted) setLoading((current) => ({ ...current, error: true }));
    });
    let wheelAmount = 0;
    let lastWheelAt = 0;
    let touchY: number | null = null;
    let touchX = 0;
    function wheel(event: WheelEvent) {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (!player || !interactive.current) return;
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
      if (!interactive.current) return;
      if (event.target instanceof Element && event.target.closest('button,a,input,textarea,select,[contenteditable="true"]')) return;
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); if (bookStatus.current === 'browsing') player?.move(1); }
      if (['ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); if (bookStatus.current === 'browsing') player?.move(-1); }
    }
    function touchStart(event: TouchEvent) {
      if (!interactive.current) return;
      if (event.target instanceof Element && event.target.closest('button,a')) return;
      touchY = event.touches[0]?.clientY ?? null;
      touchX = event.touches[0]?.clientX ?? 0;
    }
    function touchEnd(event: TouchEvent) {
      if (touchY === null || !interactive.current) return;
      const touch = event.changedTouches[0];
      const delta = touchY - (touch?.clientY ?? touchY);
      if (touch && Math.abs(delta) > 40 && Math.abs(delta) > Math.abs(touch.clientX - touchX) && bookStatus.current === 'browsing') player?.move(delta > 0 ? 1 : -1);
      touchY = null;
    }
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchend', touchEnd, { passive: true });
    const resize = () => player?.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
      window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchend', touchEnd);
      window.removeEventListener('resize', resize);
      controller.abort(); player?.dispose(); assets.dispose(); engine.current = null;
    };
  }, [loadAttempt, applyMotionStyle]);
  const navigate = useCallback((scene: SceneId) => {
    if (!interactive.current) return;
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
  return <main ref={stage} className="portfolio" data-scene={state.scene} data-phase={state.phase} data-intro-phase={introPhase}>
    <div className="portfolio-reveal" data-visible={introPhase === 'revealing' || introPhase === 'done'} inert={introPhase !== 'done'}>
    <canvas ref={canvas} className="frame-canvas" aria-hidden="true" />
    {(introPhase === 'revealing' || introPhase === 'done') && <PortfolioUI prepareBooks={state.phase === 'loop' || state.scene === 'history'} scene={displayScene} transitionPending={state.scene !== displayScene} motionRef={motion} onNavigate={navigate} onBookStatusChange={handleBookStatusChange} onBookClosed={handleBookClosed} closeRequest={closeRequest} />}
    </div>
    {introPhase !== 'done' && <LoadingScreen loaded={loading.loaded} total={loading.total} phase={introPhase} error={loading.error} onRetry={() => setLoadAttempt((value) => value + 1)} />}
    {loading.ready && state.phase === 'error' && <div className="playback-status" role="alert">映像を読み込めませんでした。<button onClick={() => setLoadAttempt((value) => value + 1)}>再試行</button></div>}
  </main>;
}
