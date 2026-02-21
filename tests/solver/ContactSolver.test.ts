import { describe, it, expect, beforeEach } from 'vitest';
import { Vec2 } from '../../src/math/Vec2.js';
import { Body } from '../../src/dynamics/Body.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Circle } from '../../src/shapes/Circle.js';
import { type Manifold, type ContactPoint } from '../../src/collision/Manifold.js';
import { ContactSolver } from '../../src/solver/ContactSolver.js';
import { DEFAULT_SOLVER_CONSTANTS, type SolverConstants } from '../../src/solver/SolverConstants.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDynamicCircle(
  x: number,
  y: number,
  radius: number,
  opts?: { vx?: number; vy?: number; restitution?: number; friction?: number; density?: number },
): Body {
  return new Body({
    type: BodyType.Dynamic,
    position: new Vec2(x, y),
    velocity: new Vec2(opts?.vx ?? 0, opts?.vy ?? 0),
    shape: new Circle(radius, {
      restitution: opts?.restitution ?? 0,
      friction: opts?.friction ?? 0,
      density: opts?.density ?? 1,
    }),
  });
}

function makeStaticCircle(
  x: number,
  y: number,
  radius: number,
  opts?: { restitution?: number; friction?: number },
): Body {
  return new Body({
    type: BodyType.Static,
    position: new Vec2(x, y),
    shape: new Circle(radius, {
      restitution: opts?.restitution ?? 0,
      friction: opts?.friction ?? 0,
    }),
  });
}

function makeContact(
  px: number,
  py: number,
  depth: number,
  id: number = 0,
  normalImpulse: number = 0,
  tangentImpulse: number = 0,
): ContactPoint {
  return { point: new Vec2(px, py), depth, id, normalImpulse, tangentImpulse };
}

function makeManifold(
  bodyA: Body,
  bodyB: Body,
  normal: Vec2,
  contacts: ContactPoint[],
  opts?: { friction?: number; restitution?: number },
): Manifold {
  return {
    bodyA,
    bodyB,
    normal,
    contacts,
    friction: opts?.friction ?? 0,
    restitution: opts?.restitution ?? 0,
    isSensor: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SolverConstants', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_SOLVER_CONSTANTS.velocityIterations).toBe(8);
    expect(DEFAULT_SOLVER_CONSTANTS.baumgarteFactor).toBeCloseTo(0.2);
    expect(DEFAULT_SOLVER_CONSTANTS.penetrationSlop).toBeCloseTo(0.01);
    expect(DEFAULT_SOLVER_CONSTANTS.restitutionSlop).toBeCloseTo(0.5);
  });
});

describe('ContactSolver', () => {
  beforeEach(() => {
    Body.resetIdCounter();
  });

  describe('Normal impulse resolution', () => {
    it('should swap velocities for two equal-mass dynamic bodies with restitution=1', () => {
      // Two circles approaching each other head-on along the x-axis
      const bodyA = makeDynamicCircle(-1, 0, 1, { vx: 5, vy: 0 });
      const bodyB = makeDynamicCircle(1, 0, 1, { vx: -5, vy: 0 });

      const contact = makeContact(0, 0, 0.01);
      const manifold = makeManifold(bodyA, bodyB, new Vec2(1, 0), [contact], {
        restitution: 1,
      });

      const solver = new ContactSolver();
      const dt = 1 / 60;
      solver.preStep([manifold], dt);
      for (let i = 0; i < DEFAULT_SOLVER_CONSTANTS.velocityIterations; i++) {
        solver.solve();
      }

      // After resolution, velocities should approximately swap
      expect(bodyA.velocity.x).toBeLessThan(0);
      expect(bodyB.velocity.x).toBeGreaterThan(0);
    });

    it('should bounce ball back to original velocity magnitude off static floor (e=1)', () => {
      const ball = makeDynamicCircle(0, 1, 0.5, { vx: 0, vy: -10 });
      const floor = makeStaticCircle(0, -10, 10, { restitution: 1 });

      const contact = makeContact(0, 0.5, 0.01);
      const manifold = makeManifold(ball, floor, new Vec2(0, -1), [contact], {
        restitution: 1,
      });

      const solver = new ContactSolver();
      const dt = 1 / 60;
      solver.preStep([manifold], dt);
      for (let i = 0; i < DEFAULT_SOLVER_CONSTANTS.velocityIterations; i++) {
        solver.solve();
      }

      // Ball should bounce back up with approximately the same speed
      expect(ball.velocity.y).toBeGreaterThan(9);
    });

    it('should zero velocity for restitution=0 ball on static floor', () => {
      const ball = makeDynamicCircle(0, 1, 0.5, { vx: 0, vy: -10 });
      const floor = makeStaticCircle(0, -10, 10, { restitution: 0 });

      const contact = makeContact(0, 0.5, 0.01);
      const manifold = makeManifold(ball, floor, new Vec2(0, -1), [contact], {
        restitution: 0,
      });

      const solver = new ContactSolver();
      const dt = 1 / 60;
      solver.preStep([manifold], dt);
      for (let i = 0; i < DEFAULT_SOLVER_CONSTANTS.velocityIterations; i++) {
        solver.solve();
      }

      // Ball should have ~zero normal velocity after inelastic collision
      expect(Math.abs(ball.velocity.y)).toBeLessThan(0.5);
    });
  });

  describe('Friction', () => {
    it('should reduce tangent velocity with high friction', () => {
      // Ball sliding along x on a static floor, normal is (0, -1) from ball to floor
      const ball = makeDynamicCircle(0, 1, 0.5, { vx: 10, vy: -2 });
      const floor = makeStaticCircle(0, -10, 10);

      const contact = makeContact(0, 0.5, 0.01);
      const manifold = makeManifold(ball, floor, new Vec2(0, -1), [contact], {
        friction: 1.0,
        restitution: 0,
      });

      const solver = new ContactSolver();
      const dt = 1 / 60;
      solver.preStep([manifold], dt);
      for (let i = 0; i < DEFAULT_SOLVER_CONSTANTS.velocityIterations; i++) {
        solver.solve();
      }

      // Tangent velocity (x) should be reduced
      expect(ball.velocity.x).toBeLessThan(10);
    });

    it('should not affect tangent velocity with zero friction', () => {
      const ball = makeDynamicCircle(0, 1, 0.5, { vx: 10, vy: -2 });
      const floor = makeStaticCircle(0, -10, 10);

      const contact = makeContact(0, 0.5, 0.01);
      const manifold = makeManifold(ball, floor, new Vec2(0, -1), [contact], {
        friction: 0,
        restitution: 0,
      });

      const solver = new ContactSolver();
      const dt = 1 / 60;
      solver.preStep([manifold], dt);
      for (let i = 0; i < DEFAULT_SOLVER_CONSTANTS.velocityIterations; i++) {
        solver.solve();
      }

      // With zero friction, tangent velocity should remain unchanged
      expect(ball.velocity.x).toBeCloseTo(10, 0);
    });
  });

  describe('Warm-starting', () => {
    it('should apply cached impulses before iteration, modifying body velocity', () => {
      const ball = makeDynamicCircle(0, 1, 0.5, { vx: 0, vy: 0 });
      const floor = makeStaticCircle(0, -10, 10);

      // Provide non-zero cached impulses from previous frame
      const contact = makeContact(0, 0.5, 0.01, 0, 5.0, 0);
      const manifold = makeManifold(ball, floor, new Vec2(0, -1), [contact], {
        restitution: 0,
      });

      const solver = new ContactSolver();
      const dt = 1 / 60;

      // Record velocity before preStep
      const vyBefore = ball.velocity.y;
      solver.preStep([manifold], dt);

      // After preStep (warm-start), velocity should have changed
      expect(ball.velocity.y).not.toBeCloseTo(vyBefore, 1);
    });
  });

  describe('Accumulated clamping', () => {
    it('should keep normalImpulse >= 0 across multiple solve iterations', () => {
      const bodyA = makeDynamicCircle(-1, 0, 1, { vx: 1, vy: 0 });
      const bodyB = makeDynamicCircle(1, 0, 1, { vx: -1, vy: 0 });

      const contact = makeContact(0, 0, 0.01);
      const manifold = makeManifold(bodyA, bodyB, new Vec2(1, 0), [contact], {
        restitution: 0.5,
      });

      const solver = new ContactSolver();
      const dt = 1 / 60;
      solver.preStep([manifold], dt);

      for (let i = 0; i < DEFAULT_SOLVER_CONSTANTS.velocityIterations; i++) {
        solver.solve();
        // After each iteration, accumulated normal impulse must be >= 0
        expect(contact.normalImpulse).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Baumgarte position correction', () => {
    it('should produce positive bias for penetrating contact pushing bodies apart', () => {
      // Deep penetration
      const ball = makeDynamicCircle(0, 0.4, 0.5, { vx: 0, vy: 0 });
      const floor = makeStaticCircle(0, -10, 10);

      const contact = makeContact(0, 0.45, 0.1); // depth > slop
      const manifold = makeManifold(ball, floor, new Vec2(0, -1), [contact], {
        restitution: 0,
      });

      const solver = new ContactSolver();
      const dt = 1 / 60;
      solver.preStep([manifold], dt);

      // After solve iterations, the ball should get a positive y velocity correction
      // (pushed away from the floor) even with zero initial velocity
      for (let i = 0; i < DEFAULT_SOLVER_CONSTANTS.velocityIterations; i++) {
        solver.solve();
      }

      // Ball should be pushed upward (away from floor)
      // Normal is (0, -1) from ball to floor, so correction pushes ball in -normal = (0, 1)
      expect(ball.velocity.y).toBeGreaterThan(0);
    });
  });

  describe('Static body invariant', () => {
    it('should only change dynamic body velocity; static body remains at (0,0)', () => {
      const ball = makeDynamicCircle(0, 1, 0.5, { vx: 0, vy: -10 });
      const floor = makeStaticCircle(0, -10, 10);

      const contact = makeContact(0, 0.5, 0.01);
      const manifold = makeManifold(ball, floor, new Vec2(0, -1), [contact], {
        restitution: 0.5,
      });

      const solver = new ContactSolver();
      const dt = 1 / 60;
      solver.preStep([manifold], dt);
      for (let i = 0; i < DEFAULT_SOLVER_CONSTANTS.velocityIterations; i++) {
        solver.solve();
      }

      // Static body velocity must remain zero
      expect(floor.velocity.x).toBe(0);
      expect(floor.velocity.y).toBe(0);
      expect(floor.angularVelocity).toBe(0);
    });
  });
});
