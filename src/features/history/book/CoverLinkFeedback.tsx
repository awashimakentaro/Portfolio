'use client';

import type { SpringValue } from '@react-spring/three';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Vector4, type ShaderMaterial } from 'three';

export type CoverLinkRegion = { x: number; y: number; width: number; height: number };

/** A GPU highlight above the printed button; never rebuild the cover texture on hover. */
export function CoverLinkFeedback({ hovered, aspect, height, width, openProgress }: {
  hovered: RefObject<CoverLinkRegion | undefined>;
  aspect: number;
  height: number;
  width: number;
  openProgress: SpringValue<number>;
}) {
  const material = useRef<ShaderMaterial>(null);
  const reduced = useRef(false);
  const last = useRef<CoverLinkRegion | undefined>(undefined);
  const elapsed = useRef(0);
  const uniforms = useMemo(() => ({
    rect: { value: new Vector4() }, aspect: { value: aspect },
    visibility: { value: 0 }, progress: { value: 1 }, motion: { value: 1 },
  }), [aspect]);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = query.matches; };
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useFrame((_, delta) => {
    const live = material.current?.uniforms;
    if (!live) return;
    const region = openProgress.get() < .002 ? hovered.current : undefined;
    if (region !== last.current) {
      last.current = region; elapsed.current = 0;
      if (region) live.rect.value.set(region.x, region.y, region.width, region.height);
    }
    elapsed.current += delta;
    live.progress.value = Math.min(1, elapsed.current / .65);
    live.motion.value = reduced.current ? 0 : 1;
    live.visibility.value += ((region ? 1 : 0) - live.visibility.value) * (1 - Math.exp(-delta * 22));
  });
  return <mesh position={[width / 2, 0, .038]} raycast={() => {}}>
    <planeGeometry args={[height * aspect, height]} />
    <shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false} uniforms={uniforms}
      vertexShader={`varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
      fragmentShader={`varying vec2 vUv;
        uniform vec4 rect;
        uniform float aspect, visibility, progress, motion;
        void main() {
          if (visibility < .001 || rect.z <= 0.0) discard;
          vec2 local = (vec2(vUv.x, 1.0-vUv.y)-rect.xy)/rect.zw;
          float ratio = rect.z * aspect / rect.w;
          vec2 p = (local-.5)*vec2(ratio,1.0);
          vec2 q = abs(p)-vec2(max(0.0,ratio*.5-.5),0.0);
          float distance = length(max(q,0.0)) + min(max(q.x,q.y),0.0)-.5;
          float mask = 1.0-smoothstep(-.012,.012,distance);
          float edge = 1.0-smoothstep(.008,.045,abs(distance));
          float sweep = -0.6 + progress*2.2;
          float shine = exp(-pow((local.x + local.y*.28-sweep)/.12,2.0));
          float alpha = visibility*(mask*.08 + edge*.52 + mask*shine*.48*motion);
          gl_FragColor = vec4(1.0,.88,.66,alpha);
        }`} />
  </mesh>;
}
