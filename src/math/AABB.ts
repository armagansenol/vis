import { Vec2 } from './Vec2.js';

/**
 * Axis-Aligned Bounding Box stored as min/max corners.
 */
export class AABB {
  min: Vec2;
  max: Vec2;

  constructor(min: Vec2, max: Vec2) {
    this.min = min;
    this.max = max;
  }

  /** Test overlap with another AABB (axis-separation test). */
  overlaps(other: AABB): boolean {
    if (this.max.x < other.min.x || this.min.x > other.max.x) return false;
    if (this.max.y < other.min.y || this.min.y > other.max.y) return false;
    return true;
  }

  /** Check if this AABB fully contains another. */
  contains(other: AABB): boolean {
    return (
      this.min.x <= other.min.x &&
      this.min.y <= other.min.y &&
      this.max.x >= other.max.x &&
      this.max.y >= other.max.y
    );
  }

  /** Width of the AABB. */
  get width(): number {
    return this.max.x - this.min.x;
  }

  /** Height of the AABB. */
  get height(): number {
    return this.max.y - this.min.y;
  }

  /** Center point of the AABB. */
  get center(): Vec2 {
    return new Vec2(
      (this.min.x + this.max.x) * 0.5,
      (this.min.y + this.max.y) * 0.5,
    );
  }

  /** Perimeter (useful for broadphase heuristics). */
  perimeter(): number {
    return 2 * (this.width + this.height);
  }

  /** Return the smallest AABB that encloses both a and b. */
  static combine(a: AABB, b: AABB): AABB {
    return new AABB(
      new Vec2(Math.min(a.min.x, b.min.x), Math.min(a.min.y, b.min.y)),
      new Vec2(Math.max(a.max.x, b.max.x), Math.max(a.max.y, b.max.y)),
    );
  }
}
