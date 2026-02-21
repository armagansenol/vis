import { Body } from '../dynamics/Body.js';
import { AABB } from '../math/AABB.js';

/**
 * Spatial hash grid for broadphase collision detection.
 *
 * Bodies are inserted into grid cells based on their AABB. Overlapping
 * candidate pairs are collected by finding bodies that share at least one cell.
 * Pairs are deduplicated using body IDs and filtered via a user-supplied
 * predicate (typically {@link shouldCollide}).
 */
export class SpatialHash {
  readonly cellSize: number;
  private readonly invCellSize: number;
  private readonly cells: Map<number, Body[]>;

  constructor(cellSize: number = 2) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
  }

  /** Remove all bodies from the grid. Call before re-inserting each frame. */
  clear(): void {
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
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(body);
      }
    }
  }

  /**
   * Collect all unique candidate pairs that pass the given filter.
   *
   * @param filter Predicate to test each candidate pair (e.g. shouldCollide).
   * @returns Array of body pairs that share at least one cell and pass the filter.
   */
  queryPairs(filter: (a: Body, b: Body) => boolean): Array<[Body, Body]> {
    const seen = new Set<string>();
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

          // Deduplicate: use ordered ID pair as key
          const lo = a.id < b.id ? a.id : b.id;
          const hi = a.id < b.id ? b.id : a.id;
          const pairKey = `${lo}:${hi}`;

          if (seen.has(pairKey)) continue;
          seen.add(pairKey);

          if (filter(a, b)) {
            pairs.push([a, b]);
          }
        }
      }
    }

    return pairs;
  }
}
