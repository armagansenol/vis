import { describe, it, expect } from 'vitest';
import { Body, BodyType, Vec2, Circle } from '../../src/index.js';
import { RevoluteConstraint } from '../../src/constraints/RevoluteConstraint.js';

/**
 * Helper: create a dynamic body at a given position with a unit circle shape.
 */
function createDynamic(x: number, y: number, angle = 0): Body {
  return new Body({
    type: BodyType.Dynamic,
    position: new Vec2(x, y),
    angle,
    shape: new Circle(0.5),
  });
}

/**
 * Helper: simulate N steps with a revolute constraint.
 * Applies constraint preStep + solveVelocity (8 iterations) + position integration.
 */
function simulateSteps(
  bodyA: Body,
  bodyB: Body,
  constraint: RevoluteConstraint,
  steps: number,
  dt = 1 / 60,
): void {
  for (let s = 0; s < steps; s++) {
    // Integrate velocities (gravity-free for constraint tests)
    if (bodyA.type === BodyType.Dynamic) {
      bodyA.velocity.x += bodyA.force.x * bodyA.invMass * dt;
      bodyA.velocity.y += bodyA.force.y * bodyA.invMass * dt;
      bodyA.angularVelocity += bodyA.torque * bodyA.invInertia * dt;
    }
    if (bodyB.type === BodyType.Dynamic) {
      bodyB.velocity.x += bodyB.force.x * bodyB.invMass * dt;
      bodyB.velocity.y += bodyB.force.y * bodyB.invMass * dt;
      bodyB.angularVelocity += bodyB.torque * bodyB.invInertia * dt;
    }

    constraint.preStep(dt);
    for (let iter = 0; iter < 8; iter++) {
      constraint.solveVelocity();
    }

    // Integrate positions
    if (bodyA.type === BodyType.Dynamic) {
      bodyA.position.x += bodyA.velocity.x * dt;
      bodyA.position.y += bodyA.velocity.y * dt;
      bodyA.angle += bodyA.angularVelocity * dt;
    }
    if (bodyB.type === BodyType.Dynamic) {
      bodyB.position.x += bodyB.velocity.x * dt;
      bodyB.position.y += bodyB.velocity.y * dt;
      bodyB.angle += bodyB.angularVelocity * dt;
    }

    // Clear accumulators
    bodyA.force.set(0, 0);
    bodyA.torque = 0;
    bodyB.force.set(0, 0);
    bodyB.torque = 0;
  }
}

describe('RevoluteConstraint', () => {
  it('keeps anchor points approximately coincident under torque', () => {
    const bodyA = createDynamic(0, 0);
    const bodyB = createDynamic(2, 0);
    const anchor = { x: 1, y: 0 }; // midpoint

    const constraint = new RevoluteConstraint(bodyA, bodyB, anchor);

    // Apply torque to bodyB
    for (let s = 0; s < 60; s++) {
      bodyB.torque = 50;
      simulateSteps(bodyA, bodyB, constraint, 1);
    }

    // Check world-space anchor points remain coincident
    const cosA = Math.cos(bodyA.angle);
    const sinA = Math.sin(bodyA.angle);
    const dxA = anchor.x - 0; // initial offset
    const dyA = anchor.y - 0;
    // Recompute local anchors as done in constructor
    const localAx = cosA * (bodyA.position.x) + sinA * (bodyA.position.y);
    // Actually, just check that the world anchors from the constraint are close
    // by computing them manually from localAnchor stored at construction
    const initCosA = Math.cos(0);
    const initSinA = Math.sin(0);
    const laAx = initCosA * dxA + initSinA * dyA; // = 1
    const laAy = -initSinA * dxA + initCosA * dyA; // = 0

    const initCosB = Math.cos(0);
    const initSinB = Math.sin(0);
    const dxB = anchor.x - 2;
    const dyB = anchor.y - 0;
    const laBx = initCosB * dxB + initSinB * dyB; // = -1
    const laBy = -initSinB * dxB + initCosB * dyB; // = 0

    // Transform to current world space
    const cA = Math.cos(bodyA.angle);
    const sA = Math.sin(bodyA.angle);
    const wAx = bodyA.position.x + cA * laAx - sA * laAy;
    const wAy = bodyA.position.y + sA * laAx + cA * laAy;

    const cB = Math.cos(bodyB.angle);
    const sB = Math.sin(bodyB.angle);
    const wBx = bodyB.position.x + cB * laBx - sB * laBy;
    const wBy = bodyB.position.y + sB * laBx + cB * laBy;

    const dist = Math.sqrt((wBx - wAx) ** 2 + (wBy - wAy) ** 2);
    // Under continuous torque with Baumgarte stabilization, some drift is expected
    expect(dist).toBeLessThan(0.3);
  });

  it('enforces angle limits under large torque', () => {
    const bodyA = createDynamic(0, 0);
    // Make bodyA static-like by setting invMass/invInertia to 0 conceptually
    // Actually, just use a static body for A
    const staticA = new Body({
      type: BodyType.Static,
      position: new Vec2(0, 0),
      shape: new Circle(0.5),
    });
    const bodyB = createDynamic(2, 0);
    const anchor = { x: 0, y: 0 };

    const limit = Math.PI / 4;
    const constraint = new RevoluteConstraint(staticA, bodyB, anchor, {
      enableLimit: true,
      lowerAngle: -limit,
      upperAngle: limit,
    });

    // Apply large positive torque
    for (let s = 0; s < 120; s++) {
      bodyB.torque = 200;
      simulateSteps(staticA, bodyB, constraint, 1);
    }

    const jointAngle = constraint.getJointAngle();
    // Should not exceed upper limit significantly (Baumgarte allows some overshoot under continuous torque)
    expect(jointAngle).toBeLessThan(limit + 0.25);
  });

  it('motor drives angular velocity toward target speed', () => {
    const staticA = new Body({
      type: BodyType.Static,
      position: new Vec2(0, 0),
      shape: new Circle(0.5),
    });
    const bodyB = createDynamic(2, 0);
    const anchor = { x: 0, y: 0 };

    const constraint = new RevoluteConstraint(staticA, bodyB, anchor, {
      enableMotor: true,
      motorSpeed: 5,
      maxMotorTorque: 100,
    });

    simulateSteps(staticA, bodyB, constraint, 120);

    // Angular velocity of bodyB should approach motorSpeed
    expect(bodyB.angularVelocity).toBeGreaterThan(3);
  });

  it('computes referenceAngle correctly from initial body angles', () => {
    const bodyA = createDynamic(0, 0, Math.PI / 6);
    const bodyB = createDynamic(2, 0, Math.PI / 3);
    const anchor = { x: 1, y: 0 };

    const constraint = new RevoluteConstraint(bodyA, bodyB, anchor);

    // referenceAngle = bodyB.angle - bodyA.angle = PI/3 - PI/6 = PI/6
    // getJointAngle should be 0 at construction
    expect(constraint.getJointAngle()).toBeCloseTo(0, 10);
  });

  it('getJointAngle returns correct relative angle', () => {
    const bodyA = createDynamic(0, 0);
    const bodyB = createDynamic(2, 0);
    const anchor = { x: 1, y: 0 };

    const constraint = new RevoluteConstraint(bodyA, bodyB, anchor);

    // Initially should be 0
    expect(constraint.getJointAngle()).toBeCloseTo(0);

    // Manually rotate bodyB
    bodyB.angle = 0.5;
    expect(constraint.getJointAngle()).toBeCloseTo(0.5);

    // Rotate both
    bodyA.angle = 0.3;
    bodyB.angle = 0.8;
    expect(constraint.getJointAngle()).toBeCloseTo(0.5);
  });

  it('collideConnected defaults to false', () => {
    const bodyA = createDynamic(0, 0);
    const bodyB = createDynamic(2, 0);
    const anchor = { x: 1, y: 0 };

    const constraint = new RevoluteConstraint(bodyA, bodyB, anchor);
    expect(constraint.collideConnected).toBe(false);
  });
});
