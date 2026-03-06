import { type Body } from '../dynamics/Body.js';
import { type AABB } from '../math/AABB.js';

/**
 * Broadphase interface for spatial acceleration of collision detection.
 *
 * Implementations insert bodies by their AABBs and return candidate pairs
 * that may be colliding. The narrowphase then tests each pair for actual contact.
 *
 * Built-in implementations:
 * - {@link SpatialHash}: grid-based, good for uniform body sizes
 *
 * Future candidates: dynamic AABB tree, sweep-and-prune.
 */
export interface Broadphase {
  /** Remove all bodies from the structure. Called once per frame before re-insertion. */
  clear(): void;

  /** Insert a body into the broadphase with its world-space AABB. */
  insert(body: Body, aabb: AABB): void;

  /**
   * Return all unique candidate pairs that pass the given filter.
   * @param filter Predicate to test each pair (e.g. collision filter + pair exclusions).
   */
  queryPairs(filter: (a: Body, b: Body) => boolean): Array<[Body, Body]>;

  /**
   * Query all bodies whose AABB overlaps the given AABB.
   * Used for spatial queries (point, region, raycast).
   */
  queryAABB(aabb: AABB): Body[];
}
