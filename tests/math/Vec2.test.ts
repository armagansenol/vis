import { describe, it, expect } from 'vitest';
import { Vec2 } from '../../src/math/Vec2.js';
import { approxEqual } from '../../src/math/utils.js';

function expectVec2Near(v: Vec2, ex: number, ey: number, eps = 1e-6) {
  expect(approxEqual(v.x, ex, eps)).toBe(true);
  expect(approxEqual(v.y, ey, eps)).toBe(true);
}

describe('Vec2 construction', () => {
  it('defaults to (0, 0)', () => {
    const v = new Vec2();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('accepts x, y', () => {
    const v = new Vec2(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });
});

describe('Vec2 mutable operations', () => {
  it('add mutates and returns this', () => {
    const a = new Vec2(1, 2);
    const b = new Vec2(3, 4);
    const result = a.add(b);
    expect(result).toBe(a); // same reference
    expect(a.x).toBe(4);
    expect(a.y).toBe(6);
  });

  it('sub mutates and returns this', () => {
    const a = new Vec2(5, 7);
    const result = a.sub(new Vec2(2, 3));
    expect(result).toBe(a);
    expect(a.x).toBe(3);
    expect(a.y).toBe(4);
  });

  it('scale mutates and returns this', () => {
    const a = new Vec2(2, 3);
    const result = a.scale(3);
    expect(result).toBe(a);
    expect(a.x).toBe(6);
    expect(a.y).toBe(9);
  });

  it('chains multiple operations', () => {
    const v = new Vec2(1, 0).add(new Vec2(0, 1)).scale(2);
    expect(v.x).toBe(2);
    expect(v.y).toBe(2);
    // Verify same instance throughout
    const ref = new Vec2(1, 0);
    const chained = ref.add(new Vec2(0, 1)).scale(2);
    expect(chained).toBe(ref);
  });

  it('normalize produces unit vector', () => {
    const v = new Vec2(3, 4);
    const result = v.normalize();
    expect(result).toBe(v);
    expect(approxEqual(v.length(), 1)).toBe(true);
    expectVec2Near(v, 0.6, 0.8);
  });

  it('normalize of zero vector stays zero', () => {
    const v = new Vec2(0, 0);
    v.normalize();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('rotate (1,0) by pi/2 gives (0,1)', () => {
    const v = new Vec2(1, 0);
    v.rotate(Math.PI / 2);
    expectVec2Near(v, 0, 1);
  });

  it('rotate (0,1) by -pi/2 gives (1,0)', () => {
    const v = new Vec2(0, 1);
    v.rotate(-Math.PI / 2);
    expectVec2Near(v, 1, 0);
  });

  it('perpendicular of (1,0) is (0,1)', () => {
    const v = new Vec2(1, 0);
    v.perpendicular();
    expectVec2Near(v, 0, 1);
  });

  it('perpendicular of (3,4) is (-4,3)', () => {
    const v = new Vec2(3, 4);
    v.perpendicular();
    expect(v.x).toBe(-4);
    expect(v.y).toBe(3);
  });

  it('set overwrites components', () => {
    const v = new Vec2(1, 2);
    const result = v.set(10, 20);
    expect(result).toBe(v);
    expect(v.x).toBe(10);
    expect(v.y).toBe(20);
  });

  it('negate flips sign', () => {
    const v = new Vec2(3, -5);
    v.negate();
    expect(v.x).toBe(-3);
    expect(v.y).toBe(5);
  });

  it('copy takes values from another vector', () => {
    const a = new Vec2(1, 2);
    const b = new Vec2(10, 20);
    const result = a.copy(b);
    expect(result).toBe(a);
    expect(a.x).toBe(10);
    expect(a.y).toBe(20);
  });
});

describe('Vec2 scalar-returning methods', () => {
  it('dot product: (1,2).(3,4) = 11', () => {
    expect(new Vec2(1, 2).dot(new Vec2(3, 4))).toBe(11);
  });

  it('cross product: (1,0)x(0,1) = 1', () => {
    expect(new Vec2(1, 0).cross(new Vec2(0, 1))).toBe(1);
  });

  it('cross product: (0,1)x(1,0) = -1', () => {
    expect(new Vec2(0, 1).cross(new Vec2(1, 0))).toBe(-1);
  });

  it('length of (3,4) is 5', () => {
    expect(new Vec2(3, 4).length()).toBe(5);
  });

  it('lengthSquared of (3,4) is 25', () => {
    expect(new Vec2(3, 4).lengthSquared()).toBe(25);
  });
});

describe('Vec2.clone', () => {
  it('returns a new Vec2 with same values', () => {
    const a = new Vec2(7, 8);
    const b = a.clone();
    expect(b).not.toBe(a);
    expect(b.x).toBe(7);
    expect(b.y).toBe(8);
  });
});

describe('Vec2 static methods', () => {
  it('Vec2.add returns new vector', () => {
    const a = new Vec2(1, 2);
    const b = new Vec2(3, 4);
    const c = Vec2.add(a, b);
    expect(c).not.toBe(a);
    expect(c).not.toBe(b);
    expect(c.x).toBe(4);
    expect(c.y).toBe(6);
    // originals unchanged
    expect(a.x).toBe(1);
    expect(b.x).toBe(3);
  });

  it('Vec2.sub returns new vector', () => {
    const c = Vec2.sub(new Vec2(5, 7), new Vec2(2, 3));
    expect(c.x).toBe(3);
    expect(c.y).toBe(4);
  });

  it('Vec2.dot matches instance dot', () => {
    const a = new Vec2(1, 2);
    const b = new Vec2(3, 4);
    expect(Vec2.dot(a, b)).toBe(a.dot(b));
  });

  it('Vec2.cross matches instance cross', () => {
    const a = new Vec2(1, 2);
    const b = new Vec2(3, 4);
    expect(Vec2.cross(a, b)).toBe(a.cross(b));
  });

  it('Vec2.distance between (0,0) and (3,4) is 5', () => {
    expect(Vec2.distance(new Vec2(0, 0), new Vec2(3, 4))).toBe(5);
  });

  it('Vec2.distanceSquared between (0,0) and (3,4) is 25', () => {
    expect(Vec2.distanceSquared(new Vec2(0, 0), new Vec2(3, 4))).toBe(25);
  });
});

describe('Vec2 static factories', () => {
  it('Vec2.zero()', () => {
    const v = Vec2.zero();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('Vec2.one()', () => {
    const v = Vec2.one();
    expect(v.x).toBe(1);
    expect(v.y).toBe(1);
  });

  it('Vec2.fromAngle(0) gives (1,0)', () => {
    const v = Vec2.fromAngle(0);
    expectVec2Near(v, 1, 0);
  });

  it('Vec2.fromAngle(pi/2) gives (0,1)', () => {
    const v = Vec2.fromAngle(Math.PI / 2);
    expectVec2Near(v, 0, 1);
  });
});
