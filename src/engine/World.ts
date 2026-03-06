import { Vec2 } from '../math/Vec2.js';
import { AABB } from '../math/AABB.js';
import { Body } from '../dynamics/Body.js';
import { BodyType } from '../dynamics/BodyType.js';
import { ShapeType } from '../shapes/Shape.js';
import { type Circle } from '../shapes/Circle.js';
import { type Polygon } from '../shapes/Polygon.js';
import { CollisionSystem } from '../collision/CollisionSystem.js';
import { type Constraint } from '../constraints/Constraint.js';
import { type ContactListener } from '../events/EventDispatcher.js';
import { type Manifold } from '../collision/Manifold.js';
import { ContactSolver } from '../solver/ContactSolver.js';
import { computeTOI } from '../collision/ccd.js';
import { detectNarrowphase } from '../collision/narrowphase.js';
import { DEFAULT_WORLD_SETTINGS, type WorldSettings } from './WorldSettings.js';

/**
 * Result of a point query — identifies which body contains the point.
 */
export interface PointQueryResult {
  body: Body;
  point: Vec2;
}

/**
 * Result of a raycast query.
 */
export interface RaycastResult {
  /** The body hit by the ray. */
  body: Body;
  /** World-space hit point. */
  point: Vec2;
  /** Surface normal at the hit point (pointing outward from the body). */
  normal: Vec2;
  /** Parametric fraction along the ray [0, 1]. */
  fraction: number;
}

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
      positionIterations: this.settings.positionIterations,
      baumgarteFactor: this.settings.baumgarteFactor,
      penetrationSlop: this.settings.penetrationSlop,
      restitutionSlop: this.settings.restitutionSlop,
      maxLinearCorrection: 0.2,
      positionCorrectionFactor: 0.2,
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
   * 6. Update sleep state
   */
  private singleStep(dt: number): void {
    const { gravity, velocityIterations } = this.settings;
    const bodies = this.bodies;

    // Phase 0: Save previous state for render interpolation (skip static/sleeping bodies)
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (body.type === BodyType.Static || body.isSleeping) continue;
      body.prevPosition.x = body.position.x;
      body.prevPosition.y = body.position.y;
      body.prevAngle = body.angle;
    }

    // Phase 1: Integrate velocities only (Dynamic bodies get gravity + forces)
    const maxTranslation = this.settings.maxTranslation;
    const maxSpeed = maxTranslation / dt;
    const maxSpeedSq = maxSpeed * maxSpeed;

    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (body.type !== BodyType.Dynamic || body.isSleeping) continue;

      body.velocity.x += (body.force.x * body.invMass + gravity.x * body.gravityScale) * dt;
      body.velocity.y += (body.force.y * body.invMass + gravity.y * body.gravityScale) * dt;
      body.angularVelocity += body.torque * body.invInertia * dt;

      // Clamp velocity to prevent tunneling through thin objects (non-bullet bodies)
      if (!body.isBullet) {
        const speedSq = body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y;
        if (speedSq > maxSpeedSq) {
          const scale = maxSpeed / Math.sqrt(speedSq);
          body.velocity.x *= scale;
          body.velocity.y *= scale;
        }
      }
    }

    // Phase 2: Detect collisions
    const manifolds = this.collisionSystem.detect(bodies);
    this.latestManifolds = manifolds;

    // Phase 2.5: Wake bodies on contact with awake bodies.
    // If a sleeping body is touching an awake body, the sleeping body must wake
    // so the solver can apply correct impulses on both sides of the contact.
    if (this.settings.allowSleeping) {
      for (let i = 0; i < manifolds.length; i++) {
        const m = manifolds[i];
        const a = m.bodyA;
        const b = m.bodyB;
        if (a.isSleeping && !b.isSleeping && b.type === BodyType.Dynamic) {
          a.wake();
        } else if (b.isSleeping && !a.isSleeping && a.type === BodyType.Dynamic) {
          b.wake();
        }
      }
    }

    // Phase 3: Solve constraints (contacts + joints interleaved)
    this.solver.preStep(manifolds, dt);
    for (let i = 0; i < this.constraints.length; i++) {
      // Wake bodies connected by constraints if either is awake
      const c = this.constraints[i];
      if (this.settings.allowSleeping) {
        const aAsleep = c.bodyA.isSleeping;
        const bAsleep = c.bodyB.isSleeping;
        if (aAsleep && !bAsleep && c.bodyB.type === BodyType.Dynamic) {
          c.bodyA.wake();
        } else if (bAsleep && !aAsleep && c.bodyA.type === BodyType.Dynamic) {
          c.bodyB.wake();
        }
      }
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
      if (body.type === BodyType.Static || body.isSleeping) continue;
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.angle += body.angularVelocity * dt;
    }

    // Phase 4.5: CCD for bullet bodies — rewind to TOI to prevent tunneling
    this.solveBulletCCD(dt);

    // Phase 4.6: Position correction (NGS-style linear projection)
    const posIter = this.settings.positionIterations;
    for (let iter = 0; iter < posIter; iter++) {
      if (this.solver.solvePositions()) break;
    }

    // Phase 5: Clear force accumulators
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      body.force.set(0, 0);
      body.torque = 0;
    }

    // Phase 6: Update sleep state for dynamic bodies
    if (this.settings.allowSleeping) {
      const linThreshSq = this.settings.sleepLinearThreshold * this.settings.sleepLinearThreshold;
      const angThresh = this.settings.sleepAngularThreshold;
      const timeThresh = this.settings.sleepTimeThreshold;

      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (body.type !== BodyType.Dynamic || !body.allowSleep) continue;

        const speedSq = body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y;
        const angSpeed = Math.abs(body.angularVelocity);

        if (speedSq > linThreshSq || angSpeed > angThresh) {
          // Motion above threshold — reset timer and wake if sleeping
          body.sleepTimer = 0;
          if (body.isSleeping) {
            body.wake();
          }
        } else {
          // Motion below threshold — accumulate rest time
          body.sleepTimer += dt;
          if (!body.isSleeping && body.sleepTimer >= timeThresh) {
            body.sleep();
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // CCD (Continuous Collision Detection) for bullet bodies
  // ---------------------------------------------------------------------------

  /**
   * For each bullet body, check against all other bodies for tunneling.
   * If TOI < 1, rewind the bullet to the TOI position and run a discrete
   * collision check + response at that point.
   *
   * This runs after position integration so we can detect if the bullet
   * has passed through another body during this step. The bullet's pre-step
   * position is stored in prevPosition.
   */
  private solveBulletCCD(dt: number): void {
    const bodies = this.bodies;

    for (let i = 0; i < bodies.length; i++) {
      const bullet = bodies[i];
      if (!bullet.isBullet || bullet.type !== BodyType.Dynamic || bullet.isSleeping) continue;

      // Use prevPosition as start, current position as end
      // Compute displacement this step
      const dispX = bullet.position.x - bullet.prevPosition.x;
      const dispY = bullet.position.y - bullet.prevPosition.y;
      const dispSq = dispX * dispX + dispY * dispY;

      // Skip CCD if displacement is small (no risk of tunneling)
      if (dispSq < 0.01) continue;

      // Save current state
      const savedX = bullet.position.x;
      const savedY = bullet.position.y;
      const savedAngle = bullet.angle;

      // Rewind to start of step for TOI computation
      bullet.position.x = bullet.prevPosition.x;
      bullet.position.y = bullet.prevPosition.y;
      bullet.angle = bullet.prevAngle;

      let minTOI = 1;
      let toiBody: Body | null = null;

      // Test against all other bodies
      for (let j = 0; j < bodies.length; j++) {
        if (i === j) continue;
        const other = bodies[j];
        if (other.isSleeping && other.type === BodyType.Dynamic) continue;

        const result = computeTOI(bullet, other, dt);
        if (result.hit && result.toi < minTOI) {
          minTOI = result.toi;
          toiBody = other;
        }
      }

      if (toiBody !== null && minTOI < 1) {
        // Advance bullet to TOI position
        bullet.position.x = bullet.prevPosition.x + dispX * minTOI;
        bullet.position.y = bullet.prevPosition.y + dispY * minTOI;
        bullet.angle = bullet.prevAngle + (savedAngle - bullet.prevAngle) * minTOI;

        // Run discrete narrowphase at TOI position
        const manifold = detectNarrowphase(bullet, toiBody);
        if (manifold !== null && !manifold.isSensor) {
          // Apply simple collision response: reflect velocity along normal
          const nx = manifold.normal.x;
          const ny = manifold.normal.y;
          const vDotN = bullet.velocity.x * nx + bullet.velocity.y * ny;

          if (vDotN < 0) {
            // Impulse-based response using restitution
            const e = manifold.restitution;
            const j = -(1 + e) * vDotN;
            const totalInvMass = bullet.invMass + toiBody.invMass;
            if (totalInvMass > 0) {
              const impulse = j / totalInvMass;
              bullet.velocity.x += nx * impulse * bullet.invMass;
              bullet.velocity.y += ny * impulse * bullet.invMass;
              toiBody.velocity.x -= nx * impulse * toiBody.invMass;
              toiBody.velocity.y -= ny * impulse * toiBody.invMass;

              // Wake the other body
              if (toiBody.type === BodyType.Dynamic) {
                toiBody.wake();
              }
            }
          }

          // Advance remaining time
          const remaining = 1 - minTOI;
          bullet.position.x += bullet.velocity.x * dt * remaining;
          bullet.position.y += bullet.velocity.y * dt * remaining;
        } else {
          // No collision at TOI — restore original position
          bullet.position.x = savedX;
          bullet.position.y = savedY;
          bullet.angle = savedAngle;
        }
      } else {
        // No TOI hit — restore original position
        bullet.position.x = savedX;
        bullet.position.y = savedY;
        bullet.angle = savedAngle;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Query API
  // ---------------------------------------------------------------------------

  /**
   * Find all bodies that contain the given world-space point.
   * Tests actual shape geometry, not just AABBs.
   */
  queryPoint(point: Vec2): PointQueryResult[] {
    // Build a tiny AABB around the point for broadphase filtering
    const eps = 0.001;
    const queryAABB = new AABB(
      new Vec2(point.x - eps, point.y - eps),
      new Vec2(point.x + eps, point.y + eps),
    );

    const candidates = this.collisionSystem.broadphase.queryAABB(queryAABB);
    const results: PointQueryResult[] = [];

    for (let i = 0; i < candidates.length; i++) {
      if (testPointInBody(candidates[i], point)) {
        results.push({ body: candidates[i], point: point.clone() });
      }
    }

    return results;
  }

  /**
   * Find all bodies whose shape overlaps the given AABB.
   * Uses broadphase for acceleration, then tests actual AABBs.
   */
  queryAABB(aabb: AABB): Body[] {
    return this.collisionSystem.broadphase.queryAABB(aabb);
  }

  /**
   * Cast a ray and return all hits sorted by fraction (nearest first).
   *
   * @param origin Ray start point (world space).
   * @param direction Ray direction (does not need to be normalized).
   * @param maxDistance Maximum ray length. Default: 1000.
   * @returns Array of hits sorted by fraction.
   */
  raycast(origin: Vec2, direction: Vec2, maxDistance: number = 1000): RaycastResult[] {
    // Normalize direction
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (len < 1e-10) return [];
    const dx = direction.x / len;
    const dy = direction.y / len;

    // Build AABB enclosing the full ray for broadphase query
    const endX = origin.x + dx * maxDistance;
    const endY = origin.y + dy * maxDistance;
    const rayAABB = new AABB(
      new Vec2(Math.min(origin.x, endX), Math.min(origin.y, endY)),
      new Vec2(Math.max(origin.x, endX), Math.max(origin.y, endY)),
    );

    const candidates = this.collisionSystem.broadphase.queryAABB(rayAABB);
    const results: RaycastResult[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const hit = raycastBody(candidates[i], origin, dx, dy, maxDistance);
      if (hit !== null) {
        results.push(hit);
      }
    }

    // Sort by fraction (nearest first)
    results.sort((a, b) => a.fraction - b.fraction);
    return results;
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

// ---------------------------------------------------------------------------
// Query helpers (module-private)
// ---------------------------------------------------------------------------

/** Test if a world-space point is inside a body's shape. Uses inline rotation. */
function testPointInBody(body: Body, point: Vec2): boolean {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);

  if (body.shape.type === ShapeType.Circle) {
    const circle = body.shape as Circle;
    const ox = circle.offset.x;
    const oy = circle.offset.y;
    const cx = body.position.x + (cos * ox - sin * oy);
    const cy = body.position.y + (sin * ox + cos * oy);
    const dx = point.x - cx;
    const dy = point.y - cy;
    return dx * dx + dy * dy <= circle.radius * circle.radius;
  }

  if (body.shape.type === ShapeType.Polygon) {
    const polygon = body.shape as Polygon;
    const lpx = point.x - body.position.x;
    const lpy = point.y - body.position.y;
    // Inverse rotation (transpose): [cos, sin; -sin, cos]
    const localX = cos * lpx + sin * lpy - polygon.offset.x;
    const localY = -sin * lpx + cos * lpy - polygon.offset.y;

    const verts = polygon.vertices;
    const normals = polygon.normals;
    for (let i = 0; i < normals.length; i++) {
      const sep = normals[i].x * (localX - verts[i].x) + normals[i].y * (localY - verts[i].y);
      if (sep > 0) return false;
    }
    return true;
  }

  return false;
}

/** Raycast against a single body. Returns hit info or null. Uses inline rotation. */
function raycastBody(
  body: Body,
  origin: Vec2,
  dx: number,
  dy: number,
  maxDist: number,
): RaycastResult | null {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);

  if (body.shape.type === ShapeType.Circle) {
    const circle = body.shape as Circle;
    const ox = circle.offset.x;
    const oy = circle.offset.y;
    const cx = body.position.x + (cos * ox - sin * oy);
    const cy = body.position.y + (sin * ox + cos * oy);

    const ocx = origin.x - cx;
    const ocy = origin.y - cy;
    const b = ocx * dx + ocy * dy;
    const c = ocx * ocx + ocy * ocy - circle.radius * circle.radius;
    const disc = b * b - c;
    if (disc < 0) return null;

    const sqrtDisc = Math.sqrt(disc);
    let t = -b - sqrtDisc;
    if (t < 0) t = -b + sqrtDisc;
    if (t < 0 || t > maxDist) return null;

    const hitX = origin.x + dx * t;
    const hitY = origin.y + dy * t;
    const nx = hitX - cx;
    const ny = hitY - cy;
    const nlen = Math.sqrt(nx * nx + ny * ny);

    return {
      body,
      point: new Vec2(hitX, hitY),
      normal: nlen > 1e-10 ? new Vec2(nx / nlen, ny / nlen) : new Vec2(dx, dy),
      fraction: t / maxDist,
    };
  }

  if (body.shape.type === ShapeType.Polygon) {
    const polygon = body.shape as Polygon;

    // Transform ray into polygon local space using inline inverse rotation
    const lpx = origin.x - body.position.x;
    const lpy = origin.y - body.position.y;
    const localOx = cos * lpx + sin * lpy - polygon.offset.x;
    const localOy = -sin * lpx + cos * lpy - polygon.offset.y;
    const localDx = cos * dx + sin * dy;
    const localDy = -sin * dx + cos * dy;

    const verts = polygon.vertices;
    const normals = polygon.normals;
    let tEnter = -Infinity;
    let tExit = Infinity;
    let enterNormalIdx = 0;

    for (let i = 0; i < normals.length; i++) {
      const nx = normals[i].x;
      const ny = normals[i].y;
      const dist = nx * (localOx - verts[i].x) + ny * (localOy - verts[i].y);
      const denom = nx * localDx + ny * localDy;

      if (Math.abs(denom) < 1e-10) {
        if (dist > 0) return null;
        continue;
      }

      const t = -dist / denom;
      if (denom < 0) {
        if (t > tEnter) { tEnter = t; enterNormalIdx = i; }
      } else {
        if (t < tExit) { tExit = t; }
      }

      if (tEnter > tExit) return null;
    }

    if (tEnter < 0 || tEnter > maxDist) return null;

    const hitX = origin.x + dx * tEnter;
    const hitY = origin.y + dy * tEnter;
    // Transform normal back to world space
    const ln = normals[enterNormalIdx];
    const wnx = cos * ln.x - sin * ln.y;
    const wny = sin * ln.x + cos * ln.y;

    return {
      body,
      point: new Vec2(hitX, hitY),
      normal: new Vec2(wnx, wny),
      fraction: tEnter / maxDist,
    };
  }

  return null;
}
