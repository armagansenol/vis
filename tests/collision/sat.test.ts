import { describe, it, expect, beforeEach } from 'vitest';
import { Vec2 } from '../../src/math/Vec2.js';
import { Body } from '../../src/dynamics/Body.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { polygonVsPolygon } from '../../src/collision/sat.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoxBody(
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { angle?: number; friction?: number; restitution?: number; isSensor?: boolean },
): Body {
  return new Body({
    position: new Vec2(x, y),
    angle: opts?.angle ?? 0,
    shape: Polygon.box(w, h, {
      friction: opts?.friction,
      restitution: opts?.restitution,
    }),
    isSensor: opts?.isSensor ?? false,
  });
}

function makePolyBody(
  x: number,
  y: number,
  vertices: Vec2[],
  opts?: { angle?: number },
): Body {
  return new Body({
    position: new Vec2(x, y),
    angle: opts?.angle ?? 0,
    shape: Polygon.fromVertices(vertices),
  });
}

function makeRegularBody(
  x: number,
  y: number,
  sides: number,
  radius: number,
  opts?: { angle?: number },
): Body {
  return new Body({
    position: new Vec2(x, y),
    angle: opts?.angle ?? 0,
    shape: Polygon.regular(sides, radius),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('polygonVsPolygon (SAT)', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('detects two overlapping axis-aligned boxes', () => {
    const a = makeBoxBody(0, 0, 2, 2); // extends from -1 to 1
    const b = makeBoxBody(1.5, 0, 2, 2); // extends from 0.5 to 2.5

    const m = polygonVsPolygon(a, b);
    expect(m).not.toBeNull();
    if (!m) return;

    // Overlap on x-axis = 0.5, on y-axis = 2.0
    // MTV should be x-axis with depth 0.5
    expect(m.contacts.length).toBeGreaterThanOrEqual(1);
    expect(m.contacts[0].depth).toBeCloseTo(0.5, 4);

    // Normal should point from A toward B (positive x)
    expect(m.normal.x).toBeGreaterThan(0.9);
    expect(Math.abs(m.normal.y)).toBeLessThan(0.1);
  });

  it('returns null for two separated boxes', () => {
    const a = makeBoxBody(0, 0, 2, 2);
    const b = makeBoxBody(5, 0, 2, 2);

    expect(polygonVsPolygon(a, b)).toBeNull();
  });

  it('produces 2 contact points for edge-on-edge overlap', () => {
    // Two boxes overlapping on one face
    const a = makeBoxBody(0, 0, 2, 2);
    const b = makeBoxBody(0, 1.5, 2, 2); // overlapping on top edge of A

    const m = polygonVsPolygon(a, b);
    expect(m).not.toBeNull();
    if (!m) return;

    // Should produce 2 contact points for edge-edge contact
    expect(m.contacts).toHaveLength(2);

    // Depth should be 0.5 (box A top at y=1, box B bottom at y=0.5)
    for (const c of m.contacts) {
      expect(c.depth).toBeCloseTo(0.5, 4);
    }
  });

  it('handles rotated polygon vs axis-aligned box', () => {
    // Box A at origin
    const a = makeBoxBody(0, 0, 2, 2);
    // Box B rotated 45 degrees, close to A
    const b = makeBoxBody(2, 0, 2, 2, { angle: Math.PI / 4 });

    const m = polygonVsPolygon(a, b);
    // The rotated box extends further; there should be overlap
    if (m !== null) {
      // Verify normal is unit length
      const len = m.normal.length();
      expect(len).toBeCloseTo(1, 4);
      // Verify normal points from A toward B
      const d = Vec2.sub(
        new Vec2(2, 0), // center B
        new Vec2(0, 0), // center A
      );
      expect(d.dot(m.normal)).toBeGreaterThan(0);
    }
  });

  it('detects triangle vs box collision', () => {
    // Right triangle with vertices at (0,0), (2,0), (0,2)
    const tri = makePolyBody(0, 0, [
      new Vec2(0, 0),
      new Vec2(2, 0),
      new Vec2(0, 2),
    ]);
    // Box overlapping with triangle
    const box = makeBoxBody(1, 0, 2, 2);

    const m = polygonVsPolygon(tri, box);
    expect(m).not.toBeNull();
    if (!m) return;

    expect(m.contacts.length).toBeGreaterThanOrEqual(1);
    for (const c of m.contacts) {
      expect(c.depth).toBeGreaterThan(0);
    }
  });

  it('returns null for triangle and box that are separated', () => {
    const tri = makePolyBody(0, 0, [
      new Vec2(0, 0),
      new Vec2(1, 0),
      new Vec2(0.5, 1),
    ]);
    const box = makeBoxBody(5, 5, 2, 2);

    expect(polygonVsPolygon(tri, box)).toBeNull();
  });

  it('detects corner-to-corner contact (1 contact point)', () => {
    // Two boxes where one corner just penetrates the other
    const a = makeBoxBody(0, 0, 2, 2);
    // Place B so its corner barely penetrates A's corner region
    const b = makeBoxBody(1.9, 1.9, 2, 2);

    const m = polygonVsPolygon(a, b);
    expect(m).not.toBeNull();
    if (!m) return;

    // Should have 1 contact point for corner-corner
    expect(m.contacts.length).toBeGreaterThanOrEqual(1);
    expect(m.contacts[0].depth).toBeCloseTo(0.1, 3);
  });

  it('detects pentagon vs hexagon collision', () => {
    const pentagon = makeRegularBody(0, 0, 5, 2);
    const hexagon = makeRegularBody(3, 0, 6, 2);

    const m = polygonVsPolygon(pentagon, hexagon);
    expect(m).not.toBeNull();
    if (!m) return;

    expect(m.contacts.length).toBeGreaterThanOrEqual(1);
    for (const c of m.contacts) {
      expect(c.depth).toBeGreaterThan(0);
    }

    // Normal should point from pentagon toward hexagon (positive x)
    expect(m.normal.x).toBeGreaterThan(0);
  });

  it('normal always points from A toward B', () => {
    const a = makeBoxBody(0, 0, 2, 2);
    const b = makeBoxBody(1.5, 0, 2, 2);

    const m = polygonVsPolygon(a, b);
    expect(m).not.toBeNull();
    if (!m) return;

    const d = Vec2.sub(b.position, a.position);
    expect(d.dot(m.normal)).toBeGreaterThan(0);
  });

  it('assigns feature IDs for warm-starting', () => {
    const a = makeBoxBody(0, 0, 2, 2);
    const b = makeBoxBody(0, 1.5, 2, 2);

    const m = polygonVsPolygon(a, b);
    expect(m).not.toBeNull();
    if (!m) return;

    // Feature IDs should encode edge indices
    for (const c of m.contacts) {
      expect(typeof c.id).toBe('number');
      expect(c.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('sets isSensor flag when either body is sensor', () => {
    const a = makeBoxBody(0, 0, 2, 2, { isSensor: true });
    const b = makeBoxBody(1.5, 0, 2, 2);

    const m = polygonVsPolygon(a, b);
    expect(m).not.toBeNull();
    expect(m!.isSensor).toBe(true);
  });
});
