import { describe, it, expect, beforeEach } from 'vitest';
import { Vec2 } from '../../src/math/Vec2.js';
import { Body } from '../../src/dynamics/Body.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Circle } from '../../src/shapes/Circle.js';
import { World } from '../../src/engine/World.js';
import { SpringConstraint } from '../../src/constraints/SpringConstraint.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_DT = 1 / 60;

function makeDynamic(x: number, y: number, radius = 0.5): Body {
  return new Body({
    type: BodyType.Dynamic,
    position: new Vec2(x, y),
    gravityScale: 0,
    shape: new Circle(radius, { density: 1, restitution: 0, friction: 0 }),
  });
}

function makeWorld(): World {
  return new World({
    gravity: new Vec2(0, 0),
    velocityIterations: 8,
  });
}

function stepWorld(world: World, steps: number): void {
  for (let i = 0; i < steps; i++) {
    world.step(FIXED_DT);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpringConstraint', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('pulls displaced body back toward rest length', () => {
    const world = makeWorld();
    const bodyA = makeDynamic(0, 0);
    const bodyB = makeDynamic(4, 0); // rest length will be 2, placed at 4

    world.addBody(bodyA);
    world.addBody(bodyB);

    const spring = new SpringConstraint(
      bodyA,
      bodyB,
      new Vec2(0, 0),
      new Vec2(0, 0),
      { length: 2.0, hertz: 5.0, dampingRatio: 0.5 },
    );
    world.addConstraint(spring);

    const initialDist = Vec2.distance(bodyA.position, bodyB.position);
    expect(initialDist).toBeCloseTo(4.0, 5);

    // Step the simulation
    stepWorld(world, 60);

    // Body should have moved closer to rest length (2.0)
    const finalDist = Vec2.distance(bodyA.position, bodyB.position);
    expect(finalDist).toBeLessThan(initialDist);
  });

  it('higher hertz produces faster response', () => {
    // Test with hertz=1
    const world1 = makeWorld();
    const a1 = makeDynamic(0, 0);
    const b1 = makeDynamic(4, 0);
    world1.addBody(a1);
    world1.addBody(b1);
    world1.addConstraint(new SpringConstraint(
      a1, b1, new Vec2(0, 0), new Vec2(0, 0),
      { length: 2.0, hertz: 1.0, dampingRatio: 0.5 },
    ));

    // Test with hertz=5
    const world2 = makeWorld();
    const a2 = makeDynamic(0, 0);
    const b2 = makeDynamic(4, 0);
    world2.addBody(a2);
    world2.addBody(b2);
    world2.addConstraint(new SpringConstraint(
      a2, b2, new Vec2(0, 0), new Vec2(0, 0),
      { length: 2.0, hertz: 5.0, dampingRatio: 0.5 },
    ));

    // Step both for same duration
    stepWorld(world1, 30);
    stepWorld(world2, 30);

    // Higher hertz should be closer to rest length after same time
    const dist1 = Vec2.distance(a1.position, b1.position);
    const dist2 = Vec2.distance(a2.position, b2.position);
    const error1 = Math.abs(dist1 - 2.0);
    const error2 = Math.abs(dist2 - 2.0);

    // hertz=5 should have less error (closer to rest length)
    expect(error2).toBeLessThan(error1);
  });

  it('critically damped reaches rest faster than underdamped', () => {
    // Underdamped (will oscillate)
    const world1 = makeWorld();
    const a1 = makeDynamic(0, 0);
    const b1 = makeDynamic(4, 0);
    world1.addBody(a1);
    world1.addBody(b1);
    world1.addConstraint(new SpringConstraint(
      a1, b1, new Vec2(0, 0), new Vec2(0, 0),
      { length: 2.0, hertz: 3.0, dampingRatio: 0.1 },
    ));

    // Critically damped (no oscillation)
    const world2 = makeWorld();
    const a2 = makeDynamic(0, 0);
    const b2 = makeDynamic(4, 0);
    world2.addBody(a2);
    world2.addBody(b2);
    world2.addConstraint(new SpringConstraint(
      a2, b2, new Vec2(0, 0), new Vec2(0, 0),
      { length: 2.0, hertz: 3.0, dampingRatio: 1.0 },
    ));

    // Run for enough time to see settling behavior
    stepWorld(world1, 120);
    stepWorld(world2, 120);

    // Critically damped should be closer to rest length
    const error1 = Math.abs(Vec2.distance(a1.position, b1.position) - 2.0);
    const error2 = Math.abs(Vec2.distance(a2.position, b2.position) - 2.0);

    expect(error2).toBeLessThan(error1);
  });

  it('auto-computes length from initial positions', () => {
    const bodyA = makeDynamic(0, 0);
    const bodyB = makeDynamic(3, 4); // distance = 5

    const spring = new SpringConstraint(
      bodyA,
      bodyB,
      new Vec2(0, 0),
      new Vec2(0, 0),
      { hertz: 2.0, dampingRatio: 0.5 },
    );

    const world = makeWorld();
    world.addBody(bodyA);
    world.addBody(bodyB);
    world.addConstraint(spring);

    // With no displacement from rest, spring should not move bodies much
    stepWorld(world, 30);

    const dist = Vec2.distance(bodyA.position, bodyB.position);
    expect(dist).toBeCloseTo(5.0, 0); // should stay near initial distance
  });

  it('does not explode with very high hertz (Nyquist clamping)', () => {
    const world = makeWorld();
    const bodyA = makeDynamic(0, 0);
    const bodyB = makeDynamic(3, 0);
    world.addBody(bodyA);
    world.addBody(bodyB);

    // Very high hertz that would cause instability without clamping
    const spring = new SpringConstraint(
      bodyA,
      bodyB,
      new Vec2(0, 0),
      new Vec2(0, 0),
      { length: 2.0, hertz: 1000.0, dampingRatio: 0.5 },
    );
    world.addConstraint(spring);

    // Step simulation — should not produce NaN or extreme values
    stepWorld(world, 120);

    expect(Number.isFinite(bodyA.position.x)).toBe(true);
    expect(Number.isFinite(bodyA.position.y)).toBe(true);
    expect(Number.isFinite(bodyB.position.x)).toBe(true);
    expect(Number.isFinite(bodyB.position.y)).toBe(true);

    // Positions should be reasonable (not exploded to huge values)
    expect(Math.abs(bodyA.position.x)).toBeLessThan(100);
    expect(Math.abs(bodyB.position.x)).toBeLessThan(100);
  });
});
