/**
 * Configurable solver tuning parameters.
 */
export interface SolverConstants {
  /** Number of velocity constraint iterations per step. */
  velocityIterations: number;
  /** Number of position correction iterations per step. */
  positionIterations: number;
  /** Baumgarte stabilization factor (beta). */
  baumgarteFactor: number;
  /** Penetration slop (dead-zone for position correction). */
  penetrationSlop: number;
  /** Restitution velocity threshold (below this, no bounce). */
  restitutionSlop: number;
  /** Maximum linear position correction per iteration. */
  maxLinearCorrection: number;
}

export const DEFAULT_SOLVER_CONSTANTS: SolverConstants = {
  velocityIterations: 8,
  positionIterations: 4,
  baumgarteFactor: 0.2,
  penetrationSlop: 0.01,
  restitutionSlop: 0.5,
  maxLinearCorrection: 0.2,
};
