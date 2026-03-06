import { Vec2 } from './Vec2.js';

/**
 * Minimal 2x2 matrix primarily used for rotation.
 *
 * Layout:
 *   | m00  m01 |
 *   | m10  m11 |
 *
 * For a rotation by angle theta:
 *   | cos(theta)  -sin(theta) |
 *   | sin(theta)   cos(theta) |
 */
export class Mat2 {
  m00: number;
  m01: number;
  m10: number;
  m11: number;

  constructor(m00: number, m01: number, m10: number, m11: number) {
    this.m00 = m00;
    this.m01 = m01;
    this.m10 = m10;
    this.m11 = m11;
  }

  /** Create a rotation matrix from an angle in radians. */
  static fromAngle(radians: number): Mat2 {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return new Mat2(c, -s, s, c);
  }

  /** Identity matrix. */
  static identity(): Mat2 {
    return new Mat2(1, 0, 0, 1);
  }

  /** Set this matrix to a rotation matrix for the given angle. Returns this. */
  setAngle(radians: number): Mat2 {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    this.m00 = c;
    this.m01 = -s;
    this.m10 = s;
    this.m11 = c;
    return this;
  }

  /**
   * Multiply this matrix by a Vec2, returning a **new** Vec2.
   * Does NOT mutate the input vector.
   */
  mulVec2(v: Vec2): Vec2 {
    return new Vec2(
      this.m00 * v.x + this.m01 * v.y,
      this.m10 * v.x + this.m11 * v.y,
    );
  }

  /**
   * Multiply this matrix by a Vec2, writing the result into `out`.
   * Returns `out` for chaining. Avoids allocation on hot paths.
   */
  mulVec2Into(v: Vec2, out: Vec2): Vec2 {
    const x = this.m00 * v.x + this.m01 * v.y;
    const y = this.m10 * v.x + this.m11 * v.y;
    out.x = x;
    out.y = y;
    return out;
  }

  /**
   * Transpose this matrix in place. For a rotation matrix the transpose
   * is the inverse rotation. Returns this.
   */
  transpose(): Mat2 {
    const tmp = this.m01;
    this.m01 = this.m10;
    this.m10 = tmp;
    return this;
  }
}
