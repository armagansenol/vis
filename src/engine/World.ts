import { Body } from '../dynamics/Body.js';
import { BodyType } from '../dynamics/BodyType.js';
import { CollisionSystem } from '../collision/CollisionSystem.js';
import { type Constraint } from '../constraints/Constraint.js';
import { type ContactListener } from '../events/EventDispatcher.js';
import { type Manifold } from '../collision/Manifold.js';
import { ContactSolver } from '../solver/ContactSolver.js';
import { DEFAULT_WORLD_SETTINGS, type WorldSettings } from './WorldSettings.js';

/**
 * The physics world: owns bodies, runs a fixed-timestep accumulator,
 * and orchestrates the collision/solver pipeline each step.
 *
 * Usage:
 * ```ts
 * const world = new World({ gravity: new Vec2(0, -9.81) });
 * world.addBody(body);
 * const alpha = world.step(1 / 60);
 * // Use alpha for render interpolation
 * ```
 */
export class World {
  private readonly settings: WorldSettings;
  private readonly bodies: Body[] = [];
  private readonly constraints: Constraint[] = [];
  private readonly collisionSystem: CollisionSystem;
  private readonly solver: ContactSolver;
  private accumulator = 0;
  private latestManifolds: readonly Manifold[] = [];

  constructor(options?: Partial<WorldSettings>) {
    this.settings = {
      ...DEFAULT_WORLD_SETTINGS,
      // Clone gravity so external mutations don't affect internal state
      gravity: options?.gravity?.clone() ?? DEFAULT_WORLD_SETTINGS.gravity.clone(),
      ...options,
    };

    // Override gravity again if provided (spread may have used the raw Vec2)
    if (options?.gravity) {
      this.settings.gravity = options.gravity.clone();
    }

    this.collisionSystem = new CollisionSystem({
      cellSize: this.settings.cellSize,
    });

    this.solver = new ContactSolver({
      velocityIterations: this.settings.velocityIterations,
      baumgarteFactor: this.settings.baumgarteFactor,
      penetrationSlop: this.settings.penetrationSlop,
      restitutionSlop: this.settings.restitutionSlop,
    });
  }

  /** Direct access to the gravity vector. Mutations affect subsequent steps. */
  get gravity(): import('../math/Vec2.js').Vec2 {
    return this.settings.gravity;
  }

  // ---------------------------------------------------------------------------
  // Body management
  // ---------------------------------------------------------------------------

  /** Add a body to the simulation. */
  addBody(body: Body): void {
    this.bodies.push(body);
  }

  /** Remove a body from the simulation. */
  removeBody(body: Body): void {
    const index = this.bodies.indexOf(body);
    if (index !== -1) {
      this.bodies.splice(index, 1);
    }
  }

  /** Get a readonly view of all bodies in the world. */
  getBodies(): readonly Body[] {
    return this.bodies;
  }

  // ---------------------------------------------------------------------------
  // Constraint management
  // ---------------------------------------------------------------------------

  /** Add a constraint (joint) to the simulation. */
  addConstraint(constraint: Constraint): void {
    this.constraints.push(constraint);
    if (!constraint.collideConnected) {
      this.addPairExclusion(constraint.bodyA.id, constraint.bodyB.id);
    }
  }

  /** Remove a constraint from the simulation. */
  removeConstraint(constraint: Constraint): void {
    const index = this.constraints.indexOf(constraint);
    if (index !== -1) {
      this.constraints.splice(index, 1);
      if (!constraint.collideConnected) {
        this.removePairExclusion(constraint.bodyA.id, constraint.bodyB.id);
      }
    }
  }

  /** Get a readonly view of all constraints in the world. */
  getConstraints(): readonly Constraint[] {
    return this.constraints;
  }

  /** Get the manifolds from the most recent collision detection pass. */
  getManifolds(): readonly Manifold[] {
    return this.latestManifolds;
  }

  // ---------------------------------------------------------------------------
  // Simulation step
  // ---------------------------------------------------------------------------

  /**
   * Advance the simulation by frameDt seconds using a fixed-timestep accumulator.
   *
   * @param frameDt Wall-clock time since last frame (seconds).
   * @returns Interpolation alpha (0-1) for smooth rendering between physics states.
   */
  step(frameDt: number): number {
    const { fixedDt, maxSteps } = this.settings;

    // Clamp frameDt to prevent spiral of death
    const clamped = Math.min(frameDt, maxSteps * fixedDt);
    this.accumulator += clamped;

    // Execute fixed-timestep steps
    while (this.accumulator >= fixedDt) {
      this.singleStep(fixedDt);
      this.accumulator -= fixedDt;
    }

    // Return interpolation alpha for renderer
    return this.accumulator / fixedDt;
  }

  // ---------------------------------------------------------------------------
  // Single physics step (correct pipeline order)
  // ---------------------------------------------------------------------------

  /**
   * Execute one fixed-timestep physics step.
   *
   * Pipeline order (per Box2D/research):
   * 1. Integrate velocities (NOT positions)
   * 2. Detect collisions (broadphase + narrowphase)
   * 3. Solve constraints (preStep + N iterations)
   * 4. Integrate positions from corrected velocities
   * 5. Clear force accumulators
   */
  private singleStep(dt: number): void {
    const { gravity, velocityIterations } = this.settings;
    const bodies = this.bodies;

    // Phase 0: Save previous state for render interpolation (skip static bodies)
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (body.type === BodyType.Static) continue;
      body.prevPosition.x = body.position.x;
      body.prevPosition.y = body.position.y;
      body.prevAngle = body.angle;
    }

    // Phase 1: Integrate velocities only (Dynamic bodies get gravity + forces)
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (body.type === BodyType.Dynamic) {
        body.velocity.x += (body.force.x * body.invMass + gravity.x * body.gravityScale) * dt;
        body.velocity.y += (body.force.y * body.invMass + gravity.y * body.gravityScale) * dt;
        body.angularVelocity += body.torque * body.invInertia * dt;
      }
      // Kinematic: velocity is user-controlled, no changes here
      // Static: no velocity changes
    }

    // Phase 2: Detect collisions
    const manifolds = this.collisionSystem.detect(bodies);
    this.latestManifolds = manifolds;

    // Phase 3: Solve constraints (contacts + joints interleaved)
    this.solver.preStep(manifolds, dt);
    for (let i = 0; i < this.constraints.length; i++) {
      this.constraints[i].preStep(dt);
    }
    for (let iter = 0; iter < velocityIterations; iter++) {
      for (let i = 0; i < this.constraints.length; i++) {
        this.constraints[i].solveVelocity();
      }
      this.solver.solve();
    }

    // Phase 4: Integrate positions from corrected velocities
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (body.type === BodyType.Static) continue;
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.angle += body.angularVelocity * dt;
    }

    // Phase 5: Clear force accumulators
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      body.force.set(0, 0);
      body.torque = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Event forwarding (delegates to CollisionSystem)
  // ---------------------------------------------------------------------------

  /** Register a listener for beginContact events. Returns unsubscribe function. */
  onBeginContact(listener: ContactListener): () => void {
    return this.collisionSystem.onBeginContact(listener);
  }

  /** Register a listener for endContact events. Returns unsubscribe function. */
  onEndContact(listener: ContactListener): () => void {
    return this.collisionSystem.onEndContact(listener);
  }

  // ---------------------------------------------------------------------------
  // Pair exclusion forwarding (for Phase 4 joints)
  // ---------------------------------------------------------------------------

  /** Exclude a body pair from collision detection (used by joints). */
  addPairExclusion(idA: number, idB: number): void {
    this.collisionSystem.addPairExclusion(idA, idB);
  }

  /** Remove a pair exclusion, re-enabling collision detection for that pair. */
  removePairExclusion(idA: number, idB: number): void {
    this.collisionSystem.removePairExclusion(idA, idB);
  }
}
