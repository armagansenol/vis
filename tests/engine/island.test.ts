import { describe, it, expect, beforeEach } from 'vitest';
import { Body } from '../../src/dynamics/Body.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Vec2 } from '../../src/math/Vec2.js';
import { type Manifold } from '../../src/collision/Manifold.js';
import { buildIslands } from '../../src/engine/Island.js';
import { DistanceConstraint } from '../../src/constraints/DistanceConstraint.js';

function makeManifold(bodyA: Body, bodyB: Body): Manifold {
  return {
    bodyA,
    bodyB,
    normal: new Vec2(0, 1),
    contacts: [{ point: new Vec2(0, 0), depth: 0.01, id: 0, normalImpulse: 0, tangentImpulse: 0 }],
    friction: 0.3,
    restitution: 0.2,
    isSensor: false,
  };
}

describe('Island builder', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('groups two touching dynamic bodies into one island', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });
    const manifold = makeManifold(a, b);

    const islands = buildIslands([a, b], [manifold], []);

    expect(islands.length).toBe(1);
    expect(islands[0].bodies.length).toBe(2);
    expect(islands[0].contacts.length).toBe(1);
  });

  it('creates separate islands for disconnected groups', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });
    const c = new Body({ shape: new Circle(1), position: new Vec2(100, 0) });
    const d = new Body({ shape: new Circle(1), position: new Vec2(101.5, 0) });

    const m1 = makeManifold(a, b);
    const m2 = makeManifold(c, d);

    const islands = buildIslands([a, b, c, d], [m1, m2], []);

    expect(islands.length).toBe(2);
    expect(islands[0].bodies.length).toBe(2);
    expect(islands[1].bodies.length).toBe(2);
  });

  it('skips sleeping bodies', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });
    b.sleep();

    const islands = buildIslands([a, b], [], []);

    expect(islands.length).toBe(1);
    expect(islands[0].bodies.length).toBe(1);
    expect(islands[0].bodies[0]).toBe(a);
  });

  it('skips static bodies but uses them as bridges', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const wall = new Body({ type: BodyType.Static, shape: Polygon.box(10, 0.5), position: new Vec2(0, -1) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(3, 0) });

    const m1 = makeManifold(a, wall);
    const m2 = makeManifold(b, wall);

    const islands = buildIslands([a, wall, b], [m1, m2], []);

    // a and b are NOT connected through the static wall
    // (static bodies don't propagate island membership)
    expect(islands.length).toBe(2);
  });

  it('connects bodies through constraints', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(5, 0) });

    const constraint = new DistanceConstraint(
      a,
      b,
      new Vec2(0, 0),
      new Vec2(0, 0),
      { length: 5 },
    );

    const islands = buildIslands([a, b], [], [constraint]);

    expect(islands.length).toBe(1);
    expect(islands[0].bodies.length).toBe(2);
    expect(islands[0].constraints.length).toBe(1);
  });

  it('handles a chain of connected bodies', () => {
    const bodies = [];
    const manifolds: Manifold[] = [];

    for (let i = 0; i < 5; i++) {
      bodies.push(new Body({ shape: new Circle(0.5), position: new Vec2(i * 1.5, 0) }));
    }
    for (let i = 0; i < 4; i++) {
      manifolds.push(makeManifold(bodies[i], bodies[i + 1]));
    }

    const islands = buildIslands(bodies, manifolds, []);

    expect(islands.length).toBe(1);
    expect(islands[0].bodies.length).toBe(5);
    expect(islands[0].contacts.length).toBe(4);
  });

  it('returns empty array when all bodies are static', () => {
    const a = new Body({ type: BodyType.Static, shape: Polygon.box(1, 1) });
    const b = new Body({ type: BodyType.Static, shape: Polygon.box(1, 1) });

    const islands = buildIslands([a, b], [], []);
    expect(islands.length).toBe(0);
  });

  it('ignores sensor manifolds', () => {
    const a = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
    const b = new Body({ shape: new Circle(1), position: new Vec2(1.5, 0) });

    const sensorManifold: Manifold = {
      ...makeManifold(a, b),
      isSensor: true,
    };

    const islands = buildIslands([a, b], [sensorManifold], []);

    // Bodies are not connected through sensors
    expect(islands.length).toBe(2);
  });
});
