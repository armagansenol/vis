import { describe, it, expect, beforeEach } from 'vitest';
import { Vec2 } from '../../src/math/Vec2.js';
import { Body } from '../../src/dynamics/Body.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Circle } from '../../src/shapes/Circle.js';
import { World } from '../../src/engine/World.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPSILON = 1e-6;
const FIXED_DT = 1 / 60;

function makeDynamicCircle(
  x: number,
  y: number,
  radius: number,
  opts?: { vx?: number; vy?: number; restitution?: number; friction?: number; density?: number; gravityScale?: number },
): Body {
  return new Body({
    type: BodyType.Dynamic,
    position: new Vec2(x, y),
    velocity: new Vec2(opts?.vx ?? 0, opts?.vy ?? 0),
    gravityScale: opts?.gravityScale ?? 1,
    shape: new Circle(radius, {
      restitution: opts?.restitution ?? 0,
      friction: opts?.friction ?? 0,
      density: opts?.density ?? 1,
    }),
  });
}

function makeStaticCircle(x: number, y: number, radius: number): Body {
  return new Body({
    type: BodyType.Static,
    position: new Vec2(x, y),
    shape: new Circle(radius),
  });
}

function makeKinematicCircle(
  x: number,
  y: number,
  radius: number,
  vx: number,
  vy: number,
): Body {
  return new Body({
    type: BodyType.Kinematic,
    position: new Vec2(x, y),
    velocity: new Vec2(vx, vy),
    shape: new Circle(radius),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  Body.resetIdCounter();
});

describe('World', () => {
  // -------------------------------------------------------------------------
  // Fixed timestep determinism
  // -------------------------------------------------------------------------

  describe('fixed timestep determinism', () => {
    it('produces identical results regardless of frameDt', () => {
      // World A: step at 1/60 for 60 frames (1 second total)
      const worldA = new World({ gravity: new Vec2(0, -10) });
      const bodyA = makeDynamicCircle(0, 10, 0.5);
      worldA.addBody(bodyA);

      for (let i = 0; i < 60; i++) {
        worldA.step(FIXED_DT);
      }

      // World B: step at 1/30 for 30 frames (1 second total)
      Body.resetIdCounter();
      const worldB = new World({ gravity: new Vec2(0, -10) });
      const bodyB = makeDynamicCircle(0, 10, 0.5);
      worldB.addBody(bodyB);

      for (let i = 0; i < 30; i++) {
        worldB.step(1 / 30);
      }

      // Both should have taken 60 fixed steps -> identical positions
      expect(bodyA.position.x).toBeCloseTo(bodyB.position.x, 5);
      expect(bodyA.position.y).toBeCloseTo(bodyB.position.y, 5);
      expect(bodyA.velocity.x).toBeCloseTo(bodyB.velocity.x, 5);
      expect(bodyA.velocity.y).toBeCloseTo(bodyB.velocity.y, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Interpolation alpha
  // -------------------------------------------------------------------------

  describe('interpolation alpha', () => {
    it('returns ~0 when frameDt exactly equals fixedDt', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const alpha = world.step(FIXED_DT);
      expect(alpha).toBeCloseTo(0, 5);
    });

    it('returns ~0.5 when frameDt is half fixedDt', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const alpha = world.step(FIXED_DT / 2);
      // Half a step accumulated, no full step taken
      expect(alpha).toBeCloseTo(0.5, 5);
    });

    it('returns positive alpha for fractional remainder', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      // 0.025s with fixedDt=1/60 (~0.01667): 1 step consumed, remainder ~0.00833
      const alpha = world.step(0.025);
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThan(1);
    });
  });

  // -------------------------------------------------------------------------
  // Spiral of death prevention
  // -------------------------------------------------------------------------

  describe('spiral of death prevention', () => {
    it('caps physics steps to maxSteps', () => {
      // With fixedDt=1/60, maxSteps=5: step(1.0) should clamp to 5 * 1/60 = 5 steps
      const world = new World({ gravity: new Vec2(0, -10), maxSteps: 5 });
      const body = makeDynamicCircle(0, 0, 0.5);
      world.addBody(body);

      world.step(1.0); // Would be 60 steps without capping

      // Build a reference world that takes exactly 5 steps
      Body.resetIdCounter();
      const worldRef = new World({ gravity: new Vec2(0, -10), maxSteps: 5 });
      const bodyRef = makeDynamicCircle(0, 0, 0.5);
      worldRef.addBody(bodyRef);

      for (let i = 0; i < 5; i++) {
        worldRef.step(FIXED_DT);
      }

      expect(body.position.y).toBeCloseTo(bodyRef.position.y, 5);
      expect(body.velocity.y).toBeCloseTo(bodyRef.velocity.y, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Gravity integration
  // -------------------------------------------------------------------------

  describe('gravity integration', () => {
    it('dynamic body falls under gravity', () => {
      const world = new World({ gravity: new Vec2(0, -10) });
      const body = makeDynamicCircle(0, 10, 0.5);
      world.addBody(body);

      const startY = body.position.y;
      for (let i = 0; i < 10; i++) {
        world.step(FIXED_DT);
      }

      expect(body.position.y).toBeLessThan(startY);
      expect(body.velocity.y).toBeLessThan(0);
    });

    it('static body does not move under gravity', () => {
      const world = new World({ gravity: new Vec2(0, -10) });
      const body = makeStaticCircle(5, 5, 1);
      world.addBody(body);

      for (let i = 0; i < 60; i++) {
        world.step(FIXED_DT);
      }

      expect(body.position.x).toBe(5);
      expect(body.position.y).toBe(5);
    });

    it('kinematic body moves by its user-set velocity', () => {
      const world = new World({ gravity: new Vec2(0, -10) });
      const body = makeKinematicCircle(0, 0, 0.5, 1, 0);
      world.addBody(body);

      for (let i = 0; i < 60; i++) {
        world.step(FIXED_DT);
      }

      // After 1 second at velocity (1, 0), position.x should be ~1
      expect(body.position.x).toBeCloseTo(1, 2);
      // Kinematic should NOT be affected by gravity
      expect(body.position.y).toBeCloseTo(0, 5);
    });
  });

  // -------------------------------------------------------------------------
  // Collision response (end-to-end)
  // -------------------------------------------------------------------------

  describe('collision response', () => {
    it('two dynamic circles bounce off each other', () => {
      const world = new World({ gravity: new Vec2(0, 0) });

      // Two circles approaching head-on along X axis
      const bodyA = makeDynamicCircle(-3, 0, 1, { vx: 5, restitution: 1, friction: 0 });
      const bodyB = makeDynamicCircle(3, 0, 1, { vx: -5, restitution: 1, friction: 0 });
      world.addBody(bodyA);
      world.addBody(bodyB);

      // Step until they collide and separate
      for (let i = 0; i < 120; i++) {
        world.step(FIXED_DT);
      }

      // After collision with restitution=1, velocities should have swapped/reversed
      // bodyA should be moving left (negative x), bodyB should be moving right (positive x)
      expect(bodyA.velocity.x).toBeLessThan(0);
      expect(bodyB.velocity.x).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Body add/remove
  // -------------------------------------------------------------------------

  describe('body add/remove', () => {
    it('added body participates in simulation', () => {
      const world = new World({ gravity: new Vec2(0, -10) });
      const body = makeDynamicCircle(0, 10, 0.5);
      world.addBody(body);

      world.step(FIXED_DT);

      expect(body.velocity.y).toBeLessThan(0);
    });

    it('removed body no longer participates', () => {
      const world = new World({ gravity: new Vec2(0, -10) });
      const body = makeDynamicCircle(0, 10, 0.5);
      world.addBody(body);

      world.step(FIXED_DT);
      const posAfterOneStep = body.position.y;

      world.removeBody(body);
      world.step(FIXED_DT);

      // Body position should be unchanged after removal
      expect(body.position.y).toBe(posAfterOneStep);
    });

    it('getBodies returns current body list', () => {
      const world = new World();
      const body = makeDynamicCircle(0, 0, 0.5);

      expect(world.getBodies().length).toBe(0);
      world.addBody(body);
      expect(world.getBodies().length).toBe(1);
      world.removeBody(body);
      expect(world.getBodies().length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Force clearing
  // -------------------------------------------------------------------------

  describe('force clearing', () => {
    it('clears force accumulator after step', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const body = makeDynamicCircle(0, 0, 0.5);
      world.addBody(body);

      body.applyForce(new Vec2(100, 0));
      expect(body.force.x).toBe(100);

      world.step(FIXED_DT);

      expect(body.force.x).toBe(0);
      expect(body.force.y).toBe(0);
      expect(body.torque).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Event forwarding
  // -------------------------------------------------------------------------

  describe('event forwarding', () => {
    it('fires beginContact when bodies collide', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const bodyA = makeDynamicCircle(0, 0, 1, { vx: 5 });
      const bodyB = makeDynamicCircle(1.5, 0, 1, { vx: -5 }); // overlapping
      world.addBody(bodyA);
      world.addBody(bodyB);

      let contactFired = false;
      world.onBeginContact(() => {
        contactFired = true;
      });

      world.step(FIXED_DT);

      expect(contactFired).toBe(true);
    });
  });
});
