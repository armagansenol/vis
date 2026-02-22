import { type Body } from '../dynamics/Body.js';
import { type Constraint } from './Constraint.js';

/**
 * Options for constructing a MouseConstraint.
 */
export interface MouseConstraintOptions {
  /** Natural frequency in Hz. Default: 5.0. */
  hertz?: number;
  /** Damping ratio (0 = no damping, 1 = critically damped). Default: 0.7. */
  dampingRatio?: number;
  /** Maximum force magnitude. Default: 1000 * body.mass (or 1000 if static). */
  maxForce?: number;
}

/**
 * 2D soft constraint from a body point to a world target position.
 *
 * Used for interactive mouse/pointer dragging. The constraint acts like a
 * spring pulling the body's anchor point toward the target position, with
 * configurable frequency and damping.
 *
 * Uses Erin Catto's gamma/beta formulation for soft constraint behavior.
 * Follows the Box2D / Planck.js MouseJoint pattern.
 */
export class MouseConstraint implements Constraint {
  /** For Constraint interface compatibility. Both point to the same body. */
  readonly bodyA: Body;
  readonly bodyB: Body;
  readonly collideConnected: boolean;

  private readonly body: Body;
  private readonly localAnchor: { x: number; y: number };
  private targetX: number;
  private targetY: number;
  private readonly hertz: number;
  private readonly dampingRatio: number;
  private readonly maxForce: number;

  // Solver state (recomputed each preStep)
  private rBx = 0;
  private rBy = 0;
  private em11 = 0;
  private em12 = 0;
  private em22 = 0;
  private impulseX = 0;
  private impulseY = 0;
  private gamma = 0;
  private betaVal = 0;
  private Cx = 0;
  private Cy = 0;
  private dt = 1 / 60;

  constructor(
    body: Body,
    localAnchor: { x: number; y: number },
    targetWorldPoint: { x: number; y: number },
    options?: MouseConstraintOptions,
  ) {
    this.body = body;
    // For Constraint interface: both bodyA and bodyB reference the same body
    this.bodyA = body;
    this.bodyB = body;
    this.collideConnected = true; // irrelevant for mouse constraint

    // Clone anchor and target
    this.localAnchor = { x: localAnchor.x, y: localAnchor.y };
    this.targetX = targetWorldPoint.x;
    this.targetY = targetWorldPoint.y;

    this.hertz = options?.hertz ?? 5.0;
    this.dampingRatio = options?.dampingRatio ?? 0.7;

    const bodyMass = body.mass > 0 ? body.mass : 1;
    this.maxForce = options?.maxForce ?? 1000 * bodyMass;
  }

  /** Update the target world position (call each frame with mouse/pointer position). */
  setTarget(worldPoint: { x: number; y: number }): void {
    this.targetX = worldPoint.x;
    this.targetY = worldPoint.y;
  }

  preStep(dt: number): void {
    this.dt = dt;
    const body = this.body;
    const invMass = body.invMass;
    const invInertia = body.invInertia;

    // 1. Transform localAnchor to world space
    const cosB = Math.cos(body.angle);
    const sinB = Math.sin(body.angle);
    const worldAnchorX = body.position.x + cosB * this.localAnchor.x - sinB * this.localAnchor.y;
    const worldAnchorY = body.position.y + sinB * this.localAnchor.x + cosB * this.localAnchor.y;

    // 2. Lever arm
    this.rBx = worldAnchorX - body.position.x;
    this.rBy = worldAnchorY - body.position.y;

    // 3. Soft constraint terms (Catto gamma/beta for 2D)
    const mass = body.mass > 0 ? body.mass : 1;
    const omega = 2 * Math.PI * this.hertz;
    const d = 2 * mass * this.dampingRatio * omega;
    const k = mass * omega * omega;
    const h = dt;

    const gammaInv = h * (d + h * k);
    this.gamma = gammaInv !== 0 ? 1 / gammaInv : 0;
    this.betaVal = h * k * this.gamma;

    // 4. Position error
    this.Cx = worldAnchorX - this.targetX;
    this.Cy = worldAnchorY - this.targetY;

    // 5. Build 2x2 K matrix (only body terms, "bodyA" is ground)
    const k11 = invMass + invInertia * this.rBy * this.rBy + this.gamma;
    const k12 = -invInertia * this.rBx * this.rBy;
    const k22 = invMass + invInertia * this.rBx * this.rBx + this.gamma;

    // 6. Invert K using Cramer's rule
    const det = k11 * k22 - k12 * k12;
    const invDet = det !== 0 ? 1 / det : 0;
    this.em11 = k22 * invDet;
    this.em12 = -k12 * invDet;
    this.em22 = k11 * invDet;

    // 7. Warm-start
    body.velocity.x += this.impulseX * invMass;
    body.velocity.y += this.impulseY * invMass;
    body.angularVelocity += (this.rBx * this.impulseY - this.rBy * this.impulseX) * invInertia;
  }

  solveVelocity(): void {
    const body = this.body;
    const invMass = body.invMass;
    const invInertia = body.invInertia;

    // 1. Velocity at anchor
    const CdotX = body.velocity.x + (-body.angularVelocity * this.rBy);
    const CdotY = body.velocity.y + (body.angularVelocity * this.rBx);

    // 2. Impulse with gamma feedback
    const rhsX = CdotX + this.betaVal * this.Cx + this.gamma * this.impulseX;
    const rhsY = CdotY + this.betaVal * this.Cy + this.gamma * this.impulseY;

    const lambdaX = -(this.em11 * rhsX + this.em12 * rhsY);
    const lambdaY = -(this.em12 * rhsX + this.em22 * rhsY);

    // 3. Accumulate
    const oldX = this.impulseX;
    const oldY = this.impulseY;
    this.impulseX += lambdaX;
    this.impulseY += lambdaY;

    // 4. Max force clamping
    const mag = Math.sqrt(this.impulseX * this.impulseX + this.impulseY * this.impulseY);
    const maxImpulse = this.maxForce * this.dt;
    if (mag > maxImpulse) {
      const scale = maxImpulse / mag;
      this.impulseX *= scale;
      this.impulseY *= scale;
    }

    // 5. Applied delta
    const applyX = this.impulseX - oldX;
    const applyY = this.impulseY - oldY;

    // 6. Apply to body
    body.velocity.x += applyX * invMass;
    body.velocity.y += applyY * invMass;
    body.angularVelocity += (this.rBx * applyY - this.rBy * applyX) * invInertia;
  }

  getWorldAnchorA(): { x: number; y: number } {
    const cos = Math.cos(this.body.angle);
    const sin = Math.sin(this.body.angle);
    return {
      x: this.body.position.x + cos * this.localAnchor.x - sin * this.localAnchor.y,
      y: this.body.position.y + sin * this.localAnchor.x + cos * this.localAnchor.y,
    };
  }

  getWorldAnchorB(): { x: number; y: number } {
    return { x: this.targetX, y: this.targetY };
  }
}
