import bundles from './frame-manifest.generated.json';
export const FRAME_ASSET_COUNT = bundles.reduce((total, bundle) => total + bundle.lengths.length, 0);
export const framePath = (directory: string, frame: number) => `/frames/${directory}/frame_${String(frame).padStart(3, '0')}.webp`;

/** Retains compressed files, not 968 decoded bitmaps (about 3.3 GiB). */
export class FrameAssets {
  private urls = new Map<string, string>();
  private controller = new AbortController();
  private disposed = false;

  constructor(private requestTimeoutMs = 60_000) {}

  async load(signal: AbortSignal, progress: (loaded: number, total: number) => void, reducedMotion = false) {
    const tasks = bundles.filter(bundle => !reducedMotion || bundle.directory.startsWith('loop-')).map(bundle => ({
      directory: bundle.directory,
      url: reducedMotion ? bundle.poster! : bundle.url,
      lengths: reducedMotion ? bundle.lengths.slice(0, 1) : bundle.lengths,
    }));
    const total = tasks.reduce((count, task) => count + task.lengths.length, 0);
    const totalBytes = tasks.reduce((count, task) => count + task.lengths.reduce((a, b) => a + b, 0), 0);
    const received = tasks.map(() => 0);
    let lastProgress = 0;
    const downloaded = (index: number, bytes: number) => {
      // Retrying a failed bundle must not send the ring backwards or finish early.
      received[index] = Math.max(received[index], bytes);
      const value = Math.min(total - 1, Math.floor(received.reduce((a, b) => a + b, 0) / totalBytes * total));
      if (value >= lastProgress + 8 || (value === total - 1 && value > lastProgress)) { lastProgress = value; progress(value, total); }
    };
    const abort = () => this.controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    let cursor = 0;
    progress(0, total);
    const worker = async () => {
      while (cursor < tasks.length) {
        this.controller.signal.throwIfAborted();
        const index = cursor++;
        const task = tasks[index];
        const expectedBytes = task.lengths.reduce((a, b) => a + b, 0);
        let blob: Blob | undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
          const request = new AbortController();
          const abortRequest = () => request.abort(this.controller.signal.reason);
          this.controller.signal.addEventListener('abort', abortRequest, { once: true });
          const timeout = setTimeout(() => request.abort(new Error('Frame request timed out')), this.requestTimeoutMs);
          try {
            this.controller.signal.throwIfAborted();
            const response = await fetch(task.url, { signal: request.signal, cache: attempt ? 'reload' : 'force-cache' });
            if (!response.ok) throw new Error(`Frame response: ${response.status}`);
            if (response.body) {
              const reader = response.body.getReader();
              const chunks: BlobPart[] = [];
              let size = 0;
              try {
                for (;;) {
                  const { done, value } = await reader.read();
                  request.signal.throwIfAborted();
                  if (done) break;
                  size += value.byteLength;
                  if (size > expectedBytes) throw new Error('Invalid frame bundle size');
                  chunks.push(value);
                  downloaded(index, size);
                }
              } finally {
                await reader.cancel().catch(() => {});
                reader.releaseLock();
              }
              blob = new Blob(chunks);
            } else {
              blob = await response.blob();
            }
            request.signal.throwIfAborted();
            if (blob.size !== expectedBytes) throw new Error('Invalid frame bundle size');
            downloaded(index, blob.size);
            break;
          } catch (error) {
            if (this.controller.signal.aborted || attempt === 1) throw error;
          } finally {
            clearTimeout(timeout);
            this.controller.signal.removeEventListener('abort', abortRequest);
          }
        }
        this.controller.signal.throwIfAborted();
        let offset = 0;
        for (const [frame, length] of task.lengths.entries()) {
          this.urls.set(framePath(task.directory, frame + 1), URL.createObjectURL(blob!.slice(offset, offset + length, 'image/webp')));
          offset += length;
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: 6 }, worker));
      this.controller.signal.throwIfAborted();
      progress(total, total);
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
