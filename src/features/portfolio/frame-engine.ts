import { sceneIds, type SceneId, type FrameState, type FrameMotion, type MoveResult } from '@/contracts/scene';
import { FrameAssets, framePath } from './frame-assets';

const directories = ['idle', 'one', 'two', 'three'];
const FRAME_MS = 33;
const FADE_MS = 220;
const CACHE_LIMIT = 96;
type Entry = { image: HTMLImageElement; status: 'loading' | 'ready' | 'error' };
type Clip = { directory: string; frame: number; step: 1 | -1; end: number; loop: boolean; destination: number };
type Fade = { image: HTMLCanvasElement; started: number | null; holdHead: boolean };

/** Owns canvas playback only. All user input is routed by Portfolio. */
export class FrameEngine {
  private context: CanvasRenderingContext2D;
  private cache = new Map<string, Entry>();
  private state: FrameState = { scene: 'profile', phase: 'loading' };
  private clip: Clip = { directory: 'idle', frame: 1, step: 1, end: 121, loop: false, destination: 0 };
  private raf = 0;
  private disposed = false;
  private paused = false;
  private lastFrameAt = 0;
  private framePresented = false;
  private fade: Fade | null = null;
  private lastImage: HTMLImageElement | null = null;
  private lastAlignment = false;
  private reducedMotion: boolean;

  constructor(private canvas: HTMLCanvasElement, private assets: FrameAssets, private notify: (state: FrameState) => void, private onMotion?: (motion: FrameMotion) => void, reducedMotion = false) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas is unavailable');
    this.context = context;
    this.reducedMotion = reducedMotion;
    this.resize();
    this.begin(this.clip, false);
  }

  getSnapshot = () => this.state;
  getDestination = (): SceneId => sceneIds[this.clip.destination];
  private publish(phase: FrameState['phase'], scene = this.state.scene) {
    if (phase === this.state.phase && scene === this.state.scene) return;
    this.state = { scene, phase };
    this.notify(this.state);
  }
  private url(directory: string, frame: number) {
    return framePath(directory, frame);
  }
  private prepare(directory: string, frame: number): Entry {
    const url = this.url(directory, frame);
    const existing = this.cache.get(url);
    if (existing) {
      this.cache.delete(url); this.cache.set(url, existing);
      return existing;
    }
    const entry: Entry = { image: new Image(), status: 'loading' };
    entry.image.src = this.assets.get(directory, frame);
    entry.image.decode().then(() => { entry.status = 'ready'; }).catch(() => { entry.status = 'error'; });
    this.cache.set(url, entry);
    while (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!);
    return entry;
  }
  private capture(holdHead = false): Fade | null {
    if (!this.lastImage || this.reducedMotion) return null;
    const image = document.createElement('canvas');
    image.width = this.canvas.width; image.height = this.canvas.height;
    image.getContext('2d')!.drawImage(this.canvas, 0, 0);
    return { image, started: null, holdHead };
  }
  private begin(clip: Clip, blend: boolean) {
    // Blend to the transition's first frame before advancing its camera move.
    this.fade = blend ? this.capture(!clip.loop) : null;
    if (this.reducedMotion) clip = { directory: `loop-${clip.destination + 1}`, frame: 1, step: clip.step, end: 121, loop: true, destination: clip.destination };
    this.clip = clip;
    this.framePresented = false;
    this.lastFrameAt = 0;
    // Keep the current UI until the first decoded destination frame is painted.
    this.publish('loading');
    this.prepare(clip.directory, clip.frame);
    this.schedule();
  }
  navigate = (scene: SceneId): MoveResult => {
    if (this.disposed) return 'not-ready';
    const destination = sceneIds.indexOf(scene);
    // A repeated selection acknowledges the request without restarting playback.
    if (destination === this.clip.destination) return 'accepted';
    this.goTo(destination, destination < this.clip.destination ? -1 : 1);
    return 'accepted';
  };
  private goTo(destination: number, direction: 1 | -1) {
    this.begin({ directory: direction === -1 ? `loop-${destination + 1}` : directories[destination], frame: 1, step: direction, end: 121, loop: direction === -1, destination }, true);
  }
  move = (direction: -1 | 1): MoveResult => {
    if (this.disposed || this.paused || this.state.phase === 'error') return 'not-ready';
    if (!this.lastImage) return 'busy';
    // Use the requested destination even while its first frame is decoding.
    const current = this.clip.destination;
    const destination = current + direction;
    if (destination < 0 || destination >= sceneIds.length) return 'boundary';
    this.goTo(destination, direction);
    return 'accepted';
  };
  retry = () => {
    if (this.disposed) return;
    this.cache.clear();
    this.goTo(this.clip.destination, 1);
  };

  resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    this.canvas.height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    this.fade = null;
    if (this.lastImage) this.draw(this.lastImage, this.lastAlignment);
  };
  private paint(image: HTMLImageElement, align: boolean) {
    const scale = Math.max(this.canvas.width / image.naturalWidth, this.canvas.height / image.naturalHeight) * 1.07;
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    this.context.save();
    if (align) {
      this.context.translate(this.canvas.width / 2 + 1.6 * scale, this.canvas.height / 2 - 10.9 * scale);
      this.context.scale(.9734, .9734);
      this.context.translate(-this.canvas.width / 2, -this.canvas.height / 2);
    }
    this.context.drawImage(image, (this.canvas.width - width) / 2, (this.canvas.height - height) / 2, width, height);
    this.context.restore();
  }
  private draw(image: HTMLImageElement, align: boolean, time?: number) {
    this.context.fillStyle = '#08090b';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.paint(image, align);
    if (this.fade && time !== undefined) {
      if (this.fade.started === null) this.fade.started = time;
      const amount = Math.min(1, (time - this.fade.started) / FADE_MS);
      this.context.globalAlpha = 1 - amount;
      this.context.drawImage(this.fade.image, 0, 0, this.canvas.width, this.canvas.height);
      this.context.globalAlpha = 1;
      if (amount === 1) this.fade = null;
    }
    this.lastImage = image; this.lastAlignment = align;
    const clip = this.clip;
    this.onMotion?.({ scene: sceneIds[clip.destination], phase: clip.loop ? 'loop' : 'playing',
      progress: clip.loop ? 1 : (clip.step === 1 ? clip.frame - 1 : 121 - clip.frame) / 120,
      loopProgress: clip.loop ? (clip.frame - 1) / 120 : 0, direction: clip.step });
  }
  private tick = (time: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const clip = this.clip;
    const current = this.prepare(clip.directory, clip.frame);
    if (current.status === 'error') { this.publish('error'); return; }
    if (!this.reducedMotion) for (let n = 1; n <= 4; n++) this.prepare(`loop-${n}`, 1);
    if (!this.reducedMotion && clip.destination < directories.length - 1) {
      // Prepare the next transition even during the initial Profile animation.
      for (let frame = 1; frame <= 6; frame++) this.prepare(directories[clip.destination + 1], frame);
    }
    for (let n = 1; !this.reducedMotion && n <= 28; n++) {
      const ahead = clip.loop ? 2 + ((clip.frame + n - 2) % 120) : clip.frame + clip.step * n;
      if (ahead >= 1 && ahead <= 121) this.prepare(clip.directory, ahead);
    }
    if (!this.reducedMotion && !clip.loop && Math.abs(clip.end - clip.frame) <= 28) {
      for (let frame = 1; frame <= 12; frame++) this.prepare(`loop-${clip.destination + 1}`, frame);
    }
    if (clip.loop && !this.reducedMotion) {
      // All bytes are local already. Decode navigation heads while stopped.
      for (const directory of directories) for (let frame = 1; frame <= 6; frame++) this.prepare(directory, frame);
    }
    if (current.status !== 'ready') { this.schedule(); return; }
    if (!this.framePresented) {
      this.framePresented = true; this.lastFrameAt = time;
      this.draw(current.image, clip.directory === 'loop-4', time);
      this.publish(clip.loop ? 'loop' : 'playing', sceneIds[clip.destination]);
    } else if (this.fade?.holdHead) {
      this.draw(current.image, clip.directory === 'loop-4', time);
      this.lastFrameAt = time;
    } else if (time - this.lastFrameAt >= FRAME_MS && !this.reducedMotion) {
      if (!clip.loop && clip.frame === clip.end) {
        const destination = clip.destination;
        this.begin({ directory: `loop-${destination + 1}`, frame: 1, step: 1, end: 121, loop: true, destination }, destination === 3);
        return;
      }
      const nextFrame = clip.loop ? (clip.frame === 121 ? 2 : clip.frame + 1) : clip.frame + clip.step;
      const next = this.prepare(clip.directory, nextFrame);
      if (next.status === 'error') { this.publish('error'); return; }
      if (next.status === 'ready') {
        clip.frame = nextFrame; this.lastFrameAt = time;
        this.draw(next.image, clip.directory === 'loop-4', time);
      } else if (this.fade) this.draw(current.image, clip.directory === 'loop-4', time);
    } else if (this.fade) this.draw(current.image, clip.directory === 'loop-4', time);
    if (!this.reducedMotion || this.fade) this.schedule();
  };
  pause() { this.paused = true; cancelAnimationFrame(this.raf); this.raf = 0; }
  resume() {
    if (this.disposed || !this.paused) return;
    this.paused = false; this.lastFrameAt = performance.now(); this.schedule();
  }
  private schedule() { if (!this.disposed && !this.paused && !this.raf) this.raf = requestAnimationFrame(this.tick); }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cache.clear(); this.fade = null; this.lastImage = null;
  }
}
