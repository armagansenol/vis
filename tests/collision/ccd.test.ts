import { describe, it, expect, beforeEach } from 'vitest';
import { Body } from '../../src/dynamics/Body.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Vec2 } from '../../src/math/Vec2.js';
import { computeTOI } from '../../src/collision/ccd.js';

describe('CCD — computeTOI', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  // ---------------------------------------------------------------------------
  // Circle vs Circle
  // ---------------------------------------------------------------------------

  describe('circle vs circle', () => {
    it('detects TOI for head-on collision', () => {
      const a = new Body({
        shape: new Circle(0.5),
        position: new Vec2(0, 0),
        velocity: new Vec2(10, 0),
      });
      const b = new Body({
        shape: new Circle(0.5),
        position: new Vec2(5, 0),
        velocity: new Vec2(0, 0),
      });

      const dt = 1;
      const result = computeTOI(a, b, dt);

      expect(result.hit).toBe(true);
      // They should meet when distance = 1 (sum of radii)
      // a travels 10*t, distance = 5 - 10*t = 1, t = 0.4
      expect(result.toi).toBeCloseTo(0.4, 2);
    });

    it('returns no hit when circles move apart', () => {
      const a = new Body({
        shape: new Circle(0.5),
        position: new Vec2(0, 0),
        velocity: new Vec2(-10, 0),
      });
      const b = new Body({
        shape: new Circle(0.5),
        position: new Vec2(5, 0),
        velocity: new Vec2(10, 0),
      });

      const result = computeTOI(a, b, 1);
      expect(result.hit).toBe(false);
    });

    it('returns toi=0 when already overlapping', () => {
      const a = new Body({
        shape: new Circle(1),
        position: new Vec2(0, 0),
        velocity: new Vec2(10, 0),
      });
      const b = new Body({
        shape: new Circle(1),
        position: new Vec2(1, 0),
        velocity: new Vec2(0, 0),
      });

      const result = computeTOI(a, b, 1);
      expect(result.hit).toBe(true);
      expect(result.toi).toBe(0);
    });

    it('detects TOI for both moving circles', () => {
      const a = new Body({
        shape: new Circle(0.5),
        position: new Vec2(0, 0),
        velocity: new Vec2(5, 0),
      });
      const b = new Body({
        shape: new Circle(0.5),
        position: new Vec2(10, 0),
        velocity: new Vec2(-5, 0),
      });

      const result = computeTOI(a, b, 1);
      expect(result.hit).toBe(true);
      // Relative velocity = 10, need to close 9 units (10 - 1 for radii)
      // t = 9/10 = 0.9
      expect(result.toi).toBeCloseTo(0.9, 2);
    });

    it('returns no hit when circles pass perpendicular', () => {
      const a = new Body({
        shape: new Circle(0.5),
        position: new Vec2(0, 0),
        velocity: new Vec2(10, 0),
      });
      const b = new Body({
        shape: new Circle(0.5),
        position: new Vec2(5, 5),
        velocity: new Vec2(0, 0),
      });

      const result = computeTOI(a, b, 1);
      expect(result.hit).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Circle vs Polygon
  // ---------------------------------------------------------------------------

  describe('circle vs polygon', () => {
    it('detects TOI for circle hitting a box', () => {
      // Bullet at x=0 moving right at 10 m/s, wall centered at x=3 (half-width 1)
      // In dt=1, bullet sweeps from x=0 to x=10. Wall left face at x=2.
      // Contact when circle surface reaches wall face: 0 + 10*t + 0.5 = 2 => t = 0.15
      const bullet = new Body({
        shape: new Circle(0.5),
        position: new Vec2(0, 0),
        velocity: new Vec2(10, 0),
      });
      const wall = new Body({
        type: BodyType.Static,
        shape: Polygon.box(2, 4),
        position: new Vec2(3, 0),
      });

      const dt = 1;
      const result = computeTOI(bullet, wall, dt);

      expect(result.hit).toBe(true);
      expect(result.toi).toBeGreaterThan(0);
      expect(result.toi).toBeLessThan(1);
      // Expected TOI around 0.15
      expect(result.toi).toBeCloseTo(0.15, 1);
    });

    it('returns no hit for circle moving away from polygon', () => {
      const circle = new Body({
        shape: new Circle(0.5),
        position: new Vec2(-5, 0),
        velocity: new Vec2(-10, 0),
      });
      const box = new Body({
        type: BodyType.Static,
        shape: Polygon.box(2, 2),
        position: new Vec2(0, 0),
      });

      const result = computeTOI(circle, box, 1);
      expect(result.hit).toBe(false);
    });

    it('returns toi=0 when already overlapping', () => {
      const circle = new Body({
        shape: new Circle(1),
        position: new Vec2(0, 0),
        velocity: new Vec2(10, 0),
      });
      const box = new Body({
        type: BodyType.Static,
        shape: Polygon.box(2, 2),
        position: new Vec2(0.5, 0),
      });

      const result = computeTOI(circle, box, 1);
      expect(result.hit).toBe(true);
      expect(result.toi).toBe(0);
    });
  });
});
