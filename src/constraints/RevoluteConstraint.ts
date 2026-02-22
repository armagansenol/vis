import { type Body } from '../dynamics/Body.js';
import { type Constraint } from './Constraint.js';

/**
 * Options for constructing a RevoluteConstraint.
 */
export interface RevoluteConstraintOptions {
  /** Whether angle limits are enabled. Default: false. */
  enableLimit?: boolean;
  /** Lower angle limit in radians. Default: 0. */
  lowerAngle?: number;
  /** Upper angle limit in radians. Default: 0. */
  upperAngle?: number;
  /** Whether motor is enabled. Default: false. */
  enableMotor?: boolean;
  /** Motor target angular velocity in rad/s. Default: 0. */
  motorSpeed?: number;
  /** Maximum motor torque. Default: 0. */
  maxMotorTorque?: number;
  /** Whether connected bodies should collide. Default: false. */
  collideConnected?: boolean;
}

type LimitState = 'inactive' | 'atLower' | 'atUpper' | 'equal';

/**
 * 2D revolute (hinge) constraint.
 *
 * Constrains two bodies to share a common anchor point (removes 2 translational DOF),
 * allowing free rotation around that point. Optionally enforces angular limits and/or
 * drives the joint with a motor.
 *
 * Follows the Box2D / Planck.js RevoluteJoint pattern.
 */
export class RevoluteConstraint implements Constraint {
  readonly bodyA: Body;
  readonly bodyB: Body;
  readonly collideConnected: boolean;

  private readonly localAnchorA: { x: number; y: number };
  private readonly localAnchorB: { x: number; y: number };
  private readonly referenceAngle: number;

  private enableLimit: boolean;
  private lowerAngle: number;
  private upperAngle: number;
  private enableMotor: boolean;
  private _motorSpeed: number;
  private maxMotorTorque: number;

  // Solver state (recomputed each preStep)
  private rAx = 0;
  private rAy = 0;
  private rBx = 0;
  private rBy = 0;
  private em11 = 0;
  private em12 = 0;
  private em22 = 0;
  private impulseX = 0;
  private impulseY = 0;
  private angularMass = 0;
  private angularImpulse = 0;
  private motorImpulse = 0;
  private limitState: LimitState = 'inactive';
  private biasX = 0;
  private biasY = 0;
  private dt = 1 / 60;

  constructor(
    bodyA: Body,
    bodyB: Body,
    worldAnchor: { x: number; y: number },
    options?: RevoluteConstraintOptions,
  ) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.collideConnected = options?.collideConnected ?? false;

    this.enableLimit = options?.enableLimit ?? false;
    this.lowerAngle = options?.lowerAngle ?? 0;
    this.upperAngle = options?.upperAngle ?? 0;
    this.enableMotor = options?.enableMotor ?? false;
    this._motorSpeed = options?.motorSpeed ?? 0;
    this.maxMotorTorque = options?.maxMotorTorque ?? 0;

    // Convert world anchor to local space for each body
    const cosA = Math.cos(bodyA.angle);
    const sinA = Math.sin(bodyA.angle);
    const dxA = worldAnchor.x - bodyA.position.x;
    const dyA = worldAnchor.y - bodyA.position.y;
    this.localAnchorA = {
      x: cosA * dxA + sinA * dyA,
      y: -sinA * dxA + cosA * dyA,
    };

    const cosB = Math.cos(bodyB.angle);
    const sinB = Math.sin(bodyB.angle);
    const dxB = worldAnchor.x - bodyB.position.x;
    const dyB = worldAnchor.y - bodyB.position.y;
    this.localAnchorB = {
      x: cosB * dxB + sinB * dyB,
      y: -sinB * dxB + cosB * dyB,
    };

    // Reference angle at construction time
    this.referenceAngle = bodyB.angle - bodyA.angle;
  }

  /** Get the current joint angle relative to the reference angle. */
  getJointAngle(): number {
    return this.bodyB.angle - this.bodyA.angle - this.referenceAngle;
  }

  /** Set the motor speed in rad/s. */
  setMotorSpeed(speed: number): void {
    this._motorSpeed = speed;
  }

  /** Set the angle limits in radians. */
  setLimits(lower: number, upper: number): void {
    this.lowerAngle = lower;
    this.upperAngle = upper;
  }

  preStep(dt: number): void {
    this.dt = dt;
    const bodyA = this.bodyA;
    const bodyB = this.bodyB;
    const mA = bodyA.invMass;
    const mB = bodyB.invMass;
    const iA = bodyA.invInertia;
    const iB = bodyB.invInertia;

    // 1. Transform local anchors to world space
    const cosA = Math.cos(bodyA.angle);
    const sinA = Math.sin(bodyA.angle);
    this.rAx = cosA * this.localAnchorA.x - sinA * this.localAnchorA.y;
    this.rAy = sinA * this.localAnchorA.x + cosA * this.localAnchorA.y;

    const cosB = Math.cos(bodyB.angle);
    const sinB = Math.sin(bodyB.angle);
    this.rBx = cosB * this.localAnchorB.x - sinB * this.localAnchorB.y;
    this.rBy = sinB * this.localAnchorB.x + cosB * this.localAnchorB.y;

    // 2. Build 2x2 K matrix
    const k11 = mA + mB + iA * this.rAy * this.rAy + iB * this.rBy * this.rBy;
    const k12 = -iA * this.rAx * this.rAy - iB * this.rBx * this.rBy;
    const k22 = mA + mB + iA * this.rAx * this.rAx + iB * this.rBx * this.rBx;

    // 3. Invert K using Cramer's rule
    const det = k11 * k22 - k12 * k12;
    const invDet = det !== 0 ? 1 / det : 0;
    this.em11 = k22 * invDet;
    this.em12 = -k12 * invDet;
    this.em22 = k11 * invDet;

    // 4. Angular effective mass
    const invInertiaSum = iA + iB;
    this.angularMass = invInertiaSum > 0 ? 1 / invInertiaSum : 0;

    // 5. Angle limit state detection
    if (this.enableLimit) {
      const currentAngle = bodyB.angle - bodyA.angle - this.referenceAngle;
      if (this.lowerAngle === this.upperAngle) {
        this.limitState = 'equal';
      } else if (currentAngle <= this.lowerAngle) {
        this.limitState = 'atLower';
      } else if (currentAngle >= this.upperAngle) {
        this.limitState = 'atUpper';
      } else {
        this.limitState = 'inactive';
        this.angularImpulse = 0;
      }
    } else {
      this.limitState = 'inactive';
      this.angularImpulse = 0;
    }

    // 6. If motor not enabled, reset motor impulse
    if (!this.enableMotor) {
      this.motorImpulse = 0;
    }

    // Baumgarte bias for point constraint
    const worldAnchorAx = bodyA.position.x + this.rAx;
    const worldAnchorAy = bodyA.position.y + this.rAy;
    const worldAnchorBx = bodyB.position.x + this.rBx;
    const worldAnchorBy = bodyB.position.y + this.rBy;
    const beta = 0.2;
    this.biasX = (beta / dt) * (worldAnchorBx - worldAnchorAx);
    this.biasY = (beta / dt) * (worldAnchorBy - worldAnchorAy);

    // 7. Warm-start: apply cached impulses
    // Point constraint impulse
    bodyA.velocity.x -= this.impulseX * mA;
    bodyA.velocity.y -= this.impulseY * mA;
    bodyA.angularVelocity -= (this.rAx * this.impulseY - this.rAy * this.impulseX) * iA;
    bodyB.velocity.x += this.impulseX * mB;
    bodyB.velocity.y += this.impulseY * mB;
    bodyB.angularVelocity += (this.rBx * this.impulseY - this.rBy * this.impulseX) * iB;

    // Angular impulse (limit + motor)
    const totalAngularImpulse = this.angularImpulse + this.motorImpulse;
    bodyA.angularVelocity -= totalAngularImpulse * iA;
    bodyB.angularVelocity += totalAngularImpulse * iB;
  }

  solveVelocity(): void {
    const bodyA = this.bodyA;
    const bodyB = this.bodyB;
    const iA = bodyA.invInertia;
    const iB = bodyB.invInertia;

    // 1. Motor (if enabled)
    if (this.enableMotor && this.limitState !== 'equal') {
      const Cdot = bodyB.angularVelocity - bodyA.angularVelocity - this._motorSpeed;
      let lambda = -this.angularMass * Cdot;
      const oldMotorImpulse = this.motorImpulse;
      const maxImpulse = this.maxMotorTorque * this.dt;
      this.motorImpulse = Math.max(-maxImpulse, Math.min(oldMotorImpulse + lambda, maxImpulse));
      lambda = this.motorImpulse - oldMotorImpulse;
      bodyA.angularVelocity -= lambda * iA;
      bodyB.angularVelocity += lambda * iB;
    }

    // 2. Angle limit (if active)
    if (this.enableLimit && this.limitState !== 'inactive') {
      const Cdot = bodyB.angularVelocity - bodyA.angularVelocity;
      let lambda = -this.angularMass * Cdot;

      if (this.limitState === 'equal') {
        // Bilateral -- no clamping
        this.angularImpulse += lambda;
      } else if (this.limitState === 'atLower') {
        const oldImpulse = this.angularImpulse;
        this.angularImpulse = Math.max(this.angularImpulse + lambda, 0);
        lambda = this.angularImpulse - oldImpulse;
      } else if (this.limitState === 'atUpper') {
        const oldImpulse = this.angularImpulse;
        this.angularImpulse = Math.min(this.angularImpulse + lambda, 0);
        lambda = this.angularImpulse - oldImpulse;
      }

      bodyA.angularVelocity -= lambda * iA;
      bodyB.angularVelocity += lambda * iB;
    }

    // 3. Point constraint (always active)
    const wA = bodyA.angularVelocity;
    const wB = bodyB.angularVelocity;

    // Relative velocity at anchor
    const CdotX = bodyB.velocity.x + (-wB * this.rBy) - bodyA.velocity.x - (-wA * this.rAy);
    const CdotY = bodyB.velocity.y + (wB * this.rBx) - bodyA.velocity.y - (wA * this.rAx);

    // Add bias
    const rhsX = CdotX + this.biasX;
    const rhsY = CdotY + this.biasY;

    // lambda = -K^-1 * (Cdot + bias)
    const lambdaX = -(this.em11 * rhsX + this.em12 * rhsY);
    const lambdaY = -(this.em12 * rhsX + this.em22 * rhsY);

    this.impulseX += lambdaX;
    this.impulseY += lambdaY;

    // Apply 2D impulse
    bodyA.velocity.x -= lambdaX * bodyA.invMass;
    bodyA.velocity.y -= lambdaY * bodyA.invMass;
    bodyA.angularVelocity -= (this.rAx * lambdaY - this.rAy * lambdaX) * iA;
    bodyB.velocity.x += lambdaX * bodyB.invMass;
    bodyB.velocity.y += lambdaY * bodyB.invMass;
    bodyB.angularVelocity += (this.rBx * lambdaY - this.rBy * lambdaX) * iB;
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
