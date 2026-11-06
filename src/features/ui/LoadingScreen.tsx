'use client';

import styles from './LoadingScreen.module.css';

export type IntroPhase = 'loading' | 'complete' | 'revealing' | 'done';

export function LoadingScreen({ loaded, total, phase, error, onRetry }: {
  loaded: number; total: number; phase: IntroPhase; error: boolean; onRetry: () => void;
}) {
  const progress = Math.min(1, loaded / total);
  return <section className={styles.screen} data-phase={phase} data-loading-error={error} aria-label="ポートフォリオの読み込み" aria-hidden={phase === 'revealing'}>
    <div className={styles.aura} aria-hidden="true" />
    <div className={styles.emblem} aria-hidden="true">
      <div className={styles.orbit}><i /></div>
      <div className={styles.innerOrbit} />
      <svg className={styles.ring} viewBox="0 0 280 280" fill="none">
        <circle className={styles.track} cx="140" cy="140" r="106" />
        <circle className={styles.ticks} cx="140" cy="140" r="121" pathLength="72" />
        <circle className={styles.fill} cx="140" cy="140" r="106" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress} transform="rotate(-90 140 140)" />
        <path className={styles.crosshair} d="M140 4v9m0 254v9M4 140h9m254 0h9" />
      </svg>
      <span className={styles.glint} />
    </div>
    <progress className={styles.accessible} value={loaded} max={total} aria-label="映像のダウンロード進捗" />
    <span className={styles.accessible} role="status">{error ? '映像の読み込みに失敗しました。再試行できます。' : phase === 'loading' ? '映像を読み込んでいます。' : '読み込み完了。ポートフォリオを表示します。'}</span>
    {error && <button className={styles.retry} onClick={onRetry} aria-label="もう一度読み込む"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7" /></svg></button>}
  </section>;
}
