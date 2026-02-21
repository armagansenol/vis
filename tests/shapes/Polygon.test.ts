import { describe, it, expect } from 'vitest';
import { Polygon } from '../../src/shapes/Polygon.js';
import { Vec2 } from '../../src/math/Vec2.js';
import { approxEqual } from '../../src/math/utils.js';

describe('Polygon', () => {
  // -------------------------------------------------------------------------
  // Box factory
  // -------------------------------------------------------------------------

  describe('box factory', () => {
    it('creates a 4-vertex polygon', () => {
      const box = Polygon.box(2, 2);
      expect(box.vertices.length).toBe(4);
      expect(box.normals.length).toBe(4);
    });

    it('2x2 box: area=4, mass=4 (density=1), inertia=m*(w^2+h^2)/12', () => {
      const box = Polygon.box(2, 2);
      const md = box.computeMassData(1);
      expect(approxEqual(md.mass, 4, 1e-10)).toBe(true);
      // Inertia of rectangle about centroid: m*(w^2+h^2)/12 = 4*(4+4)/12 = 8/3
      expect(approxEqual(md.inertia, 8 / 3, 1e-10)).toBe(true);
    });

    it('1x1 box: area=1, mass=1, inertia=1*(1+1)/12=1/6', () => {
      const box = Polygon.box(1, 1);
      const md = box.computeMassData(1);
      expect(approxEqual(md.mass, 1, 1e-10)).toBe(true);
      expect(approxEqual(md.inertia, 1 / 6, 1e-10)).toBe(true);
    });

    it('centroid at origin for centered box', () => {
      const box = Polygon.box(4, 6);
      const md = box.computeMassData(1);
      expect(approxEqual(md.centroid.x, 0, 1e-10)).toBe(true);
      expect(approxEqual(md.centroid.y, 0, 1e-10)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Regular polygon factory
  // -------------------------------------------------------------------------

  describe('regular factory', () => {
    it('regular triangle (3 sides): area matches formula', () => {
      const r = 1;
      const tri = Polygon.regular(3, r);
      const md = tri.computeMassData(1);
      // Side length of equilateral triangle inscribed in unit circle:
      // s = 2 * r * sin(pi/3) = 2 * sqrt(3)/2 = sqrt(3)
      // Area = (sqrt(3)/4) * s^2 = (sqrt(3)/4) * 3 = 3*sqrt(3)/4
      const expectedArea = (3 * Math.sqrt(3)) / 4;
      expect(approxEqual(md.mass, expectedArea, 1e-6)).toBe(true);
    });

    it('regular hexagon: area close to 2.598 * r^2', () => {
      const r = 1;
      const hex = Polygon.regular(6, r);
      const md = hex.computeMassData(1);
      // Area of regular hexagon = (3*sqrt(3)/2) * r^2 ~ 2.598 * r^2
      const expectedArea = (3 * Math.sqrt(3)) / 2;
      expect(approxEqual(md.mass, expectedArea, 1e-6)).toBe(true);
    });

    it('throws for fewer than 3 sides', () => {
      expect(() => Polygon.regular(2, 1)).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // fromVertices
  // -------------------------------------------------------------------------

  describe('fromVertices', () => {
    it('creates polygon from CCW vertices', () => {
      const verts = [
        new Vec2(0, 0),
        new Vec2(1, 0),
        new Vec2(1, 1),
        new Vec2(0, 1),
      ];
      const poly = Polygon.fromVertices(verts);
      expect(poly.vertices.length).toBe(4);
    });

    it('clones input vertices', () => {
      const verts = [
        new Vec2(0, 0),
        new Vec2(1, 0),
        new Vec2(1, 1),
        new Vec2(0, 1),
      ];
      const poly = Polygon.fromVertices(verts);
      verts[0].set(99, 99);
      expect(poly.vertices[0].x).not.toBe(99);
    });

    it('throws for non-convex polygon (L-shape)', () => {
      const concave = [
        new Vec2(0, 0),
        new Vec2(2, 0),
        new Vec2(2, 1),
        new Vec2(1, 1),
        new Vec2(1, 2),
        new Vec2(0, 2),
      ];
      expect(() => Polygon.fromVertices(concave)).toThrow(/not convex/i);
    });

    it('throws for fewer than 3 vertices', () => {
      expect(() => Polygon.fromVertices([new Vec2(0, 0), new Vec2(1, 0)])).toThrow();
    });

    it('enforces CCW winding: reverses CW vertices', () => {
      // CW square
      const cw = [
        new Vec2(0, 0),
        new Vec2(0, 1),
        new Vec2(1, 1),
        new Vec2(1, 0),
      ];
      const poly = Polygon.fromVertices(cw);
      // The area computed from mass data should be positive
      const md = poly.computeMassData(1);
      expect(md.mass).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Edge normals
  // -------------------------------------------------------------------------

  describe('normals', () => {
    it('unit box (CCW) normals: down, right, up, left', () => {
      // Box vertices in CCW order: (-1,-1), (1,-1), (1,1), (-1,1)
      const box = Polygon.box(2, 2);
      const normals = box.normals;

      // Edge 0: (-1,-1) -> (1,-1) direction is (2,0), outward normal = (0,-1) (bottom)
      expect(approxEqual(normals[0].x, 0, 1e-10)).toBe(true);
      expect(approxEqual(normals[0].y, -1, 1e-10)).toBe(true);

      // Edge 1: (1,-1) -> (1,1) direction is (0,2), outward normal = (1,0) (right)
      expect(approxEqual(normals[1].x, 1, 1e-10)).toBe(true);
      expect(approxEqual(normals[1].y, 0, 1e-10)).toBe(true);

      // Edge 2: (1,1) -> (-1,1) direction is (-2,0), outward normal = (0,1) (top)
      expect(approxEqual(normals[2].x, 0, 1e-10)).toBe(true);
      expect(approxEqual(normals[2].y, 1, 1e-10)).toBe(true);

      // Edge 3: (-1,1) -> (-1,-1) direction is (0,-2), outward normal = (-1,0) (left)
      expect(approxEqual(normals[3].x, -1, 1e-10)).toBe(true);
      expect(approxEqual(normals[3].y, 0, 1e-10)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Support function
  // -------------------------------------------------------------------------

  describe('support', () => {
    it('box support in direction (1,1) returns top-right vertex', () => {
      const box = Polygon.box(2, 2);
      const sup = box.support(new Vec2(1, 1));
      expect(approxEqual(sup.x, 1, 1e-10)).toBe(true);
      expect(approxEqual(sup.y, 1, 1e-10)).toBe(true);
    });

    it('box support in direction (-1, 0) returns a left-side vertex', () => {
      const box = Polygon.box(2, 2);
      const sup = box.support(new Vec2(-1, 0));
      expect(approxEqual(sup.x, -1, 1e-10)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // AABB
  // -------------------------------------------------------------------------

  describe('computeAABB', () => {
    it('box at origin, no rotation', () => {
      const box = Polygon.box(4, 2);
      const aabb = box.computeAABB(new Vec2(0, 0), 0);
      expect(approxEqual(aabb.min.x, -2, 1e-10)).toBe(true);
      expect(approxEqual(aabb.min.y, -1, 1e-10)).toBe(true);
      expect(approxEqual(aabb.max.x, 2, 1e-10)).toBe(true);
      expect(approxEqual(aabb.max.y, 1, 1e-10)).toBe(true);
    });

    it('box rotated 45 degrees has expanded bounds', () => {
      // 2x2 box rotated 45 degrees: corners at distance sqrt(2) from center
      const box = Polygon.box(2, 2);
      const aabb = box.computeAABB(new Vec2(0, 0), Math.PI / 4);
      const s = Math.sqrt(2);
      expect(approxEqual(aabb.min.x, -s, 1e-6)).toBe(true);
      expect(approxEqual(aabb.min.y, -s, 1e-6)).toBe(true);
      expect(approxEqual(aabb.max.x, s, 1e-6)).toBe(true);
      expect(approxEqual(aabb.max.y, s, 1e-6)).toBe(true);
    });

    it('box at offset position', () => {
      const box = Polygon.box(2, 2);
      const aabb = box.computeAABB(new Vec2(10, 5), 0);
      expect(approxEqual(aabb.min.x, 9, 1e-10)).toBe(true);
      expect(approxEqual(aabb.min.y, 4, 1e-10)).toBe(true);
      expect(approxEqual(aabb.max.x, 11, 1e-10)).toBe(true);
      expect(approxEqual(aabb.max.y, 6, 1e-10)).toBe(true);
    });
  });
});
