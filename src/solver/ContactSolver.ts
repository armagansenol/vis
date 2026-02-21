import { type Manifold } from '../collision/Manifold.js';
import { DEFAULT_SOLVER_CONSTANTS, type SolverConstants } from './SolverConstants.js';

/**
 * Sequential impulse constraint solver.
 *
 * Stub -- implementation pending (TDD RED phase).
 */
export class ContactSolver {
  private constants: SolverConstants;

  constructor(constants?: SolverConstants) {
    this.constants = constants ?? DEFAULT_SOLVER_CONSTANTS;
  }

  preStep(_manifolds: Manifold[], _dt: number): void {
    throw new Error('ContactSolver.preStep not yet implemented');
  }

  solve(): void {
    throw new Error('ContactSolver.solve not yet implemented');
  }
}
