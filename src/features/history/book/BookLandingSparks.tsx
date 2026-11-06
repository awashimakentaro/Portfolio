'use client';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, Points, PointsMaterial } from 'three';

export function BookLandingSparks({ runKey, enabled, scale, floor, wide }: { runKey: number; enabled: boolean; scale: number; floor: number; wide: boolean }) {
  const points = useRef<Points>(null), material = useRef<PointsMaterial>(null);
  const started = useRef(0), reduced = useRef(false);
  const positions = useMemo(() => new Float32Array(60 * 3), []);
  useEffect(() => { started.current = performance.now(); }, [runKey]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { reduced.current = media.matches; }; change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useFrame(() => {
    if (!points.current || !material.current) return;
    const time = (performance.now() - started.current) / 1000;
    points.current.visible = enabled && !reduced.current && time > .4 && time < 1.7;
    if (!points.current.visible) return;
    for (let n = 0; n < 60; n++) {
      const slot = (n % (wide ? 5 : 3)) - (wide ? 2 : 1);
      const t = Math.max(0, time - .42 - (slot + 2) * .07);
      const angle = n * 2.39996;
      const speed = .4 + (n % 7) * .11;
      positions[n * 3] = slot * scale * (wide ? 1.78 : 2.45) + Math.cos(angle) * t * speed;
      positions[n * 3 + 1] = floor + Math.sin((n % 13) / 13 * Math.PI) * t * 1.05 - t * t * .65;
      positions[n * 3 + 2] = Math.sin(angle) * t * .5;
    }
    (points.current.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    material.current.opacity = Math.max(0, 1 - (time - .55) / 1.1) * .65;
  });
  return <points ref={points} raycast={() => {}} frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial ref={material} color="#ead7ad" size={.022} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
  </points>;
}
