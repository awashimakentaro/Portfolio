/** Jump to the nearest copy on the unbounded rail, including after wrapping. */
export function nearestBookSlot(position, targetIndex, count) {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= count) return position;
  const currentIndex = ((position % count) + count) % count;
  let delta = ((targetIndex - currentIndex) % count + count) % count;
  if (delta > count / 2) delta -= count;
  return position + delta;
}
