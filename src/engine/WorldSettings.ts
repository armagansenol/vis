import { Vec2 } from '../math/Vec2.js';

/**
 * Configurable world simulation settings.
 *
 * All fields are optional when passed to the World constructor.
 * Defaults are applied internally via {@link DEFAULT_WORLD_SETTINGS}.
 */
export interface WorldSettings {
  /** Gravity acceleration vector. Default: (0, -9.81). */
  gravity: Vec2;
  /** Fixed timestep duration in seconds. Default: 1/60. */
  fixedDt: number;
  /** Maximum physics steps per frame (spiral of death cap). Default: 5. */
  maxSteps: number;
  /** Velocity constraint solver iterations per step. Default: 8. */
  velocityIterations: number;
  /** Position correction iterations per step. Default: 4. */
  positionIterations: number;
  /** Baumgarte stabilization factor. Default: 0.2. */
  baumgarteFactor: number;
  /** Penetration slop (dead-zone for position correction). Default: 0.01. */
  penetrationSlop: number;
  /** Restitution velocity threshold. Default: 0.5. */
  restitutionSlop: number;
  /** Cell size for spatial hash broadphase. Default: 2. */
  cellSize: number;
}

export const DEFAULT_WORLD_SETTINGS: WorldSettings = {
  gravity: new Vec2(0, -9.81),
  fixedDt: 1 / 60,
  maxSteps: 5,
  velocityIterations: 8,
  positionIterations: 4,
  baumgarteFactor: 0.2,
  penetrationSlop: 0.01,
  restitutionSlop: 0.5,
  cellSize: 2,
};
