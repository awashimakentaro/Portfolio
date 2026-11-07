/** Distributed curvature, flat at rest, with the outer edge trailing the hinge. */
export function leafPose(progress, lag = 0, segments = 24) {
  const p = Math.max(0, Math.min(1, progress));
  const envelope = Math.sin(Math.PI * p);
  const bow = envelope * 1.22;
  const trail = Math.max(-.38, Math.min(.38, lag * 3.5));
  const joints = Array.from({ length: segments }, (_, index) => {
    const previous = index / segments, f = (index + 1) / segments;
    return {
      y: bow * (Math.sin(Math.PI * f) - Math.sin(Math.PI * previous)) + trail * (f * f - previous * previous),
      x: envelope * .1 * (f * f - previous * previous),
      z: envelope * .05 * (f * f - previous * previous),
    };
  });
  return { root: -Math.PI * p - bow * .24, joints };
}
