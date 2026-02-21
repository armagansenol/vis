import { type Manifold } from './Manifold.js';
import { pairKey } from './Manifold.js';

/**
 * Result of updating the manifold map with new frame data.
 */
export interface ManifoldUpdateResult {
  /** Manifolds for pairs that just started colliding this frame. */
  began: Manifold[];
  /** Manifolds for pairs that stopped colliding this frame (from old map). */
  ended: Manifold[];
  /** All currently active manifolds (the new map contents). */
  active: Manifold[];
}

/**
 * Pair-keyed manifold cache with begin/end detection and warm-start transfer.
 *
 * Stores manifolds keyed by canonical body pair ID. Each frame, the collision
 * system provides new manifolds and the map determines which pairs began,
 * ended, or persisted. For persisting pairs, cached impulse values are
 * transferred from old contacts to new contacts matched by feature ID.
 */
export class ManifoldMap {
  private manifolds: Map<string, Manifold> = new Map();

  /**
   * Update the cache with this frame's manifolds.
   *
   * @param newManifolds All manifolds detected this frame.
   * @returns began/ended/active classification for event dispatch.
   */
  update(newManifolds: Manifold[]): ManifoldUpdateResult {
    // Build new map
    const newMap = new Map<string, Manifold>();
    for (const m of newManifolds) {
      const key = pairKey(m.bodyA.id, m.bodyB.id);
      newMap.set(key, m);
    }

    // Began: in new but not in old
    const began: Manifold[] = [];
    for (const [key, m] of newMap) {
      if (!this.manifolds.has(key)) {
        began.push(m);
      }
    }

    // Ended: in old but not in new
    const ended: Manifold[] = [];
    for (const [key, m] of this.manifolds) {
      if (!newMap.has(key)) {
        ended.push(m);
      }
    }

    // Warm-start transfer: for pairs in both maps, copy impulses by feature ID
    for (const [key, newManifold] of newMap) {
      const oldManifold = this.manifolds.get(key);
      if (oldManifold === undefined) continue;

      for (const newContact of newManifold.contacts) {
        for (const oldContact of oldManifold.contacts) {
          if (newContact.id === oldContact.id) {
            newContact.normalImpulse = oldContact.normalImpulse;
            newContact.tangentImpulse = oldContact.tangentImpulse;
            break;
          }
        }
      }
    }

    // Replace old map with new
    this.manifolds = newMap;

    return {
      began,
      ended,
      active: Array.from(newMap.values()),
    };
  }

  /** Clear all cached manifolds. */
  clear(): void {
    this.manifolds.clear();
  }
}
