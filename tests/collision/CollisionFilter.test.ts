import { describe, it, expect, beforeEach } from 'vitest';
import { Body, BodyType } from '../../src/dynamics/index.js';
import { shouldCollide } from '../../src/collision/CollisionFilter.js';
import { Circle } from '../../src/shapes/Circle.js';

/** Helper: create a dynamic body with a unit circle. */
function makeBody(opts: Partial<import('../../src/dynamics/Body.js').BodyOptions> = {}): Body {
  return new Body({ shape: new Circle(1), ...opts });
}

describe('CollisionFilter', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  // ---------------------------------------------------------------------------
  // Body collision identity fields
  // ---------------------------------------------------------------------------

  describe('Body collision fields', () => {
    it('should default categoryBits to 0x0001 and maskBits to 0xFFFF', () => {
      const body = makeBody();

      expect(body.categoryBits).toBe(0x0001);
      expect(body.maskBits).toBe(0xFFFF);
    });

    it('should auto-increment id across instances', () => {
      const a = makeBody();
      const b = makeBody();
      const c = makeBody();

      expect(a.id).toBe(0);
      expect(b.id).toBe(1);
      expect(c.id).toBe(2);
    });

    it('should reset id counter for test isolation', () => {
      const a = makeBody();
      expect(a.id).toBe(0);

      Body.resetIdCounter();

      const b = makeBody();
      expect(b.id).toBe(0);
    });

    it('should default isSensor to false', () => {
      const body = makeBody();
      expect(body.isSensor).toBe(false);
    });

    it('should accept isSensor via options', () => {
      const body = makeBody({ isSensor: true });
      expect(body.isSensor).toBe(true);
    });

    it('should accept categoryBits and maskBits via options', () => {
      const body = makeBody({ categoryBits: 0x0004, maskBits: 0x0002 });

      expect(body.categoryBits).toBe(0x0004);
      expect(body.maskBits).toBe(0x0002);
    });
  });

  // ---------------------------------------------------------------------------
  // shouldCollide
  // ---------------------------------------------------------------------------

  describe('shouldCollide', () => {
    it('should return true for two default dynamic bodies', () => {
      const a = makeBody();
      const b = makeBody();

      expect(shouldCollide(a, b)).toBe(true);
    });

    it('should return false when masks exclude each other', () => {
      const a = makeBody({ categoryBits: 0x0001, maskBits: 0x0002 });
      const b = makeBody({ categoryBits: 0x0004, maskBits: 0x0008 });

      // a.category (0x0001) & b.mask (0x0008) = 0 -> false
      expect(shouldCollide(a, b)).toBe(false);
    });

    it('should return false when only one direction passes', () => {
      // a sees b, but b does not see a
      const a = makeBody({ categoryBits: 0x0001, maskBits: 0xFFFF });
      const b = makeBody({ categoryBits: 0x0002, maskBits: 0x0002 }); // b.mask excludes a.category (0x0001)

      expect(shouldCollide(a, b)).toBe(false);
    });

    it('should return false for two static bodies', () => {
      const a = makeBody({ type: BodyType.Static });
      const b = makeBody({ type: BodyType.Static });

      expect(shouldCollide(a, b)).toBe(false);
    });

    it('should return true for static + dynamic with matching masks', () => {
      const a = makeBody({ type: BodyType.Static });
      const b = makeBody({ type: BodyType.Dynamic });

      expect(shouldCollide(a, b)).toBe(true);
    });

    it('should return true for kinematic + dynamic with matching masks', () => {
      const a = makeBody({ type: BodyType.Kinematic });
      const b = makeBody({ type: BodyType.Dynamic });

      expect(shouldCollide(a, b)).toBe(true);
    });
  });
});
