import { describe, it, expect } from 'vitest';
import { AABB } from '../../src/math/AABB.js';
import { Vec2 } from '../../src/math/Vec2.js';

describe('AABB.overlaps', () => {
  it('detects overlapping boxes', () => {
    const a = new AABB(new Vec2(0, 0), new Vec2(4, 4));
    const b = new AABB(new Vec2(2, 2), new Vec2(6, 6));
    expect(a.overlaps(b)).toBe(true);
    expect(b.overlaps(a)).toBe(true);
  });

  it('detects non-overlapping boxes separated on x', () => {
    const a = new AABB(new Vec2(0, 0), new Vec2(2, 2));
    const b = new AABB(new Vec2(3, 0), new Vec2(5, 2));
    expect(a.overlaps(b)).toBe(false);
    expect(b.overlaps(a)).toBe(false);
  });

  it('detects non-overlapping boxes separated on y', () => {
    const a = new AABB(new Vec2(0, 0), new Vec2(2, 2));
    const b = new AABB(new Vec2(0, 3), new Vec2(2, 5));
    expect(a.overlaps(b)).toBe(false);
  });

  it('touching edges are considered overlapping (physics convention)', () => {
    const a = new AABB(new Vec2(0, 0), new Vec2(2, 2));
    const b = new AABB(new Vec2(2, 0), new Vec2(4, 2));
    expect(a.overlaps(b)).toBe(true);
  });
});

describe('AABB.contains', () => {
  it('larger box contains smaller box', () => {
    const outer = new AABB(new Vec2(0, 0), new Vec2(10, 10));
    const inner = new AABB(new Vec2(2, 2), new Vec2(8, 8));
    expect(outer.contains(inner)).toBe(true);
  });

  it('smaller box does not contain larger', () => {
    const outer = new AABB(new Vec2(0, 0), new Vec2(10, 10));
    const inner = new AABB(new Vec2(2, 2), new Vec2(8, 8));
    expect(inner.contains(outer)).toBe(false);
  });

  it('box contains itself', () => {
    const a = new AABB(new Vec2(1, 1), new Vec2(5, 5));
    expect(a.contains(a)).toBe(true);
  });
});

describe('AABB.combine', () => {
  it('enclosing box covers both inputs', () => {
    const a = new AABB(new Vec2(0, 0), new Vec2(2, 2));
    const b = new AABB(new Vec2(3, 3), new Vec2(5, 5));
    const c = AABB.combine(a, b);
    expect(c.min.x).toBe(0);
    expect(c.min.y).toBe(0);
    expect(c.max.x).toBe(5);
    expect(c.max.y).toBe(5);
    expect(c.contains(a)).toBe(true);
    expect(c.contains(b)).toBe(true);
  });
});

describe('AABB properties', () => {
  const box = new AABB(new Vec2(1, 2), new Vec2(5, 8));

  it('width', () => {
    expect(box.width).toBe(4);
  });

  it('height', () => {
    expect(box.height).toBe(6);
  });

  it('center', () => {
    const c = box.center;
    expect(c.x).toBe(3);
    expect(c.y).toBe(5);
  });

  it('perimeter', () => {
    expect(box.perimeter()).toBe(20); // 2 * (4 + 6)
  });
});
