'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { SpringValue } from '@react-spring/three';
import { useEffect, useMemo, useRef } from 'react';
import { leafPose } from '@/lib/book-leaf-motion.mjs';
import * as THREE from 'three';

const WIDTH_SEGMENTS = 24;
const PAPER_THICKNESS = 0.004;
const STACK_SPACING = 0.006;

type PointerHandler = (event: ThreeEvent<PointerEvent>) => void;

export type BookLeafProps = {
  progress: SpringValue<number>;
  front: THREE.Texture;
  back: THREE.Texture;
  index: number;
  count: number;
  width?: number;
  height?: number;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  onPointerDown?: PointerHandler;
  onPointerMove?: PointerHandler;
  onPointerUp?: PointerHandler;
  onPointerCancel?: PointerHandler;
  onPointerOver?: PointerHandler;
  onPointerOut?: PointerHandler;
};

/** A persistent physical sheet. The controller owns progress and all gestures.
 * Local x=0 is the binding; the unturned sheet extends to +width.
 * Incoming textures are shared/owned by the caller and are never disposed here.
 */
export function BookLeaf({
  progress, front, back, index, count, width = 1.6, height = 2.25,
  onClick, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  onPointerOver, onPointerOut,
}: BookLeafProps) {
  const rig = useMemo(() => {
    // A closed thin box supplies real dark paper edges, avoiding transparent
    // coincident front/back planes. All six faces share the same skeleton.
    const geometry = new THREE.BoxGeometry(width, height, PAPER_THICKNESS, WIDTH_SEGMENTS, 1, 1);
    geometry.translate(width / 2, 0, 0);
    const positions = geometry.getAttribute('position');
    const skinIndices: number[] = [];
    const skinWeights: number[] = [];
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const distance = THREE.MathUtils.clamp(positions.getX(vertex) / width * WIDTH_SEGMENTS, 0, WIDTH_SEGMENTS);
      const first = Math.min(Math.floor(distance), WIDTH_SEGMENTS - 1);
      const weight = distance - first;
      skinIndices.push(first, first + 1, 0, 0);
      skinWeights.push(1 - weight, weight, 0, 0);
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    // BoxGeometry uses material 4 for +z and 5 for -z. Assign explicitly from
    // positions so the verso reads left-to-right once rotated onto the left.
    const uv = geometry.getAttribute('uv');
    const triangles = geometry.getIndex()!;
    for (const group of geometry.groups) {
      if (group.materialIndex !== 4 && group.materialIndex !== 5) continue;
      for (let entry = group.start; entry < group.start + group.count; entry++) {
        const vertex = triangles.getX(entry);
        const u = positions.getX(vertex) / width;
        uv.setXY(vertex, group.materialIndex === 4 ? u : 1 - u, positions.getY(vertex) / height + 0.5);
      }
    }
    uv.needsUpdate = true;

    const bones = Array.from({ length: WIDTH_SEGMENTS + 1 }, () => new THREE.Bone());
    for (let bone = 1; bone <= WIDTH_SEGMENTS; bone++) {
      bones[bone].position.x = width / WIDTH_SEGMENTS;
      bones[bone - 1].add(bones[bone]);
    }
    const skeleton = new THREE.Skeleton(bones);
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#242426', roughness: 0.96, metalness: 0 });
    const frontMaterial = new THREE.MeshStandardMaterial({ map: front, roughness: 0.94, metalness: 0 });
    const backMaterial = new THREE.MeshStandardMaterial({ map: back, roughness: 0.94, metalness: 0 });
    const mesh = new THREE.SkinnedMesh(geometry, [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, frontMaterial, backMaterial]);
    mesh.name = `book-leaf-${index}`;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(bones[0], mesh);
    group.updateMatrixWorld(true);
    mesh.bind(skeleton);
    return { group, mesh, bones, skeleton, geometry, edgeMaterial, frontMaterial, backMaterial };
  }, [width, height, front, back, index]);

  useEffect(() => () => {
    rig.geometry.dispose();
    rig.edgeMaterial.dispose();
    rig.frontMaterial.dispose();
    rig.backMaterial.dispose();
    rig.skeleton.dispose();
  }, [rig]);

  const reducedMotion = useRef(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = media.matches; }; update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const lastPose = useRef<{ rig: typeof rig; p: number; count: number } | null>(null);
  useFrame((_, delta) => {
    const target = THREE.MathUtils.clamp(progress.get(), 0, 1);
    if (lastPose.current?.rig === rig && lastPose.current.p === target && lastPose.current.count === count) return;
    const previous = lastPose.current?.rig === rig ? lastPose.current.p : target;
    let p = reducedMotion.current ? target : THREE.MathUtils.damp(previous, target, 26, Math.min(delta, .05));
    if (Math.abs(target - p) < .0001) p = target;
    lastPose.current = { rig, p, count };
    const pose = leafPose(p, target - p, WIDTH_SEGMENTS);
    rig.bones[0].rotation.y = pose.root;
    for (let bone = 1; bone <= WIDTH_SEGMENTS; bone++) {
      const joint = pose.joints[bone - 1];
      rig.bones[bone].rotation.set(joint.x, joint.y, joint.z);
    }
    const spacing = Math.min(STACK_SPACING, 0.075 / Math.max(1, count));
    rig.group.position.z = 0.12 + ((1 - p) * (count - index) + p * index) * spacing;
    rig.group.updateMatrixWorld(true);
    rig.skeleton.update();
    // Raycasting must follow the deformed surface during an interactive drag.
    rig.mesh.computeBoundingBox();
    rig.mesh.computeBoundingSphere();
  });

  return <primitive
    object={rig.group}
    dispose={null}
    onClick={onClick}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    onPointerOver={onPointerOver}
    onPointerOut={onPointerOut}
  />;
}
