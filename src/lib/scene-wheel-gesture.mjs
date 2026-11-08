/** One scene per wheel gesture; momentum must not skip several scenes. */
export class SceneWheelGesture {
  amount = 0;
  lastAt = -Infinity;
  direction = 0;
  consumed = false;

  reset() {
    this.amount = 0; this.lastAt = -Infinity; this.direction = 0; this.consumed = false;
  }

  /** @param {number} delta @param {number} now @returns {-1|1|null} */
  consume(delta, now) {
    if (!Number.isFinite(delta) || delta === 0) return null;
    const direction = delta > 0 ? 1 : -1;
    if (now - this.lastAt > 180 || direction !== this.direction) {
      this.amount = 0; this.consumed = false;
    }
    this.lastAt = now; this.direction = direction;
    if (this.consumed) return null;
    this.amount += delta;
    if (Math.abs(this.amount) < 30) return null;
    this.consumed = true;
    return direction;
  }
}
