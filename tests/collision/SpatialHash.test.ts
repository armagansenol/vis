import { describe, it, expect, beforeEach } from 'vitest';
import { Body, BodyType } from '../../src/dynamics/index.js';
import { SpatialHash } from '../../src/collision/SpatialHash.js';
import { shouldCollide } from '../../src/collision/CollisionFilter.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { Vec2 } from '../../src/math/Vec2.js';
import { AABB } from '../../src/math/AABB.js';

/** Helper: create a dynamic body at a given position. */
function makeBody(
  x: number,
  y: number,
  opts: Partial<import('../../src/dynamics/Body.js').BodyOptions> = {},
): Body {
  return new Body({
    shape: new Circle(0.5),
    position: new Vec2(x, y),
    ...opts,
  });
}

/** Compute AABB for a body from its shape. */
function bodyAABB(body: Body): AABB {
  return body.shape.computeAABB(body.position, body.angle);
}

describe('SpatialHash', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('should return 1 pair for two overlapping bodies in same cell', () => {
    const hash = new SpatialHash(2);
    const a = makeBody(0, 0);
    const b = makeBody(0.5, 0);

    hash.insert(a, bodyAABB(a));
    hash.insert(b, bodyAABB(b));

    const pairs = hash.queryPairs(shouldCollide);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toContain(a);
    expect(pairs[0]).toContain(b);
  });

  it('should return 0 pairs for two distant bodies in different cells', () => {
    const hash = new SpatialHash(2);
    const a = makeBody(0, 0);
    const b = makeBody(100, 100);

    hash.insert(a, bodyAABB(a));
    hash.insert(b, bodyAABB(b));

    const pairs = hash.queryPairs(shouldCollide);
    expect(pairs).toHaveLength(0);
  });

  it('should pair bodies spanning multiple cells with a neighbor', () => {
    // Use a large box that spans multiple cells (cell size 2)
    const hash = new SpatialHash(2);
    const bigBox = new Body({
      shape: Polygon.box(4, 4), // AABB from -2 to +2
      position: new Vec2(0, 0),
    });
    const smallBody = makeBody(1.5, 0); // Close enough to overlap cells

    hash.insert(bigBox, bodyAABB(bigBox));
    hash.insert(smallBody, bodyAABB(smallBody));

    const pairs = hash.queryPairs(shouldCollide);
    // Both bodies share at least one cell, so exactly 1 unique pair
    expect(pairs).toHaveLength(1);
    const ids = new Set(pairs.flatMap(([a, b]) => [a.id, b.id]));
    expect(ids).toContain(bigBox.id);
    expect(ids).toContain(smallBody.id);
  });

  it('should not report the same pair twice when bodies share multiple cells', () => {
    // Two large boxes that overlap in multiple cells
    const hash = new SpatialHash(1); // Small cells = more overlap
    const a = new Body({
      shape: Polygon.box(3, 3),
      position: new Vec2(0, 0),
    });
    const b = new Body({
      shape: Polygon.box(3, 3),
      position: new Vec2(1, 0),
    });

    hash.insert(a, bodyAABB(a));
    hash.insert(b, bodyAABB(b));

    const pairs = hash.queryPairs(shouldCollide);
    // Despite sharing many cells, only 1 unique pair due to deduplication
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toContain(a);
    expect(pairs[0]).toContain(b);
  });

  it('should filter out static-static pairs via shouldCollide', () => {
    const hash = new SpatialHash(2);
    const a = makeBody(0, 0, { type: BodyType.Static });
    const b = makeBody(0.5, 0, { type: BodyType.Static });

    hash.insert(a, bodyAABB(a));
    hash.insert(b, bodyAABB(b));

    const pairs = hash.queryPairs(shouldCollide);
    expect(pairs).toHaveLength(0);
  });

  it('should reset state after clear(), no stale pairs', () => {
    const hash = new SpatialHash(2);
    const a = makeBody(0, 0);
    const b = makeBody(0.5, 0);

    hash.insert(a, bodyAABB(a));
    hash.insert(b, bodyAABB(b));
    expect(hash.queryPairs(shouldCollide)).toHaveLength(1);

    hash.clear();

    // After clear, no pairs should be returned
    expect(hash.queryPairs(shouldCollide)).toHaveLength(0);

    // Re-insert only one body
    hash.insert(a, bodyAABB(a));
    expect(hash.queryPairs(shouldCollide)).toHaveLength(0);
  });

  it('should return correct pairs with large cell size (brute-force comparison)', () => {
    // Large cell = all bodies in one cell, acts like brute-force
    const hash = new SpatialHash(1000);

    const bodies: Body[] = [];
    for (let i = 0; i < 5; i++) {
      const body = makeBody(i * 0.5, 0);
      bodies.push(body);
      hash.insert(body, bodyAABB(body));
    }

    const pairs = hash.queryPairs(shouldCollide);

    // 5 bodies -> C(5,2) = 10 pairs, all dynamic with default masks
    expect(pairs).toHaveLength(10);

    // Verify no duplicates by checking unique ID pairs
    const pairKeys = new Set(
      pairs.map(([a, b]) => {
        const lo = Math.min(a.id, b.id);
        const hi = Math.max(a.id, b.id);
        return `${lo}:${hi}`;
      }),
    );
    expect(pairKeys.size).toBe(10);
  });
});
