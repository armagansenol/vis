import { type Body } from '../dynamics/Body.js';
import { type Vec2 } from '../math/Vec2.js';
import { type Constraint } from './Constraint.js';

/**
 * Options for constructing a SpringConstraint.
 */
export interface SpringConstraintOptions {
  /**
   * Rest length of the spring.
   * If not provided, computed from initial body positions + anchor offsets.
   */
  length?: number;
  /** Natural frequency in Hz. Default: 1.0. */
  hertz?: number;
  /** Damping ratio (0 = no damping, 1 = critically damped). Default: 0.5. */
  dampingRatio?: number;
  /** Whether connected bodies should collide. Default: false. */
  collideConnected?: boolean;
}

/**
 * Soft 1D distance constraint using Erin Catto's gamma/beta formulation.
 *
 * Produces elastic (spring-like) behavior between two anchor points on
 * two bodies. The spring parameters are specified using frequency (hertz)
 * and damping ratio, which are mass-independent and intuitive to tune.
 *
 * Source: Erin Catto "Soft Constraints" GDC 2011.
 */
export class SpringConstraint implements Constraint {
  readonly bodyA: Body;
  readonly bodyB: Body;
  readonly collideConnected: boolean;

  private readonly localAnchorA: { x: number; y: number };
  private readonly localAnchorB: { x: number; y: number };
  private readonly length: number;
  private hertz: number;
  private dampingRatio: number;

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
  private gamma = 0;
  private softMass = 0;

  constructor(
    bodyA: Body,
    bodyB: Body,
    localAnchorA: Vec2,
    localAnchorB: Vec2,
    options?: SpringConstraintOptions,
  ) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.collideConnected = options?.collideConnected ?? false;
    this.hertz = options?.hertz ?? 1.0;
    this.dampingRatio = options?.dampingRatio ?? 0.5;

    // Clone anchors to prevent external mutation
    this.localAnchorA = { x: localAnchorA.x, y: localAnchorA.y };
    this.localAnchorB = { x: localAnchorB.x, y: localAnchorB.y };

    // Compute initial length if not provided
    if (options?.length !== undefined) {
      this.length = options.length;
    } else {
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

    // Clamp hertz to Nyquist limit to prevent instability
    const nyquistLimit = 0.5 / dt;
    const hertz = Math.min(this.hertz, nyquistLimit);

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

    // Catto soft constraint terms (gamma/beta formulation)
    const omega = 2 * Math.PI * hertz;
    const d = 2 * this.mass * this.dampingRatio * omega;
    const k = this.mass * omega * omega;
    this.gamma = 1 / (dt * (d + dt * k));
    const beta = dt * k * this.gamma;

    // Soft effective mass (includes gamma)
    this.softMass = invMassSum + this.gamma;
    this.softMass = this.softMass > 0 ? 1 / this.softMass : 0;

    // Spring bias (NOT Baumgarte)
    const C = dist - this.length;
    this.bias = beta * C;

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

    // Soft constraint impulse (includes gamma feedback + bias)
    const lambda = -this.softMass * (Cdot + this.bias + this.gamma * this.impulse);
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

  getWorldAnchorA(): { x: number; y: number } {
    const cos = Math.cos(this.bodyA.angle);
    const sin = Math.sin(this.bodyA.angle);
    return {
      x: this.bodyA.position.x + cos * this.localAnchorA.x - sin * this.localAnchorA.y,
      y: this.bodyA.position.y + sin * this.localAnchorA.x + cos * this.localAnchorA.y,
    };
  }

  getWorldAnchorB(): { x: number; y: number } {
    const cos = Math.cos(this.bodyB.angle);
    const sin = Math.sin(this.bodyB.angle);
    return {
      x: this.bodyB.position.x + cos * this.localAnchorB.x - sin * this.localAnchorB.y,
      y: this.bodyB.position.y + sin * this.localAnchorB.x + cos * this.localAnchorB.y,
    };
  }
}
