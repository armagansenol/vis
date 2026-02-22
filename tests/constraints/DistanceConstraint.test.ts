import { describe, it, expect, beforeEach } from 'vitest';
import { Vec2 } from '../../src/math/Vec2.js';
import { Body } from '../../src/dynamics/Body.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Circle } from '../../src/shapes/Circle.js';
import { World } from '../../src/engine/World.js';
import { DistanceConstraint } from '../../src/constraints/DistanceConstraint.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_DT = 1 / 60;

function makeDynamic(x: number, y: number, radius = 0.5): Body {
  return new Body({
    type: BodyType.Dynamic,
    position: new Vec2(x, y),
    gravityScale: 0, // disable gravity for constraint isolation
    shape: new Circle(radius, { density: 1, restitution: 0, friction: 0 }),
  });
}

function makeWorld(): World {
  return new World({
    gravity: new Vec2(0, 0),
    velocityIterations: 8,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DistanceConstraint', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('maintains fixed distance between two bodies under applied force', () => {
    const world = makeWorld();
    const bodyA = makeDynamic(0, 0);
    const bodyB = makeDynamic(2, 0);
    world.addBody(bodyA);
    world.addBody(bodyB);

    const constraint = new DistanceConstraint(
      bodyA,
      bodyB,
      new Vec2(0, 0),
      new Vec2(0, 0),
      { length: 2.0 },
    );
    world.addConstraint(constraint);

    // Apply force pulling them apart
    for (let step = 0; step < 60; step++) {
      bodyA.applyForceAtCenter(new Vec2(-10, 0));
      bodyB.applyForceAtCenter(new Vec2(10, 0));
      world.step(FIXED_DT);
    }

    const dist = Vec2.distance(bodyA.position, bodyB.position);
    expect(dist).toBeCloseTo(2.0, 0); // within 0.1 tolerance
  });

  it('maintains distance under gravity (vertical)', () => {
    const worldWithGravity = new World({
      gravity: new Vec2(0, -9.81),
      velocityIterations: 8,
    });

    const bodyA = new Body({
      type: BodyType.Dynamic,
      position: new Vec2(0, 2),
      shape: new Circle(0.5, { density: 1, restitution: 0, friction: 0 }),
    });
    const bodyB = new Body({
      type: BodyType.Dynamic,
      position: new Vec2(0, 0),
      shape: new Circle(0.5, { density: 1, restitution: 0, friction: 0 }),
    });
    worldWithGravity.addBody(bodyA);
    worldWithGravity.addBody(bodyB);

    const constraint = new DistanceConstraint(
      bodyA,
      bodyB,
      new Vec2(0, 0),
      new Vec2(0, 0),
      { length: 2.0 },
    );
    worldWithGravity.addConstraint(constraint);

    for (let step = 0; step < 60; step++) {
      worldWithGravity.step(FIXED_DT);
    }

    const dist = Vec2.distance(bodyA.position, bodyB.position);
    expect(dist).toBeCloseTo(2.0, 0); // within 0.1 tolerance
  });

  it('auto-computes length from initial body separation', () => {
    const bodyA = makeDynamic(0, 0);
    const bodyB = makeDynamic(3, 4);

    const constraint = new DistanceConstraint(
      bodyA,
      bodyB,
      new Vec2(0, 0),
      new Vec2(0, 0),
    );

    const world = makeWorld();
    world.addBody(bodyA);
    world.addBody(bodyB);
    world.addConstraint(constraint);

    // Initial distance should be 5 (3-4-5 triangle)
    const initialDist = Vec2.distance(bodyA.position, bodyB.position);
    expect(initialDist).toBeCloseTo(5.0, 5);

    // After stepping, distance should still be ~5
    for (let step = 0; step < 30; step++) {
      bodyB.applyForceAtCenter(new Vec2(5, 0));
      world.step(FIXED_DT);
    }

    const finalDist = Vec2.distance(bodyA.position, bodyB.position);
    expect(finalDist).toBeCloseTo(5.0, 0);
  });

  it('defaults collideConnected to false', () => {
    const bodyA = makeDynamic(0, 0);
    const bodyB = makeDynamic(2, 0);

    const constraint = new DistanceConstraint(
      bodyA,
      bodyB,
      new Vec2(0, 0),
      new Vec2(0, 0),
    );

    expect(constraint.collideConnected).toBe(false);
  });
});
