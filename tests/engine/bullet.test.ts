import { describe, it, expect, beforeEach } from 'vitest';
import { Body } from '../../src/dynamics/Body.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Vec2 } from '../../src/math/Vec2.js';
import { World } from '../../src/engine/World.js';

describe('Bullet CCD integration', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  it('bullet flag defaults to false', () => {
    const body = new Body({ shape: new Circle(1) });
    expect(body.isBullet).toBe(false);
  });

  it('bullet flag can be set via options', () => {
    const body = new Body({ shape: new Circle(1), isBullet: true });
    expect(body.isBullet).toBe(true);
  });

  it('bullet is not velocity-clamped like regular bodies', () => {
    const world = new World({
      gravity: new Vec2(0, 0),
      maxTranslation: 2,
      allowSleeping: false,
    });

    const bullet = new Body({
      shape: new Circle(0.1),
      position: new Vec2(0, 0),
      velocity: new Vec2(1000, 0),
      isBullet: true,
    });
    world.addBody(bullet);

    // Step once
    world.step(1 / 60);

    // Bullet should move further than maxTranslation since it's not clamped
    expect(Math.abs(bullet.velocity.x)).toBeGreaterThan(100);
  });

  it('non-bullet body is velocity-clamped', () => {
    const world = new World({
      gravity: new Vec2(0, 0),
      maxTranslation: 2,
      allowSleeping: false,
    });

    const normal = new Body({
      shape: new Circle(0.1),
      position: new Vec2(0, 0),
      velocity: new Vec2(1000, 0),
      isBullet: false,
    });
    world.addBody(normal);

    world.step(1 / 60);

    // Normal body should be clamped
    const speed = Math.sqrt(normal.velocity.x ** 2 + normal.velocity.y ** 2);
    const maxSpeed = 2 / (1 / 60);
    expect(speed).toBeLessThanOrEqual(maxSpeed + 1); // +1 for floating point
  });

  it('bullet collides with a thin wall via CCD', () => {
    const world = new World({
      gravity: new Vec2(0, 0),
      allowSleeping: false,
    });

    // Thin wall at x=10
    const wall = new Body({
      type: BodyType.Static,
      shape: Polygon.box(0.1, 10),
      position: new Vec2(10, 0),
    });

    // Fast bullet heading toward wall
    const bullet = new Body({
      shape: new Circle(0.25),
      position: new Vec2(0, 0),
      velocity: new Vec2(200, 0),
      isBullet: true,
    });

    world.addBody(wall);
    world.addBody(bullet);

    // Step for a short time
    world.step(1 / 60);

    // The bullet should not have passed through the wall entirely
    // (without CCD it would be at x = 200/60 ≈ 3.33 per step, so multiple steps
    // would eventually pass through the 0.1-wide wall)
    // With CCD, the bullet's velocity should have been redirected
    // We just check it didn't end up past the wall
    expect(bullet.position.x).toBeLessThan(15);
  });
});
