import { describe, it, expect } from 'vitest';
import { Mat2 } from '../../src/math/Mat2.js';
import { Vec2 } from '../../src/math/Vec2.js';
import { approxEqual } from '../../src/math/utils.js';

function expectVec2Near(v: Vec2, ex: number, ey: number, eps = 1e-6) {
  expect(approxEqual(v.x, ex, eps)).toBe(true);
  expect(approxEqual(v.y, ey, eps)).toBe(true);
}

describe('Mat2.fromAngle', () => {
  it('rotation of (1,0) by pi/2 gives (0,1)', () => {
    const rot = Mat2.fromAngle(Math.PI / 2);
    const v = rot.mulVec2(new Vec2(1, 0));
    expectVec2Near(v, 0, 1);
  });

  it('rotation of (1,0) by pi gives (-1,0)', () => {
    const rot = Mat2.fromAngle(Math.PI);
    const v = rot.mulVec2(new Vec2(1, 0));
    expectVec2Near(v, -1, 0);
  });

  it('rotation of (0,1) by -pi/2 gives (1,0)', () => {
    const rot = Mat2.fromAngle(-Math.PI / 2);
    const v = rot.mulVec2(new Vec2(0, 1));
    expectVec2Near(v, 1, 0);
  });

  it('rotation by 0 is identity', () => {
    const rot = Mat2.fromAngle(0);
    const v = rot.mulVec2(new Vec2(3, 7));
    expectVec2Near(v, 3, 7);
  });
});

describe('Mat2.identity', () => {
  it('has correct values', () => {
    const m = Mat2.identity();
    expect(m.m00).toBe(1);
    expect(m.m01).toBe(0);
    expect(m.m10).toBe(0);
    expect(m.m11).toBe(1);
  });

  it('identity * v = v', () => {
    const m = Mat2.identity();
    const v = m.mulVec2(new Vec2(5, 9));
    expect(v.x).toBe(5);
    expect(v.y).toBe(9);
  });
});

describe('Mat2.setAngle', () => {
  it('mutates the matrix in place', () => {
    const m = Mat2.identity();
    const result = m.setAngle(Math.PI / 2);
    expect(result).toBe(m);
    const v = m.mulVec2(new Vec2(1, 0));
    expectVec2Near(v, 0, 1);
  });
});

describe('Mat2.transpose', () => {
  it('transpose of rotation is inverse rotation', () => {
    const angle = Math.PI / 4;
    const rot = Mat2.fromAngle(angle);
    const v = new Vec2(3, 5);
    const rotated = rot.mulVec2(v);
    rot.transpose();
    const back = rot.mulVec2(rotated);
    expectVec2Near(back, 3, 5);
  });

  it('transpose returns this', () => {
    const m = Mat2.identity();
    expect(m.transpose()).toBe(m);
  });
});

describe('Mat2.mulVec2', () => {
  it('does not mutate the input vector', () => {
    const rot = Mat2.fromAngle(Math.PI / 2);
    const v = new Vec2(1, 0);
    rot.mulVec2(v);
    expect(v.x).toBe(1);
    expect(v.y).toBe(0);
  });

  it('returns a new Vec2', () => {
    const rot = Mat2.fromAngle(0);
    const v = new Vec2(1, 0);
    const result = rot.mulVec2(v);
    expect(result).not.toBe(v);
  });
});
