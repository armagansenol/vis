import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionSystem } from '../../src/collision/CollisionSystem.js';
import { type ContactEvent } from '../../src/events/EventDispatcher.js';
import { Body } from '../../src/dynamics/Body.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { Vec2 } from '../../src/math/Vec2.js';

describe('CollisionSystem', () => {
  let system: CollisionSystem;

  beforeEach(() => {
    Body.resetIdCounter();
    system = new CollisionSystem();
  });

  // -----------------------------------------------------------------------
  // Basic detection
  // -----------------------------------------------------------------------

  it('detects two overlapping circles', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    const manifolds = system.detect([a, b]);

    expect(manifolds).toHaveLength(1);
    expect(manifolds[0].bodyA.id).toBeDefined();
    expect(manifolds[0].bodyB.id).toBeDefined();
    expect(manifolds[0].contacts.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for non-overlapping bodies', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(10, 0) });

    const manifolds = system.detect([a, b]);

    expect(manifolds).toHaveLength(0);
  });

  it('detects multiple overlapping pairs', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });
    const c = new Body({ shape: new Circle(1), position: new Vec2(0, 1.5) });

    const manifolds = system.detect([a, b, c]);

    // a-b overlap, a-c overlap, b-c do not overlap (distance = sqrt(1.5^2+1.5^2) ~ 2.12 > 2)
    expect(manifolds).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // beginContact / endContact events
  // -----------------------------------------------------------------------

  it('fires beginContact on first overlap', () => {
    const events: ContactEvent[] = [];
    system.onBeginContact((e) => events.push(e));

    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    system.detect([a, b]);

    expect(events).toHaveLength(1);
    expect(events[0].bodyA).toBeDefined();
    expect(events[0].bodyB).toBeDefined();
  });

  it('fires endContact when bodies separate', () => {
    const endEvents: ContactEvent[] = [];
    system.onEndContact((e) => endEvents.push(e));

    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    // Frame 1: overlap
    system.detect([a, b]);
    expect(endEvents).toHaveLength(0);

    // Frame 2: move apart
    b.position.set(10, 0);
    system.detect([a, b]);

    expect(endEvents).toHaveLength(1);
  });

  it('does not fire beginContact on second frame of same overlap', () => {
    const beginEvents: ContactEvent[] = [];
    system.onBeginContact((e) => beginEvents.push(e));

    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    system.detect([a, b]);
    expect(beginEvents).toHaveLength(1);

    // Same overlap, second frame
    system.detect([a, b]);
    expect(beginEvents).toHaveLength(1); // No new begin event
  });

  // -----------------------------------------------------------------------
  // Persistence / warm-start
  // -----------------------------------------------------------------------

  it('manifold persists across frames (updated, not recreated)', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    const manifolds1 = system.detect([a, b]);
    expect(manifolds1).toHaveLength(1);

    // Simulate solver setting impulses
    manifolds1[0].contacts[0].normalImpulse = 10;

    // Frame 2: same pair, impulses should transfer
    const manifolds2 = system.detect([a, b]);
    expect(manifolds2).toHaveLength(1);
    expect(manifolds2[0].contacts[0].normalImpulse).toBe(10);
  });

  // -----------------------------------------------------------------------
  // Sensor handling
  // -----------------------------------------------------------------------

  it('sensor body produces manifold with isSensor=true', () => {
    const a = new Body({
      shape: new Circle(1),
      position: new Vec2(0, 0),
      isSensor: true,
    });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    const manifolds = system.detect([a, b]);

    expect(manifolds).toHaveLength(1);
    expect(manifolds[0].isSensor).toBe(true);
  });

  it('sensor body fires beginContact with isSensor=true', () => {
    const events: ContactEvent[] = [];
    system.onBeginContact((e) => events.push(e));

    const a = new Body({
      shape: new Circle(1),
      position: new Vec2(0, 0),
      isSensor: true,
    });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    system.detect([a, b]);

    expect(events).toHaveLength(1);
    expect(events[0].isSensor).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Collision filter
  // -----------------------------------------------------------------------

  it('respects collision filter bitmasks', () => {
    const a = new Body({
      shape: new Circle(1),
      position: new Vec2(0, 0),
      categoryBits: 0x0001,
      maskBits: 0x0002, // Only collides with category 2
    });
    const b = new Body({
      shape: new Circle(1),
      position: new Vec2(1.5, 0),
      categoryBits: 0x0004, // Category 4, not matched by a's mask
      maskBits: 0xFFFF,
    });

    const manifolds = system.detect([a, b]);

    expect(manifolds).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Pair exclusion
  // -----------------------------------------------------------------------

  it('pair exclusion prevents collision detection', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    system.addPairExclusion(a.id, b.id);
    const manifolds = system.detect([a, b]);

    expect(manifolds).toHaveLength(0);
  });

  it('removePairExclusion re-enables collision', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    system.addPairExclusion(a.id, b.id);
    expect(system.detect([a, b])).toHaveLength(0);

    system.removePairExclusion(a.id, b.id);
    expect(system.detect([a, b])).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Mixed shapes
  // -----------------------------------------------------------------------

  it('circle vs polygon detection through full pipeline', () => {
    const circle = new Body({
      shape: new Circle(1),
      position: new Vec2(0, 0),
    });
    const box = new Body({
      shape: Polygon.box(2, 2),
      position: new Vec2(1.5, 0),
    });

    const manifolds = system.detect([circle, box]);

    expect(manifolds).toHaveLength(1);
    expect(manifolds[0].contacts.length).toBeGreaterThanOrEqual(1);
  });

  it('polygon vs polygon detection through full pipeline', () => {
    const boxA = new Body({
      shape: Polygon.box(2, 2),
      position: new Vec2(0, 0),
    });
    const boxB = new Body({
      shape: Polygon.box(2, 2),
      position: new Vec2(1.5, 0),
    });

    const manifolds = system.detect([boxA, boxB]);

    expect(manifolds).toHaveLength(1);
    // Box-box should produce 2 contact points from Sutherland-Hodgman clipping
    expect(manifolds[0].contacts.length).toBe(2);
  });
});
