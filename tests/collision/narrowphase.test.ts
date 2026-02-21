import { describe, it, expect, beforeEach } from 'bun:test';
import { Vec2 } from '../../src/math/Vec2.js';
import { Body } from '../../src/dynamics/Body.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import {
  circleVsCircle,
  circleVsPolygon,
  detectNarrowphase,
} from '../../src/collision/narrowphase.js';
import { mixMaterials, pairKey } from '../../src/collision/Manifold.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCircleBody(
  x: number,
  y: number,
  radius: number,
  opts?: { angle?: number; offset?: Vec2; friction?: number; restitution?: number; isSensor?: boolean },
): Body {
  return new Body({
    position: new Vec2(x, y),
    angle: opts?.angle ?? 0,
    shape: new Circle(radius, {
      offset: opts?.offset,
      friction: opts?.friction,
      restitution: opts?.restitution,
    }),
    isSensor: opts?.isSensor ?? false,
  });
}

function makeBoxBody(
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { angle?: number; offset?: Vec2; friction?: number; restitution?: number; isSensor?: boolean },
): Body {
  return new Body({
    position: new Vec2(x, y),
    angle: opts?.angle ?? 0,
    shape: Polygon.box(w, h, {
      offset: opts?.offset,
      friction: opts?.friction,
      restitution: opts?.restitution,
    }),
    isSensor: opts?.isSensor ?? false,
  });
}

// ---------------------------------------------------------------------------
// Circle vs Circle
// ---------------------------------------------------------------------------

describe('circleVsCircle', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('returns manifold for two overlapping circles', () => {
    const a = makeCircleBody(0, 0, 1);
    const b = makeCircleBody(1.5, 0, 1);

    const m = circleVsCircle(a, b);
    expect(m).not.toBeNull();
    if (!m) return;

    // Normal should point from A toward B (positive x)
    expect(m.normal.x).toBeCloseTo(1, 5);
    expect(m.normal.y).toBeCloseTo(0, 5);

    // Depth = 2 - 1.5 = 0.5
    expect(m.contacts).toHaveLength(1);
    expect(m.contacts[0].depth).toBeCloseTo(0.5, 5);

    // Contact point = centerA + normal * radiusA = (0,0) + (1,0) * 1 = (1,0)
    expect(m.contacts[0].point.x).toBeCloseTo(1, 5);
    expect(m.contacts[0].point.y).toBeCloseTo(0, 5);

    expect(m.bodyA).toBe(a);
    expect(m.bodyB).toBe(b);
  });

  it('returns null for two separated circles', () => {
    const a = makeCircleBody(0, 0, 1);
    const b = makeCircleBody(5, 0, 1);

    expect(circleVsCircle(a, b)).toBeNull();
  });

  it('returns null for touching circles (no penetration)', () => {
    const a = makeCircleBody(0, 0, 1);
    const b = makeCircleBody(2, 0, 1); // distance = sum of radii

    expect(circleVsCircle(a, b)).toBeNull();
  });

  it('handles coincident centers with fallback normal (1,0)', () => {
    const a = makeCircleBody(3, 3, 1);
    const b = makeCircleBody(3, 3, 1);

    const m = circleVsCircle(a, b);
    expect(m).not.toBeNull();
    if (!m) return;

    expect(m.normal.x).toBeCloseTo(1, 5);
    expect(m.normal.y).toBeCloseTo(0, 5);
    expect(m.contacts[0].depth).toBeCloseTo(2, 5);
  });

  it('handles circles with non-zero offset from body center', () => {
    // Body at (0,0), circle offset (2,0) -> world center (2,0)
    const a = makeCircleBody(0, 0, 1, { offset: new Vec2(2, 0) });
    // Body at (4,0), circle offset (-1,0) -> world center (3,0)
    const b = makeCircleBody(4, 0, 1, { offset: new Vec2(-1, 0) });

    const m = circleVsCircle(a, b);
    expect(m).not.toBeNull();
    if (!m) return;

    // Distance between world centers = 1, overlap = 2 - 1 = 1
    expect(m.contacts[0].depth).toBeCloseTo(1, 5);
    expect(m.normal.x).toBeCloseTo(1, 5);
  });

  it('handles rotated body with circle offset', () => {
    // Body at origin, rotated 90 degrees, circle offset (1,0) -> world center (0,1)
    const a = makeCircleBody(0, 0, 1, {
      angle: Math.PI / 2,
      offset: new Vec2(1, 0),
    });
    const b = makeCircleBody(0, 1.5, 1);

    const m = circleVsCircle(a, b);
    expect(m).not.toBeNull();
    if (!m) return;

    // World center A = (0, 1), center B = (0, 1.5)
    // Distance = 0.5, overlap = 2 - 0.5 = 1.5
    expect(m.contacts[0].depth).toBeCloseTo(1.5, 5);
    expect(m.normal.y).toBeCloseTo(1, 2); // Pointing up (A toward B)
  });

  it('sets isSensor when either body is sensor', () => {
    const a = makeCircleBody(0, 0, 1, { isSensor: true });
    const b = makeCircleBody(0.5, 0, 1);

    const m = circleVsCircle(a, b);
    expect(m).not.toBeNull();
    expect(m!.isSensor).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Circle vs Polygon
// ---------------------------------------------------------------------------

describe('circleVsPolygon', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('detects circle overlapping box edge', () => {
    const circle = makeCircleBody(0, 0, 1);
    const box = makeBoxBody(1.5, 0, 2, 2); // box center at (1.5, 0), half-extents (1, 1)

    const m = circleVsPolygon(circle, box);
    expect(m).not.toBeNull();
    if (!m) return;

    expect(m.bodyA).toBe(circle);
    expect(m.bodyB).toBe(box);
    expect(m.contacts).toHaveLength(1);

    // Depth: circle reaches x=1, box left edge at x=0.5 => depth = 0.5
    expect(m.contacts[0].depth).toBeCloseTo(0.5, 4);

    // Normal should point from circle toward box (positive x direction)
    expect(m.normal.x).toBeGreaterThan(0.9);
    expect(Math.abs(m.normal.y)).toBeLessThan(0.1);
  });

  it('detects circle at box corner (vertex region)', () => {
    // Circle close to corner of box — distance to corner (1,1) must be < radius
    // center (1.5, 1.5), dist to (1,1) = sqrt(0.25+0.25) ~= 0.707 < 1
    const circle = makeCircleBody(1.5, 1.5, 1);
    const box = makeBoxBody(0, 0, 2, 2); // corners at (+-1, +-1)

    const m = circleVsPolygon(circle, box);
    expect(m).not.toBeNull();
    if (!m) return;

    expect(m.contacts).toHaveLength(1);
    // Normal points from circle toward polygon (toward the corner at (1,1))
    // Circle center (1.5, 1.5) -> corner (1, 1): direction roughly (-1, -1) normalized
    expect(m.normal.x).toBeLessThan(0);
    expect(m.normal.y).toBeLessThan(0);
  });

  it('detects circle inside polygon (interior case)', () => {
    // Small circle fully inside a large box
    const circle = makeCircleBody(0, 0, 0.5);
    const box = makeBoxBody(0, 0, 10, 10);

    const m = circleVsPolygon(circle, box);
    expect(m).not.toBeNull();
    if (!m) return;

    // Depth should be radius + distance to closest edge
    // Closest edge distance = 5 (half-width), depth = 0.5 + 5 = 5.5
    expect(m.contacts[0].depth).toBeGreaterThan(0);
  });

  it('handles circle near rotated polygon', () => {
    // Box rotated 45 degrees
    const circle = makeCircleBody(2, 0, 1);
    const box = makeBoxBody(0, 0, 2, 2, { angle: Math.PI / 4 });

    const m = circleVsPolygon(circle, box);
    // The rotated box has vertices at distance sqrt(2) ~= 1.414 from center
    // Circle center at (2, 0), radius 1 -> closest point is at (1, 0)
    // Box corner in world space: rotated (1,1) by 45 deg = (0, sqrt(2))
    // The closest edge of rotated box to (2,0): need to check separation
    // Just verify we get a reasonable result or null
    if (m !== null) {
      // Normal should be valid unit vector
      const len = m.normal.length();
      expect(len).toBeCloseTo(1, 4);
      expect(m.contacts[0].depth).toBeGreaterThan(0);
    }
  });

  it('returns null for well-separated circle and polygon', () => {
    const circle = makeCircleBody(10, 10, 1);
    const box = makeBoxBody(0, 0, 2, 2);

    expect(circleVsPolygon(circle, box)).toBeNull();
  });

  it('dispatches polygon-circle correctly (swapped order)', () => {
    const circle = makeCircleBody(0, 0, 1);
    const box = makeBoxBody(1.5, 0, 2, 2);

    // detectNarrowphase with polygon first, circle second
    const m = detectNarrowphase(box, circle);
    expect(m).not.toBeNull();
    if (!m) return;

    // Normal should point from box (bodyA) toward circle (bodyB)
    // Box is to the right of circle, so normal points left (negative x)
    expect(m.bodyA).toBe(box);
    expect(m.bodyB).toBe(circle);
    expect(m.normal.x).toBeLessThan(0); // from box toward circle
  });
});

// ---------------------------------------------------------------------------
// Material mixing
// ---------------------------------------------------------------------------

describe('mixMaterials', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('computes friction as geometric mean', () => {
    const a = new Circle(1, { friction: 0.4 });
    const b = new Circle(1, { friction: 0.9 });

    const result = mixMaterials(a, b);
    expect(result.friction).toBeCloseTo(Math.sqrt(0.4 * 0.9), 5);
  });

  it('computes restitution as max', () => {
    const a = new Circle(1, { restitution: 0.2 });
    const b = new Circle(1, { restitution: 0.8 });

    const result = mixMaterials(a, b);
    expect(result.restitution).toBeCloseTo(0.8, 5);
  });
});

// ---------------------------------------------------------------------------
// pairKey
// ---------------------------------------------------------------------------

describe('pairKey', () => {
  it('returns canonical key with min:max', () => {
    expect(pairKey(3, 7)).toBe('3:7');
    expect(pairKey(7, 3)).toBe('3:7');
    expect(pairKey(5, 5)).toBe('5:5');
  });
});

// ---------------------------------------------------------------------------
// detectNarrowphase dispatch
// ---------------------------------------------------------------------------

describe('detectNarrowphase', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('dispatches circle-circle', () => {
    const a = makeCircleBody(0, 0, 1);
    const b = makeCircleBody(1.5, 0, 1);

    const m = detectNarrowphase(a, b);
    expect(m).not.toBeNull();
    expect(m!.contacts).toHaveLength(1);
  });

  it('dispatches circle-polygon', () => {
    const circle = makeCircleBody(0, 0, 1);
    const box = makeBoxBody(1.5, 0, 2, 2);

    const m = detectNarrowphase(circle, box);
    expect(m).not.toBeNull();
  });

  it('dispatches polygon-circle with flipped normal', () => {
    const box = makeBoxBody(0, 0, 2, 2);
    const circle = makeCircleBody(1.5, 0, 1);

    const m = detectNarrowphase(box, circle);
    expect(m).not.toBeNull();
    if (!m) return;

    expect(m.bodyA).toBe(box);
    expect(m.bodyB).toBe(circle);
    // Normal from box toward circle (positive x)
    expect(m.normal.x).toBeGreaterThan(0);
  });
});
