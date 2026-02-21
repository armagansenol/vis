import { describe, it, expect } from 'vitest';
import { Circle } from '../../src/shapes/Circle.js';
import { Vec2 } from '../../src/math/Vec2.js';
import { ShapeType, DEFAULT_DENSITY, DEFAULT_FRICTION, DEFAULT_RESTITUTION } from '../../src/shapes/Shape.js';
import { approxEqual } from '../../src/math/utils.js';

describe('Circle', () => {
  describe('construction', () => {
    it('stores radius and default material', () => {
      const c = new Circle(1);
      expect(c.radius).toBe(1);
      expect(c.type).toBe(ShapeType.Circle);
      expect(c.material.density).toBe(DEFAULT_DENSITY);
      expect(c.material.friction).toBe(DEFAULT_FRICTION);
      expect(c.material.restitution).toBe(DEFAULT_RESTITUTION);
    });

    it('uses custom material values from options', () => {
      const c = new Circle(2, { density: 5, friction: 0.8, restitution: 0.5 });
      expect(c.material.density).toBe(5);
      expect(c.material.friction).toBe(0.8);
      expect(c.material.restitution).toBe(0.5);
    });

    it('clones the offset vector', () => {
      const off = new Vec2(3, 4);
      const c = new Circle(1, { offset: off });
      off.set(99, 99);
      expect(c.offset.x).toBe(3);
      expect(c.offset.y).toBe(4);
    });

    it('defaults offset to zero', () => {
      const c = new Circle(1);
      expect(c.offset.x).toBe(0);
      expect(c.offset.y).toBe(0);
    });

    it('throws on non-positive radius', () => {
      expect(() => new Circle(0)).toThrow();
      expect(() => new Circle(-1)).toThrow();
    });
  });

  describe('computeMassData', () => {
    it('unit circle, density=1: area=pi, mass=pi, inertia=pi/2', () => {
      const c = new Circle(1);
      const md = c.computeMassData(1);
      expect(approxEqual(md.mass, Math.PI, 1e-10)).toBe(true);
      expect(approxEqual(md.inertia, Math.PI / 2, 1e-10)).toBe(true);
      expect(md.centroid.x).toBe(0);
      expect(md.centroid.y).toBe(0);
    });

    it('r=2, density=3: area=4pi, mass=12pi, inertia=24pi', () => {
      const c = new Circle(2);
      const md = c.computeMassData(3);
      expect(approxEqual(md.mass, 12 * Math.PI, 1e-10)).toBe(true);
      // I = 0.5 * m * r^2 = 0.5 * 12pi * 4 = 24pi
      expect(approxEqual(md.inertia, 24 * Math.PI, 1e-10)).toBe(true);
    });

    it('parallel axis theorem: offset (5,0), r=1, density=1', () => {
      const c = new Circle(1, { offset: new Vec2(5, 0) });
      const md = c.computeMassData(1);
      // I_center = 0.5 * pi * 1 = pi/2
      // I_parallel = pi * 25
      // I_total = pi/2 + 25*pi = 25.5*pi
      const expected = Math.PI / 2 + Math.PI * 25;
      expect(approxEqual(md.inertia, expected, 1e-10)).toBe(true);
    });

    it('centroid equals offset', () => {
      const c = new Circle(1, { offset: new Vec2(3, 7) });
      const md = c.computeMassData(1);
      expect(md.centroid.x).toBe(3);
      expect(md.centroid.y).toBe(7);
    });
  });

  describe('computeAABB', () => {
    it('circle at origin, r=3, angle=0', () => {
      const c = new Circle(3);
      const aabb = c.computeAABB(new Vec2(0, 0), 0);
      expect(approxEqual(aabb.min.x, -3, 1e-10)).toBe(true);
      expect(approxEqual(aabb.min.y, -3, 1e-10)).toBe(true);
      expect(approxEqual(aabb.max.x, 3, 1e-10)).toBe(true);
      expect(approxEqual(aabb.max.y, 3, 1e-10)).toBe(true);
    });

    it('circle at (10, 20), r=1, angle=0', () => {
      const c = new Circle(1);
      const aabb = c.computeAABB(new Vec2(10, 20), 0);
      expect(approxEqual(aabb.min.x, 9, 1e-10)).toBe(true);
      expect(approxEqual(aabb.min.y, 19, 1e-10)).toBe(true);
      expect(approxEqual(aabb.max.x, 11, 1e-10)).toBe(true);
      expect(approxEqual(aabb.max.y, 21, 1e-10)).toBe(true);
    });

    it('circle with offset, rotated', () => {
      // offset (2, 0), rotated 90 degrees -> world offset becomes (0, 2)
      const c = new Circle(1, { offset: new Vec2(2, 0) });
      const aabb = c.computeAABB(new Vec2(0, 0), Math.PI / 2);
      expect(approxEqual(aabb.min.x, -1, 1e-6)).toBe(true);
      expect(approxEqual(aabb.min.y, 1, 1e-6)).toBe(true);
      expect(approxEqual(aabb.max.x, 1, 1e-6)).toBe(true);
      expect(approxEqual(aabb.max.y, 3, 1e-6)).toBe(true);
    });
  });
});
