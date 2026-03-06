import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/engine/World.js';
import { Body } from '../../src/dynamics/Body.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Vec2 } from '../../src/math/Vec2.js';

beforeEach(() => Body.resetIdCounter());

function stepN(world: World, n: number) {
  const dt = 1 / 60;
  for (let i = 0; i < n; i++) world.step(dt);
}

describe('Sleeping system', () => {
  it('body eventually sleeps when at rest on floor', () => {
    const world = new World({
      gravity: new Vec2(0, -10),
      allowSleeping: true,
      sleepTimeThreshold: 0.3,
    });

    // Floor
    const floor = new Body({
      type: BodyType.Static,
      position: new Vec2(0, -1),
      shape: Polygon.box(20, 2),
    });
    world.addBody(floor);

    // Box that will land on floor
    const box = new Body({
      position: new Vec2(0, 0.5),
      shape: Polygon.box(1, 1),
    });
    world.addBody(box);

    // Step until box should be sleeping (give it time to settle + sleep timer)
    stepN(world, 200);
    expect(box.isSleeping).toBe(true);
  });

  it('sleeping body wakes on applyForce', () => {
    const world = new World({ allowSleeping: true, sleepTimeThreshold: 0.1 });
    const body = new Body({ shape: new Circle(0.5) });
    body.sleep(); // force sleep
    world.addBody(body);

    expect(body.isSleeping).toBe(true);
    body.applyForce(new Vec2(10, 0));
    expect(body.isSleeping).toBe(false);
  });

  it('sleeping body wakes on applyImpulse', () => {
    const body = new Body({ shape: new Circle(0.5) });
    body.sleep();
    expect(body.isSleeping).toBe(true);
    body.applyImpulse(new Vec2(1, 0));
    expect(body.isSleeping).toBe(false);
    expect(body.velocity.x).toBeGreaterThan(0);
  });

  it('body with allowSleep=false never sleeps', () => {
    const world = new World({
      gravity: new Vec2(0, -10),
      allowSleeping: true,
      sleepTimeThreshold: 0.1,
    });
    const floor = new Body({
      type: BodyType.Static,
      position: new Vec2(0, -1),
      shape: Polygon.box(20, 2),
    });
    world.addBody(floor);

    const box = new Body({
      position: new Vec2(0, 0.5),
      shape: Polygon.box(1, 1),
      allowSleep: false,
    });
    world.addBody(box);

    stepN(world, 200);
    expect(box.isSleeping).toBe(false);
  });

  it('world with allowSleeping=false never sleeps bodies', () => {
    const world = new World({
      gravity: new Vec2(0, -10),
      allowSleeping: false,
      sleepTimeThreshold: 0.1,
    });
    const floor = new Body({
      type: BodyType.Static,
      position: new Vec2(0, -1),
      shape: Polygon.box(20, 2),
    });
    world.addBody(floor);

    const box = new Body({
      position: new Vec2(0, 0.5),
      shape: Polygon.box(1, 1),
    });
    world.addBody(box);

    stepN(world, 200);
    expect(box.isSleeping).toBe(false);
  });

  it('static and kinematic bodies never sleep', () => {
    const world = new World({ allowSleeping: true, sleepTimeThreshold: 0.1 });
    const s = new Body({
      type: BodyType.Static,
      shape: Polygon.box(1, 1),
    });
    const k = new Body({
      type: BodyType.Kinematic,
      shape: Polygon.box(1, 1),
    });
    world.addBody(s);
    world.addBody(k);
    stepN(world, 100);
    expect(s.isSleeping).toBe(false);
    expect(k.isSleeping).toBe(false);
  });

  it('sleep() zeros velocity and forces', () => {
    const body = new Body({
      shape: new Circle(0.5),
      velocity: new Vec2(5, 3),
      angularVelocity: 2,
    });
    body.force.set(10, 10);
    body.torque = 5;
    body.sleep();
    expect(body.velocity.x).toBe(0);
    expect(body.velocity.y).toBe(0);
    expect(body.angularVelocity).toBe(0);
    expect(body.force.x).toBe(0);
    expect(body.torque).toBe(0);
    expect(body.isSleeping).toBe(true);
  });
});
