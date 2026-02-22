import { describe, it, expect } from 'vitest';
import { Body, BodyType, Vec2, Circle } from '../../src/index.js';
import { MouseConstraint } from '../../src/constraints/MouseConstraint.js';

/**
 * Helper: create a dynamic body at a given position with a unit circle shape.
 */
function createDynamic(x: number, y: number): Body {
  return new Body({
    type: BodyType.Dynamic,
    position: new Vec2(x, y),
    shape: new Circle(0.5),
  });
}

/**
 * Helper: simulate N steps with a mouse constraint (no gravity).
 * Applies constraint preStep + solveVelocity (8 iterations) + position integration.
 */
function simulateSteps(
  body: Body,
  constraint: MouseConstraint,
  steps: number,
  dt = 1 / 60,
): void {
  for (let s = 0; s < steps; s++) {
    // Integrate velocities (no gravity for mouse constraint tests)
    body.velocity.x += body.force.x * body.invMass * dt;
    body.velocity.y += body.force.y * body.invMass * dt;
    body.angularVelocity += body.torque * body.invInertia * dt;

    constraint.preStep(dt);
    for (let iter = 0; iter < 8; iter++) {
      constraint.solveVelocity();
    }

    // Integrate position
    body.position.x += body.velocity.x * dt;
    body.position.y += body.velocity.y * dt;
    body.angle += body.angularVelocity * dt;

    // Clear accumulators
    body.force.set(0, 0);
    body.torque = 0;
  }
}

describe('MouseConstraint', () => {
  it('body moves toward target when dragged at center', () => {
    const body = createDynamic(0, 0);
    const localAnchor = { x: 0, y: 0 }; // center
    const target = { x: 2, y: 0 };

    const constraint = new MouseConstraint(body, localAnchor, target);
    const startX = body.position.x;

    simulateSteps(body, constraint, 10);

    // Body should have moved toward target (x increased)
    expect(body.position.x).toBeGreaterThan(startX);
  });

  it('body reaches target position approximately after 120 steps', () => {
    const body = createDynamic(0, 0);
    const localAnchor = { x: 0, y: 0 };
    const target = { x: 2, y: 0 };

    const constraint = new MouseConstraint(body, localAnchor, target, {
      hertz: 5,
      dampingRatio: 0.7,
    });

    simulateSteps(body, constraint, 120);

    // Should be approximately at target
    expect(Math.abs(body.position.x - 2)).toBeLessThan(0.5);
    expect(Math.abs(body.position.y - 0)).toBeLessThan(0.5);
  });

  it('maxForce limits impulse magnitude -- low maxForce means slow movement', () => {
    const bodyFast = createDynamic(0, 0);
    const bodyLimited = createDynamic(0, 0);
    const localAnchor = { x: 0, y: 0 };
    const target = { x: 5, y: 0 };

    const constraintFast = new MouseConstraint(bodyFast, localAnchor, target);
    const constraintLimited = new MouseConstraint(bodyLimited, localAnchor, target, {
      maxForce: 0.5, // very low
    });

    simulateSteps(bodyFast, constraintFast, 30);
    simulateSteps(bodyLimited, constraintLimited, 30);

    // Limited body should have moved much less
    expect(bodyLimited.position.x).toBeLessThan(bodyFast.position.x);
  });

  it('setTarget updates target and body follows new position', () => {
    const body = createDynamic(0, 0);
    const localAnchor = { x: 0, y: 0 };
    const target = { x: 2, y: 0 };

    const constraint = new MouseConstraint(body, localAnchor, target);

    // Move toward first target
    simulateSteps(body, constraint, 60);
    const firstX = body.position.x;

    // Change target to new position
    constraint.setTarget({ x: -2, y: 0 });
    simulateSteps(body, constraint, 120);

    // Body should have moved toward new target (x decreased)
    expect(body.position.x).toBeLessThan(firstX);
  });

  it('off-center anchor creates rotation when dragged', () => {
    const body = createDynamic(0, 0);
    // Anchor at edge of body (not center)
    const localAnchor = { x: 0.5, y: 0 };
    // Target above the anchor -- should create a torque
    const target = { x: 0.5, y: 2 };

    const constraint = new MouseConstraint(body, localAnchor, target);

    simulateSteps(body, constraint, 30);

    // Body should have rotated (angular velocity or angle changed)
    // Since we pull the right side of the body upward, it should rotate counterclockwise
    expect(Math.abs(body.angle)).toBeGreaterThan(0.01);
  });
});
