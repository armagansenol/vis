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
 *
 * Hot-path optimized: swaps two maps instead of creating a new one each frame,
 * and reuses result arrays.
 */
export class ManifoldMap {
  private current: Map<string, Manifold> = new Map();
  private previous: Map<string, Manifold> = new Map();

  // Reusable result arrays — cleared each frame, avoids allocation
  private readonly _began: Manifold[] = [];
  private readonly _ended: Manifold[] = [];
  private readonly _active: Manifold[] = [];

  /**
   * Update the cache with this frame's manifolds.
   *
   * @param newManifolds All manifolds detected this frame.
   * @returns began/ended/active classification for event dispatch.
   */
  update(newManifolds: Manifold[]): ManifoldUpdateResult {
    // Swap maps: previous becomes the old frame, current will be rebuilt
    const temp = this.previous;
    this.previous = this.current;
    this.current = temp;
    this.current.clear();

    const began = this._began;
    const ended = this._ended;
    const active = this._active;
    began.length = 0;
    ended.length = 0;
    active.length = 0;

    // Build new map
    for (let i = 0; i < newManifolds.length; i++) {
      const m = newManifolds[i];
      const key = pairKey(m.bodyA.id, m.bodyB.id);
      this.current.set(key, m);
    }

    // Began: in current but not in previous
    for (const [key, m] of this.current) {
      if (!this.previous.has(key)) {
        began.push(m);
      }
    }

    // Ended: in previous but not in current
    for (const [key, m] of this.previous) {
      if (!this.current.has(key)) {
        ended.push(m);
      }
    }

    // Warm-start transfer: for pairs in both maps, copy impulses by feature ID
    for (const [key, newManifold] of this.current) {
      const oldManifold = this.previous.get(key);
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

    // Build active list from current map values
    for (const m of this.current.values()) {
      active.push(m);
    }

    return { began, ended, active };
  }

  /** Clear all cached manifolds. */
  clear(): void {
    this.current.clear();
    this.previous.clear();
  }
}
