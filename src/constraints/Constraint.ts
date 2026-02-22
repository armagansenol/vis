import { type Body } from '../dynamics/Body.js';

/**
 * Common interface for all physics constraints (joints).
 *
 * Constraints remove degrees of freedom between two bodies by applying
 * corrective impulses during the velocity solver phase. Each constraint
 * follows a two-phase lifecycle per physics step:
 *
 * 1. `preStep(dt)` — Compute Jacobians, effective masses, bias terms,
 *    and apply warm-start impulses from the previous frame.
 * 2. `solveVelocity()` — Compute and apply corrective impulses. Called
 *    N times per step for iterative convergence.
 */
export interface Constraint {
  /** First connected body. */
  readonly bodyA: Body;
  /** Second connected body. */
  readonly bodyB: Body;
  /** Whether connected bodies should collide with each other. */
  readonly collideConnected: boolean;

  /**
   * Pre-compute solver data and apply warm-start impulses.
   * Called once per physics step before the iteration loop.
   */
  preStep(dt: number): void;

  /**
   * Solve velocity constraint (one iteration).
   * Called N times per step for convergence.
   */
  solveVelocity(): void;
}
