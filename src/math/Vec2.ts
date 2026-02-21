/**
 * Mutable 2D vector with method chaining.
 *
 * Instance methods mutate `this` and return `this` for chaining (except
 * scalar-returning methods like `dot`, `cross`, `length`). Static methods
 * return new Vec2 instances and never mutate their arguments.
 */
export class Vec2 {
  x: number;
  y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  // ---------------------------------------------------------------------------
  // Mutable instance methods — return `this` for chaining
  // ---------------------------------------------------------------------------

  /** Add another vector in place. */
  add(v: Vec2): Vec2 {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /** Subtract another vector in place. */
  sub(v: Vec2): Vec2 {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /** Scale by a scalar in place. */
  scale(s: number): Vec2 {
    this.x *= s;
    this.y *= s;
    return this;
  }

  /** Normalize to unit length in place. Zero vectors are left unchanged. */
  normalize(): Vec2 {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  /** Rotate by angle (radians) in place. */
  rotate(angle: number): Vec2 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x = this.x * c - this.y * s;
    const y = this.x * s + this.y * c;
    this.x = x;
    this.y = y;
    return this;
  }

  /** Set to the left-hand perpendicular (-y, x) in place. */
  perpendicular(): Vec2 {
    const x = this.x;
    this.x = -this.y;
    this.y = x;
    return this;
  }

  /** Set both components. */
  set(x: number, y: number): Vec2 {
    this.x = x;
    this.y = y;
    return this;
  }

  /** Negate both components in place. */
  negate(): Vec2 {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }

  /** Copy components from another vector. */
  copy(other: Vec2): Vec2 {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Non-mutating instance methods — return scalar
  // ---------------------------------------------------------------------------

  /** Dot product with another vector. */
  dot(v: Vec2): number {
    return this.x * v.x + this.y * v.y;
  }

  /** 2D cross product (z-component of the 3D cross product). */
  cross(v: Vec2): number {
    return this.x * v.y - this.y * v.x;
  }

  /** Euclidean length. */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /** Squared length (avoids sqrt). */
  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  // ---------------------------------------------------------------------------
  // Non-mutating instance method — returns new Vec2
  // ---------------------------------------------------------------------------

  /** Return a new Vec2 with the same components. */
  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  // ---------------------------------------------------------------------------
  // Static methods — non-mutating, return new Vec2 or scalar
  // ---------------------------------------------------------------------------

  /** Return a new vector that is the sum of a and b. */
  static add(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x + b.x, a.y + b.y);
  }

  /** Return a new vector that is a minus b. */
  static sub(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x - b.x, a.y - b.y);
  }

  /** Dot product of a and b. */
  static dot(a: Vec2, b: Vec2): number {
    return a.x * b.x + a.y * b.y;
  }

  /** 2D cross product of a and b. */
  static cross(a: Vec2, b: Vec2): number {
    return a.x * b.y - a.y * b.x;
  }

  /** Euclidean distance between a and b. */
  static distance(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Squared distance between a and b (avoids sqrt). */
  static distanceSquared(a: Vec2, b: Vec2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  // ---------------------------------------------------------------------------
  // Static factories
  // ---------------------------------------------------------------------------

  /** (0, 0) */
  static zero(): Vec2 {
    return new Vec2(0, 0);
  }

  /** (1, 1) */
  static one(): Vec2 {
    return new Vec2(1, 1);
  }

  /** Unit vector at the given angle (radians). */
  static fromAngle(radians: number): Vec2 {
    return new Vec2(Math.cos(radians), Math.sin(radians));
  }
}
