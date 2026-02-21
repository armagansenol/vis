/**
 * Configurable solver tuning parameters.
 */
export interface SolverConstants {
  /** Number of velocity constraint iterations per step. */
  velocityIterations: number;
  /** Baumgarte stabilization factor (beta). */
  baumgarteFactor: number;
  /** Penetration slop (dead-zone for position correction). */
  penetrationSlop: number;
  /** Restitution velocity threshold (below this, no bounce). */
  restitutionSlop: number;
}

export const DEFAULT_SOLVER_CONSTANTS: SolverConstants = {
  velocityIterations: 8,
  baumgarteFactor: 0.2,
  penetrationSlop: 0.01,
  restitutionSlop: 0.5,
};
