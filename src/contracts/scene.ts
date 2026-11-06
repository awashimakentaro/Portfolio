export const sceneIds = ['profile', 'about', 'history', 'contact'] as const;
export type SceneId = (typeof sceneIds)[number];
export type FrameState = { scene: SceneId; phase: 'loading' | 'playing' | 'loop' | 'error' };
/** Telemetry for foreground effects; updates only after a decoded frame is painted. */
export type FrameMotion = { scene: SceneId; phase: 'playing' | 'loop'; progress: number; loopProgress: number; direction: 1 | -1 };
export const sceneLabels: Record<SceneId, string> = { profile: 'Profile', about: 'About Me', history: 'History', contact: 'Contact' };
export type MoveResult = 'accepted' | 'busy' | 'boundary' | 'not-ready';
