'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { AdditiveBlending, Group, MathUtils, Points, PointsMaterial, DirectionalLight } from 'three';
import type { FrameMotion } from '@/contracts/scene';

/** Reads painted-background telemetry directly, without React renders per frame. */
export function BookAtmosphere({ motionRef, reading, children }: { motionRef?: RefObject<FrameMotion>; reading: boolean; children: ReactNode }) {
  const group = useRef<Group>(null);
  const dust = useRef<Points>(null);
  const dustMaterial = useRef<PointsMaterial>(null);
  const sweep = useRef<DirectionalLight>(null);
  const { viewport } = useThree();
  const reduced = useRef(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { reduced.current = media.matches; }; change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const positions = useMemo(() => {
    const values = new Float32Array(90 * 3);
    for (let n = 0; n < 90; n++) {
      values[n * 3] = (((n * 0.61803398875) % 1) - .5) * viewport.width * .92;
      values[n * 3 + 1] = (((n * 0.41421356) % 1) - .5) * viewport.height * .95;
      values[n * 3 + 2] = -1.2 + ((n * .73205) % 1) * 1.1;
    }
    return values;
  }, [viewport.width, viewport.height]);
  useFrame((_, delta) => {
    const motion = motionRef?.current;
    const playing = motion?.scene === 'history' && motion.phase === 'playing';
    const p = playing ? motion.progress : 1;
    const arrival = reduced.current || reading ? 1 : 1 - Math.pow(1 - Math.min(1, p * 2.3), 3);
    const pulse = reduced.current || reading ? 0 : playing ? Math.sin(p * Math.PI) : .2 * (1 - Math.cos((motion?.loopProgress ?? 0) * Math.PI * 2));
    const smoothing = Math.min(delta, .05);
    if (group.current) {
      group.current.position.y = MathUtils.damp(group.current.position.y, -.5 * (1 - arrival), 12, smoothing);
      group.current.rotation.y = MathUtils.damp(group.current.rotation.y, -.13 * (1 - arrival), 12, smoothing);
      group.current.scale.setScalar(MathUtils.damp(group.current.scale.x, .88 + .12 * arrival, 12, smoothing));
    }
    if (sweep.current) {
      sweep.current.intensity = MathUtils.damp(sweep.current.intensity, reading ? .15 : .25 + pulse * 1.35, 10, smoothing);
      sweep.current.position.x = playing ? -5 + p * 10 : 3;
    }
    if (dust.current) {
      dust.current.visible = !reduced.current;
      dust.current.rotation.z = playing ? (1 - p) * -.045 : Math.sin((motion?.loopProgress ?? 0) * Math.PI * 2) * .012;
    }
    if (dustMaterial.current) dustMaterial.current.opacity = MathUtils.damp(dustMaterial.current.opacity, reading ? .04 : .15 + pulse * .25, 10, smoothing);
  });
  return <>
    <directionalLight ref={sweep} position={[-4, 2, 5]} color="#dfc494" intensity={.3} />
    <points ref={dust} raycast={() => {}}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial ref={dustMaterial} size={.014} color="#e8d3a0" transparent opacity={.2} blending={AdditiveBlending} depthWrite={false} sizeAttenuation />
    </points>
    <group ref={group}>{children}</group>
  </>;
}
