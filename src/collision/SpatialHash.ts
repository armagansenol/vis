import { Body } from '../dynamics/Body.js';
import { AABB } from '../math/AABB.js';
import { type Broadphase } from './Broadphase.js';

/**
 * Spatial hash grid broadphase implementation.
 *
 * Bodies are inserted into grid cells based on their AABB. Overlapping
 * candidate pairs are collected by finding bodies that share at least one cell.
 * Pairs are deduplicated using body IDs and filtered via a user-supplied
 * predicate (typically {@link shouldCollide}).
 *
 * Best suited for simulations where bodies are roughly similar in size.
 * For large variation in body sizes, consider a dynamic AABB tree instead.
 *
 * Hot-path optimized: uses numeric pair keys instead of strings, pools cell
 * arrays across frames, and reuses the pair dedup set.
 */
export class SpatialHash implements Broadphase {
  readonly cellSize: number;
  private readonly invCellSize: number;
  private readonly cells: Map<number, Body[]>;
  /** Pool of cell arrays to avoid re-allocating every frame. */
  private readonly cellPool: Body[][] = [];
  /** Reusable set for pair deduplication (numeric keys). */
  private readonly pairSeen: Set<number> = new Set();
  /** Reusable set for queryAABB body deduplication. */
  private readonly querySeen: Set<number> = new Set();

  constructor(cellSize: number = 2) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
  }

  /** Remove all bodies from the grid. Call before re-inserting each frame. */
  clear(): void {
    // Return cell arrays to pool instead of discarding
    for (const cell of this.cells.values()) {
      cell.length = 0;
      this.cellPool.push(cell);
    }
    this.cells.clear();
  }

  /**
   * Insert a body into the grid using its world-space AABB.
   *
   * The body is added to every cell its AABB overlaps.
   */
  insert(body: Body, aabb: AABB): void {
    const minCx = Math.floor(aabb.min.x * this.invCellSize);
    const minCy = Math.floor(aabb.min.y * this.invCellSize);
    const maxCx = Math.floor(aabb.max.x * this.invCellSize);
    const maxCy = Math.floor(aabb.max.y * this.invCellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = ((cx * 92837111) ^ (cy * 689287499)) | 0;
        let cell = this.cells.get(key);
        if (cell === undefined) {
          cell = this.cellPool.length > 0 ? this.cellPool.pop()! : [];
          this.cells.set(key, cell);
        }
        cell.push(body);
      }
    }
  }

  /**
   * Collect all unique candidate pairs that pass the given filter.
   *
   * Uses numeric Szudzik pairing for O(1) deduplication instead of string keys.
   *
   * @param filter Predicate to test each candidate pair (e.g. shouldCollide).
   * @returns Array of body pairs that share at least one cell and pass the filter.
   */
  queryPairs(filter: (a: Body, b: Body) => boolean): Array<[Body, Body]> {
    const seen = this.pairSeen;
    seen.clear();
    const pairs: Array<[Body, Body]> = [];

    for (const cell of this.cells.values()) {
      const len = cell.length;
      if (len < 2) continue;

      for (let i = 0; i < len; i++) {
        for (let j = i + 1; j < len; j++) {
          const a = cell[i];
          const b = cell[j];

          // Skip self-pairs (same body inserted in multiple cells via hash collision)
          if (a.id === b.id) continue;

          // Deduplicate: Szudzik pairing function on ordered IDs
          const lo = a.id < b.id ? a.id : b.id;
          const hi = a.id < b.id ? b.id : a.id;
          // Szudzik's elegant pairing: unique for all (lo, hi) where lo <= hi
          const pairId = hi * hi + lo;

          if (seen.has(pairId)) continue;
          seen.add(pairId);

          if (filter(a, b)) {
            pairs.push([a, b]);
          }
        }
      }
    }

    return pairs;
  }

  /**
   * Query all bodies whose AABB overlaps the given query AABB.
   * Walks only the cells that the query AABB covers.
   */
  queryAABB(aabb: AABB): Body[] {
    const minCx = Math.floor(aabb.min.x * this.invCellSize);
    const minCy = Math.floor(aabb.min.y * this.invCellSize);
    const maxCx = Math.floor(aabb.max.x * this.invCellSize);
    const maxCy = Math.floor(aabb.max.y * this.invCellSize);

    const seen = this.querySeen;
    seen.clear();
    const results: Body[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = ((cx * 92837111) ^ (cy * 689287499)) | 0;
        const cell = this.cells.get(key);
        if (cell === undefined) continue;

        for (let i = 0; i < cell.length; i++) {
          const body = cell[i];
          if (seen.has(body.id)) continue;
          seen.add(body.id);
          // Fine-grained AABB overlap check against body's actual AABB
          const bodyAABB = body.shape.computeAABB(body.position, body.angle);
          if (bodyAABB.overlaps(aabb)) {
            results.push(body);
          }
        }
      }
    }

    return results;
  }
}
