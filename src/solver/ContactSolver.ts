import { type Manifold, type ContactPoint } from '../collision/Manifold.js';
import { type Body } from '../dynamics/Body.js';
import { DEFAULT_SOLVER_CONSTANTS, type SolverConstants } from './SolverConstants.js';

/**
 * Pre-computed per-contact constraint data used during velocity solving.
 */
interface ContactConstraint {
  bodyA: Body;
  bodyB: Body;
  contact: ContactPoint;
  /** Lever arm from bodyA center to contact point. */
  rAx: number;
  rAy: number;
  /** Lever arm from bodyB center to contact point. */
  rBx: number;
  rBy: number;
  /** Collision normal (from A toward B). */
  nx: number;
  ny: number;
  /** Tangent vector (-ny, nx). */
  tx: number;
  ty: number;
  /** Effective mass along normal direction. */
  normalMass: number;
  /** Effective mass along tangent direction. */
  tangentMass: number;
  /** Velocity bias for Baumgarte stabilization + restitution bounce. */
  bias: number;
  /** Combined friction for this manifold. */
  friction: number;
}

/**
 * Sequential impulse constraint solver.
 *
 * Operates on Manifold[] from the collision system. Follows a three-phase
 * lifecycle per physics step:
 *
 * 1. preStep(manifolds, dt) -- build constraints, compute effective masses, warm-start
 * 2. solve() -- called N times per step for iterative convergence
 * 3. postStep() -- (implicit: accumulated impulses are mutated in-place on ContactPoint)
 */
export class ContactSolver {
  private constants: SolverConstants;
  private constraints: ContactConstraint[] = [];

  constructor(constants?: SolverConstants) {
    this.constants = constants ?? DEFAULT_SOLVER_CONSTANTS;
  }

  /**
   * Build contact constraints from manifolds, compute effective masses and bias,
   * then apply warm-start impulses from cached contact data.
   */
  preStep(manifolds: Manifold[], dt: number): void {
    this.constraints.length = 0;

    const beta = this.constants.baumgarteFactor;
    const slop = this.constants.penetrationSlop;
    const restitutionSlop = this.constants.restitutionSlop;
    const invDt = dt > 0 ? 1 / dt : 0;

    for (let m = 0; m < manifolds.length; m++) {
      const manifold = manifolds[m];

      // Skip sensor manifolds -- they don't resolve
      if (manifold.isSensor) continue;

      const bodyA = manifold.bodyA;
      const bodyB = manifold.bodyB;
      const nx = manifold.normal.x;
      const ny = manifold.normal.y;
      const tx = -ny;
      const ty = nx;
      const friction = manifold.friction;
      const restitution = manifold.restitution;

      const invMassA = bodyA.invMass;
      const invMassB = bodyB.invMass;
      const invInertiaA = bodyA.invInertia;
      const invInertiaB = bodyB.invInertia;

      for (let c = 0; c < manifold.contacts.length; c++) {
        const contact = manifold.contacts[c];

        // Lever arms
        const rAx = contact.point.x - bodyA.position.x;
        const rAy = contact.point.y - bodyA.position.y;
        const rBx = contact.point.x - bodyB.position.x;
        const rBy = contact.point.y - bodyB.position.y;

        // rA cross normal, rB cross normal
        const rAxN = rAx * ny - rAy * nx;
        const rBxN = rBx * ny - rBy * nx;

        // Effective mass for normal direction
        const kNormal = invMassA + invMassB +
          invInertiaA * rAxN * rAxN +
          invInertiaB * rBxN * rBxN;
        const normalMass = kNormal > 0 ? 1 / kNormal : 0;

        // rA cross tangent, rB cross tangent
        const rAxT = rAx * ty - rAy * tx;
        const rBxT = rBx * ty - rBy * tx;

        // Effective mass for tangent direction
        const kTangent = invMassA + invMassB +
          invInertiaA * rAxT * rAxT +
          invInertiaB * rBxT * rBxT;
        const tangentMass = kTangent > 0 ? 1 / kTangent : 0;

        // Compute relative velocity at contact BEFORE warm-starting
        // vRel = vB + wB x rB - vA - wA x rA
        const dvx = (bodyB.velocity.x + (-bodyB.angularVelocity * rBy)) -
                     (bodyA.velocity.x + (-bodyA.angularVelocity * rAy));
        const dvy = (bodyB.velocity.y + (bodyB.angularVelocity * rBx)) -
                     (bodyA.velocity.y + (bodyA.angularVelocity * rAx));

        // Normal component of relative velocity
        const vn = dvx * nx + dvy * ny;

        // Velocity bias: max(Baumgarte, restitution) — not the sum.
        //
        // Summing Baumgarte + restitution injects extra energy into elastic
        // impacts, causing overcorrection (e.g., Newton's Cradle balls flying
        // apart). Taking the max ensures:
        // - Elastic impacts: restitution dominates, no extra energy from Baumgarte
        // - Inelastic impacts: Baumgarte provides penetration correction
        // - Resting contacts: Baumgarte prevents drift under persistent forces
        let baumgarteBias = 0;
        const penetration = contact.depth - slop;
        if (penetration > 0) {
          baumgarteBias = (beta * 0.5 * invDt) * penetration;
        }
        let restitutionBias = 0;
        if (-vn > restitutionSlop) {
          restitutionBias = restitution * (-vn);
        }
        const bias = Math.max(baumgarteBias, restitutionBias);

        const constraint: ContactConstraint = {
          bodyA,
          bodyB,
          contact,
          rAx, rAy,
          rBx, rBy,
          nx, ny,
          tx, ty,
          normalMass,
          tangentMass,
          bias,
          friction,
        };

        this.constraints.push(constraint);

        // Warm-start: apply cached impulses from previous frame
        const pnx = contact.normalImpulse * nx + contact.tangentImpulse * tx;
        const pny = contact.normalImpulse * ny + contact.tangentImpulse * ty;

        // Apply to bodyA (subtract)
        bodyA.velocity.x -= pnx * invMassA;
        bodyA.velocity.y -= pny * invMassA;
        bodyA.angularVelocity -= (rAx * pny - rAy * pnx) * invInertiaA;

        // Apply to bodyB (add)
        bodyB.velocity.x += pnx * invMassB;
        bodyB.velocity.y += pny * invMassB;
        bodyB.angularVelocity += (rBx * pny - rBy * pnx) * invInertiaB;
      }
    }
  }

  /**
   * One iteration of sequential impulse solving (normal + friction).
   * Called multiple times per step for convergence.
   */
  solve(): void {
    for (let i = 0; i < this.constraints.length; i++) {
      const cc = this.constraints[i];
      const bodyA = cc.bodyA;
      const bodyB = cc.bodyB;
      const contact = cc.contact;

      const invMassA = bodyA.invMass;
      const invMassB = bodyB.invMass;
      const invInertiaA = bodyA.invInertia;
      const invInertiaB = bodyB.invInertia;

      // Recompute relative velocity at contact point
      const dvx = (bodyB.velocity.x + (-bodyB.angularVelocity * cc.rBy)) -
                   (bodyA.velocity.x + (-bodyA.angularVelocity * cc.rAy));
      const dvy = (bodyB.velocity.y + (bodyB.angularVelocity * cc.rBx)) -
                   (bodyA.velocity.y + (bodyA.angularVelocity * cc.rAx));

      // ---- Normal impulse ----
      const vn = dvx * cc.nx + dvy * cc.ny;
      let lambda = cc.normalMass * (-vn + cc.bias);

      // Accumulated clamping: total normal impulse must be >= 0
      const oldNormalImpulse = contact.normalImpulse;
      const newNormalImpulse = Math.max(oldNormalImpulse + lambda, 0);
      lambda = newNormalImpulse - oldNormalImpulse;
      contact.normalImpulse = newNormalImpulse;

      // Apply normal impulse
      const pnx = lambda * cc.nx;
      const pny = lambda * cc.ny;

      bodyA.velocity.x -= pnx * invMassA;
      bodyA.velocity.y -= pny * invMassA;
      bodyA.angularVelocity -= (cc.rAx * pny - cc.rAy * pnx) * invInertiaA;

      bodyB.velocity.x += pnx * invMassB;
      bodyB.velocity.y += pny * invMassB;
      bodyB.angularVelocity += (cc.rBx * pny - cc.rBy * pnx) * invInertiaB;

      // ---- Friction impulse ----
      // Recompute relative velocity after normal correction
      const dvx2 = (bodyB.velocity.x + (-bodyB.angularVelocity * cc.rBy)) -
                    (bodyA.velocity.x + (-bodyA.angularVelocity * cc.rAy));
      const dvy2 = (bodyB.velocity.y + (bodyB.angularVelocity * cc.rBx)) -
                    (bodyA.velocity.y + (bodyA.angularVelocity * cc.rAx));

      const vt = dvx2 * cc.tx + dvy2 * cc.ty;
      let lambdaT = cc.tangentMass * (-vt);

      // Coulomb friction clamping: |tangentImpulse| <= friction * normalImpulse
      const maxFriction = cc.friction * contact.normalImpulse;
      const oldTangentImpulse = contact.tangentImpulse;
      let newTangentImpulse = oldTangentImpulse + lambdaT;
      if (newTangentImpulse < -maxFriction) newTangentImpulse = -maxFriction;
      if (newTangentImpulse > maxFriction) newTangentImpulse = maxFriction;
      lambdaT = newTangentImpulse - oldTangentImpulse;
      contact.tangentImpulse = newTangentImpulse;

      // Apply friction impulse
      const ptx = lambdaT * cc.tx;
      const pty = lambdaT * cc.ty;

      bodyA.velocity.x -= ptx * invMassA;
      bodyA.velocity.y -= pty * invMassA;
      bodyA.angularVelocity -= (cc.rAx * pty - cc.rAy * ptx) * invInertiaA;

      bodyB.velocity.x += ptx * invMassB;
      bodyB.velocity.y += pty * invMassB;
      bodyB.angularVelocity += (cc.rBx * pty - cc.rBy * ptx) * invInertiaB;
    }
  }

  /**
   * One iteration of position correction (NGS-style linear projection).
   *
   * Directly moves body positions to reduce penetration. Called after
   * velocity solving and position integration. Does NOT inject velocity,
   * preventing energy accumulation that causes stack instability.
   *
   * @returns true if all contacts are within tolerance.
   */
  solvePositions(): boolean {
    const slop = this.constants.penetrationSlop;
    const beta = this.constants.baumgarteFactor;
    const maxCorrection = this.constants.maxLinearCorrection;
    let allResolved = true;

    for (let i = 0; i < this.constraints.length; i++) {
      const cc = this.constraints[i];
      const bodyA = cc.bodyA;
      const bodyB = cc.bodyB;

      const invMassA = bodyA.invMass;
      const invMassB = bodyB.invMass;
      const invInertiaA = bodyA.invInertia;
      const invInertiaB = bodyB.invInertia;

      // Recompute lever arms from current positions
      const rAx = cc.contact.point.x - bodyA.position.x;
      const rAy = cc.contact.point.y - bodyA.position.y;
      const rBx = cc.contact.point.x - bodyB.position.x;
      const rBy = cc.contact.point.y - bodyB.position.y;

      // Estimate current separation along normal
      // separation < 0 means overlapping
      const rAn = rAx * cc.ny - rAy * cc.nx; // rA cross normal
      const rBn = rBx * cc.ny - rBy * cc.nx; // rB cross normal

      // Effective mass for normal direction (recomputed with current lever arms)
      const kNormal = invMassA + invMassB +
        invInertiaA * rAn * rAn +
        invInertiaB * rBn * rBn;

      if (kNormal <= 0) continue;

      // Approximate separation: negative depth means overlap
      const separation = -cc.contact.depth + slop;
      if (separation >= 0) continue;

      allResolved = false;

      // Position correction: clamp to avoid overshooting
      const correction = Math.min(
        Math.max(beta * (-separation), 0),
        maxCorrection,
      );
      const impulse = correction / kNormal;

      // Apply position correction (NO velocity change)
      bodyA.position.x -= cc.nx * impulse * invMassA;
      bodyA.position.y -= cc.ny * impulse * invMassA;
      bodyA.angle -= rAn * impulse * invInertiaA;

      bodyB.position.x += cc.nx * impulse * invMassB;
      bodyB.position.y += cc.ny * impulse * invMassB;
      bodyB.angle += rBn * impulse * invInertiaB;
    }

    return allResolved;
  }
}
