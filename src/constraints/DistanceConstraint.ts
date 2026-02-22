import { type Body } from '../dynamics/Body.js';
import { type Vec2 } from '../math/Vec2.js';
import { type Constraint } from './Constraint.js';

/**
 * Options for constructing a DistanceConstraint.
 */
export interface DistanceConstraintOptions {
  /**
   * Target distance between anchor points.
   * If not provided, computed from initial body positions + anchor offsets.
   */
  length?: number;
  /** Whether connected bodies should collide. Default: false. */
  collideConnected?: boolean;
}

/**
 * Rigid 1D distance constraint using Baumgarte stabilization.
 *
 * Maintains a fixed distance between two anchor points on two bodies.
 * This is a bilateral constraint (enforces exact distance in both
 * push and pull directions — not a rope).
 *
 * Follows the Box2D / Planck.js DistanceJoint pattern.
 */
export class DistanceConstraint implements Constraint {
  readonly bodyA: Body;
  readonly bodyB: Body;
  readonly collideConnected: boolean;

  private readonly localAnchorA: { x: number; y: number };
  private readonly localAnchorB: { x: number; y: number };
  private readonly length: number;

  // Solver state (recomputed each preStep)
  private rAx = 0;
  private rAy = 0;
  private rBx = 0;
  private rBy = 0;
  private nx = 0;
  private ny = 0;
  private mass = 0;
  private bias = 0;
  private impulse = 0;

  constructor(
    bodyA: Body,
    bodyB: Body,
    localAnchorA: Vec2,
    localAnchorB: Vec2,
    options?: DistanceConstraintOptions,
  ) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.collideConnected = options?.collideConnected ?? false;

    // Clone anchors to prevent external mutation
    this.localAnchorA = { x: localAnchorA.x, y: localAnchorA.y };
    this.localAnchorB = { x: localAnchorB.x, y: localAnchorB.y };

    // Compute initial length if not provided
    if (options?.length !== undefined) {
      this.length = options.length;
    } else {
      // Transform anchors to world space using initial body state
      const cosA = Math.cos(bodyA.angle);
      const sinA = Math.sin(bodyA.angle);
      const wAx = bodyA.position.x + cosA * localAnchorA.x - sinA * localAnchorA.y;
      const wAy = bodyA.position.y + sinA * localAnchorA.x + cosA * localAnchorA.y;

      const cosB = Math.cos(bodyB.angle);
      const sinB = Math.sin(bodyB.angle);
      const wBx = bodyB.position.x + cosB * localAnchorB.x - sinB * localAnchorB.y;
      const wBy = bodyB.position.y + sinB * localAnchorB.x + cosB * localAnchorB.y;

      const dx = wBx - wAx;
      const dy = wBy - wAy;
      this.length = Math.sqrt(dx * dx + dy * dy);
    }
  }

  preStep(dt: number): void {
    const bodyA = this.bodyA;
    const bodyB = this.bodyB;

    // Transform local anchors to world space
    const cosA = Math.cos(bodyA.angle);
    const sinA = Math.sin(bodyA.angle);
    this.rAx = cosA * this.localAnchorA.x - sinA * this.localAnchorA.y;
    this.rAy = sinA * this.localAnchorA.x + cosA * this.localAnchorA.y;

    const cosB = Math.cos(bodyB.angle);
    const sinB = Math.sin(bodyB.angle);
    this.rBx = cosB * this.localAnchorB.x - sinB * this.localAnchorB.y;
    this.rBy = sinB * this.localAnchorB.x + cosB * this.localAnchorB.y;

    // Separation vector (world space)
    const dx = bodyB.position.x + this.rBx - bodyA.position.x - this.rAx;
    const dy = bodyB.position.y + this.rBy - bodyA.position.y - this.rAy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Unit direction
    if (dist > 1e-6) {
      this.nx = dx / dist;
      this.ny = dy / dist;
    } else {
      this.nx = 0;
      this.ny = 0;
    }

    // Effective mass (1D along constraint axis)
    const rAxN = this.rAx * this.ny - this.rAy * this.nx;
    const rBxN = this.rBx * this.ny - this.rBy * this.nx;
    const invMassSum =
      bodyA.invMass + bodyB.invMass +
      bodyA.invInertia * rAxN * rAxN +
      bodyB.invInertia * rBxN * rBxN;
    this.mass = invMassSum > 0 ? 1 / invMassSum : 0;

    // Baumgarte bias (position correction)
    const C = dist - this.length;
    this.bias = (0.2 / dt) * C;

    // Warm-start: apply cached impulse
    const px = this.impulse * this.nx;
    const py = this.impulse * this.ny;
    bodyA.velocity.x -= px * bodyA.invMass;
    bodyA.velocity.y -= py * bodyA.invMass;
    bodyA.angularVelocity -= (this.rAx * py - this.rAy * px) * bodyA.invInertia;
    bodyB.velocity.x += px * bodyB.invMass;
    bodyB.velocity.y += py * bodyB.invMass;
    bodyB.angularVelocity += (this.rBx * py - this.rBy * px) * bodyB.invInertia;
  }

  solveVelocity(): void {
    const bodyA = this.bodyA;
    const bodyB = this.bodyB;

    // Relative velocity at constraint points projected onto axis
    const vpAx = bodyA.velocity.x + (-bodyA.angularVelocity * this.rAy);
    const vpAy = bodyA.velocity.y + (bodyA.angularVelocity * this.rAx);
    const vpBx = bodyB.velocity.x + (-bodyB.angularVelocity * this.rBy);
    const vpBy = bodyB.velocity.y + (bodyB.angularVelocity * this.rBx);

    const Cdot = (vpBx - vpAx) * this.nx + (vpBy - vpAy) * this.ny;

    // Compute impulse (no clamping — bilateral constraint)
    const lambda = -this.mass * (Cdot + this.bias);
    this.impulse += lambda;

    // Apply impulse
    const px = lambda * this.nx;
    const py = lambda * this.ny;
    bodyA.velocity.x -= px * bodyA.invMass;
    bodyA.velocity.y -= py * bodyA.invMass;
    bodyA.angularVelocity -= (this.rAx * py - this.rAy * px) * bodyA.invInertia;
    bodyB.velocity.x += px * bodyB.invMass;
    bodyB.velocity.y += py * bodyB.invMass;
    bodyB.angularVelocity += (this.rBx * py - this.rBy * px) * bodyB.invInertia;
  }
}
