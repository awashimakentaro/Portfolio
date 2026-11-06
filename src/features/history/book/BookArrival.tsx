'use client';

import { animated, useSpring } from '@react-spring/three';
import { useEffect, useRef, type ReactNode } from 'react';

export type BookArrivalProps = {
  children: ReactNode;
  /** World-space offset that keeps the whole book above the render surface. */
  launchHeight: number;
  /** Stable, visual arrival order (0–4), independent of the selected volume. */
  order: number;
  /** Increment to replay the entire shelf's entrance. */
  runKey: number;
  /** False while opening/reading: the wrapper immediately returns to rest. */
  enabled: boolean;
  /** Newly mounted carousel neighbors can join at rest after the entrance. */
  allowEntrance?: boolean;
};

const REST = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };

function launchPose(order: number, launchHeight: number) {
  const slot = Math.max(0, Math.min(4, order));
  const side = slot % 2 === 0 ? -1 : 1;
  return {
    x: side * (0.22 + slot * 0.04),
    y: launchHeight + slot * 0.1,
    z: -0.65 - slot * 0.025,
    rx: side * 0.12,
    ry: side * 0.32,
    rz: side * (0.11 + slot * 0.012),
  };
}

/** Local entrance transforms only; the parent owns shelf, camera and book poses. */
export function BookArrival({ children, order, runKey, enabled, allowEntrance = true, launchHeight }: BookArrivalProps) {
  const reducedMotion = useRef(false);
  const lastRun = useRef<number | null>(null);
  const [{ x, y, z, rx, ry, rz }, api] = useSpring(() => ({
    ...(enabled && allowEntrance ? launchPose(order, launchHeight) : REST),
    config: { mass: 0.85, tension: 180, friction: 16, precision: 0.001 },
  }));

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedMotion.current = media.matches;
      if (media.matches) { api.stop(); api.set(REST); }
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [api]);

  useEffect(() => {
    if (!enabled) {
      lastRun.current = runKey;
      api.stop(); api.set(REST);
      return;
    }
    if (lastRun.current === runKey) return;
    lastRun.current = runKey;
    api.stop();
    if (!allowEntrance || reducedMotion.current) { api.set(REST); return; }

    // A deterministic scatter gives each volume its own trajectory. The same
    // spring supplies impact overshoot and the small rebound, with no timer.
    api.set(launchPose(order, launchHeight));
    api.start({
      ...REST,
      delay: Math.max(0, Math.min(4, order)) * 80,
      immediate: false,
      config: { mass: 0.85, tension: 180, friction: 16, precision: 0.001 },
    });
  }, [api, runKey, enabled, allowEntrance, order, launchHeight]);

  useEffect(() => () => {
    api.stop();
    lastRun.current = null;
  }, [api]);

  return <animated.group
    position-x={x} position-y={y} position-z={z}
    rotation-x={rx} rotation-y={ry} rotation-z={rz}
  >{children}</animated.group>;
}
