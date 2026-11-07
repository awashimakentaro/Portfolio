const GROUPS = ['idle', 'one', 'two', 'three', 'loop-1', 'loop-2', 'loop-3', 'loop-4'];
export const FRAME_ASSET_COUNT = GROUPS.length * 121;
export const framePath = (directory: string, frame: number) => `/frames/${directory}/frame_${String(frame).padStart(3, '0')}.webp`;

/** Retains compressed files, not 968 decoded bitmaps (about 3.3 GiB). */
export class FrameAssets {
  private urls = new Map<string, string>();
  private controller = new AbortController();
  private disposed = false;

  constructor(private requestTimeoutMs = 20_000) {}

  async load(signal: AbortSignal, progress: (loaded: number, total: number) => void, reducedMotion = false) {
    const paths = reducedMotion
      ? GROUPS.filter((group) => group.startsWith('loop-')).map((group) => framePath(group, 1))
      : GROUPS.flatMap((group) => Array.from({ length: 121 }, (_, n) => framePath(group, n + 1)));
    const abort = () => this.controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    let cursor = 0, loaded = 0;
    progress(0, paths.length);
    const worker = async () => {
      while (cursor < paths.length) {
        this.controller.signal.throwIfAborted();
        const path = paths[cursor++];
        let blob: Blob | undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
          const request = new AbortController();
          const abortRequest = () => request.abort(this.controller.signal.reason);
          this.controller.signal.addEventListener('abort', abortRequest, { once: true });
          const timeout = setTimeout(() => request.abort(new Error('Frame request timed out')), this.requestTimeoutMs);
          try {
            this.controller.signal.throwIfAborted();
            const response = await fetch(path, { signal: request.signal, cache: attempt ? 'reload' : 'force-cache' });
            if (!response.ok) throw new Error(`Frame response: ${response.status}`);
            blob = await response.blob();
            request.signal.throwIfAborted();
            if (!blob.size || !blob.type.startsWith('image/')) throw new Error('Invalid frame');
            break;
          } catch (error) {
            if (this.controller.signal.aborted || attempt === 1) throw error;
          } finally {
            clearTimeout(timeout);
            this.controller.signal.removeEventListener('abort', abortRequest);
          }
        }
        this.controller.signal.throwIfAborted();
        this.urls.set(path, URL.createObjectURL(blob!));
        loaded++;
        if (loaded % 8 === 0 || loaded === paths.length) progress(loaded, paths.length);
      }
    };
    try {
      await Promise.all(Array.from({ length: 6 }, worker));
    } catch (error) {
      this.dispose();
      throw error;
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }

  get(directory: string, frame: number) {
    const url = this.urls.get(framePath(directory, frame));
    if (!url) throw new Error('Frame has not been downloaded');
    return url;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controller.abort();
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls.clear();
  }
}
