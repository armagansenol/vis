import { Body } from '../dynamics/Body.js';
import { type Manifold } from './Manifold.js';
import { pairKey } from './Manifold.js';
import { type Broadphase } from './Broadphase.js';
import { SpatialHash } from './SpatialHash.js';
import { shouldCollide } from './CollisionFilter.js';
import { detectNarrowphase } from './narrowphase.js';
import { ManifoldMap } from './ManifoldMap.js';
import {
  EventDispatcher,
  type ContactEvent,
  type ContactListener,
} from '../events/EventDispatcher.js';

/**
 * Configuration options for the collision system.
 */
export interface CollisionSystemOptions {
  /** Cell size for the spatial hash broadphase. Default: 2. */
  cellSize?: number;
  /** Custom broadphase implementation. Default: SpatialHash. */
  broadphase?: Broadphase;
}

/**
 * Full collision pipeline orchestrator.
 *
 * Runs broadphase -> narrowphase -> manifold persistence -> event dispatch
 * in a single `detect(bodies)` call. Returns active manifolds for the solver.
 *
 * The broadphase is pluggable via the {@link Broadphase} interface.
 * Default: {@link SpatialHash}.
 */
export class CollisionSystem {
  readonly broadphase: Broadphase;
  private readonly manifoldMap: ManifoldMap;
  private readonly eventDispatcher: EventDispatcher;
  private readonly pairExclusions: Set<string>;

  constructor(options?: CollisionSystemOptions) {
    this.broadphase = options?.broadphase ?? new SpatialHash(options?.cellSize);
    this.manifoldMap = new ManifoldMap();
    this.eventDispatcher = new EventDispatcher();
    this.pairExclusions = new Set();
  }

  /**
   * Run the full collision detection pipeline.
   *
   * 1. Clear and populate spatial hash
   * 2. Query candidate pairs with collision filter
   * 3. Filter out excluded pairs
   * 4. Run narrowphase on each candidate pair
   * 5. Update manifold map (begin/end detection + warm-start)
   * 6. Fire contact events
   * 7. Return active manifolds
   *
   * @param bodies All bodies in the simulation.
   * @returns Active manifolds for solver consumption.
   */
  detect(bodies: Body[]): Manifold[] {
    // Step 1: Clear and populate broadphase
    const bp = this.broadphase;
    bp.clear();
    for (const body of bodies) {
      const aabb = body.shape.computeAABB(body.position, body.angle);
      bp.insert(body, aabb);
    }

    // Step 2-3: Query candidate pairs with filter + exclusions
    const exclusions = this.pairExclusions;
    const pairs = bp.queryPairs((a, b) => {
      if (!shouldCollide(a, b)) return false;
      if (exclusions.size > 0 && exclusions.has(pairKey(a.id, b.id))) return false;
      return true;
    });

    // Step 4: Narrowphase
    const newManifolds: Manifold[] = [];
    for (const [a, b] of pairs) {
      const manifold = detectNarrowphase(a, b);
      if (manifold !== null) {
        newManifolds.push(manifold);
      }
    }

    // Step 5: Update manifold map
    const { began, ended, active } = this.manifoldMap.update(newManifolds);

    // Step 6: Fire events
    for (const m of began) {
      const event: ContactEvent = {
        bodyA: m.bodyA,
        bodyB: m.bodyB,
        manifold: m,
        isSensor: m.isSensor,
      };
      this.eventDispatcher.emit('begin', event);
    }

    for (const m of ended) {
      const event: ContactEvent = {
        bodyA: m.bodyA,
        bodyB: m.bodyB,
        manifold: m,
        isSensor: m.isSensor,
      };
      this.eventDispatcher.emit('end', event);
    }

    // Step 7: Return active manifolds
    return active;
  }

  /**
   * Register a listener for beginContact events.
   * @returns Unsubscribe function.
   */
  onBeginContact(listener: ContactListener): () => void {
    return this.eventDispatcher.onBeginContact(listener);
  }

  /**
   * Register a listener for endContact events.
   * @returns Unsubscribe function.
   */
  onEndContact(listener: ContactListener): () => void {
    return this.eventDispatcher.onEndContact(listener);
  }

  /**
   * Exclude a specific body pair from collision detection.
   * Used by joint systems to prevent jointed bodies from colliding.
   */
  addPairExclusion(idA: number, idB: number): void {
    this.pairExclusions.add(pairKey(idA, idB));
  }

  /**
   * Remove a pair exclusion, re-enabling collision for that pair.
   */
  removePairExclusion(idA: number, idB: number): void {
    this.pairExclusions.delete(pairKey(idA, idB));
  }
}
