import { type Body } from '../dynamics/Body.js';
import { BodyType } from '../dynamics/BodyType.js';
import { type Manifold } from '../collision/Manifold.js';
import { type Constraint } from '../constraints/Constraint.js';

/**
 * An island is a connected group of awake bodies, their contacts, and
 * their constraints. Islands are built each step so that:
 *
 * 1. Sleeping bodies can be skipped entirely
 * 2. The solver processes each island independently
 * 3. Sleep decisions can be made per-island (all bodies in an island
 *    sleep together when the whole island is at rest)
 *
 * This is groundwork — the current solver still processes all manifolds
 * together. The island structure enables future per-island solving and
 * more accurate group sleeping.
 */
export interface Island {
  /** Dynamic/kinematic bodies in this island. */
  bodies: Body[];
  /** Contact manifolds between bodies in this island. */
  contacts: Manifold[];
  /** Constraints (joints) connecting bodies in this island. */
  constraints: Constraint[];
}

/**
 * Build islands from awake bodies by flood-filling through contacts
 * and constraints.
 *
 * Static bodies are never added to islands (they act as "walls" connecting
 * islands but don't belong to any single island). A static body touching
 * two dynamic bodies causes those dynamics to be in the same island.
 *
 * @param bodies All bodies in the world
 * @param manifolds Active contact manifolds this step
 * @param constraints Active constraints this step
 * @returns Array of islands, each containing connected awake components
 */
export function buildIslands(
  bodies: Body[],
  manifolds: readonly Manifold[],
  constraints: readonly Constraint[],
): Island[] {
  const islands: Island[] = [];

  // Track which bodies have been assigned to an island
  // Using a Set of body IDs for O(1) lookup
  const visited = new Set<number>();

  // Build adjacency: for each body, which manifolds and constraints touch it
  const bodyManifolds = new Map<number, Manifold[]>();
  const bodyConstraints = new Map<number, Constraint[]>();

  for (let i = 0; i < manifolds.length; i++) {
    const m = manifolds[i];
    if (m.isSensor) continue;
    addToMapList(bodyManifolds, m.bodyA.id, m);
    addToMapList(bodyManifolds, m.bodyB.id, m);
  }

  for (let i = 0; i < constraints.length; i++) {
    const c = constraints[i];
    addToMapList(bodyConstraints, c.bodyA.id, c);
    addToMapList(bodyConstraints, c.bodyB.id, c);
  }

  // Flood-fill from each unvisited awake dynamic body
  const stack: Body[] = [];

  for (let i = 0; i < bodies.length; i++) {
    const seed = bodies[i];

    // Skip static bodies (they don't seed islands)
    if (seed.type === BodyType.Static) continue;
    // Skip sleeping bodies
    if (seed.isSleeping) continue;
    // Skip already-visited bodies
    if (visited.has(seed.id)) continue;

    // Start a new island
    const island: Island = {
      bodies: [],
      contacts: [],
      constraints: [],
    };

    // Track which manifolds/constraints are already in this island
    const islandManifolds = new Set<Manifold>();
    const islandConstraints = new Set<Constraint>();

    stack.length = 0;
    stack.push(seed);
    visited.add(seed.id);

    while (stack.length > 0) {
      const body = stack.pop()!;
      island.bodies.push(body);

      // Traverse contacts
      const bm = bodyManifolds.get(body.id);
      if (bm !== undefined) {
        for (let j = 0; j < bm.length; j++) {
          const m = bm[j];
          if (islandManifolds.has(m)) continue;
          islandManifolds.add(m);
          island.contacts.push(m);

          // Follow the edge to the other body
          const other = m.bodyA.id === body.id ? m.bodyB : m.bodyA;
          if (other.type === BodyType.Static) continue; // Don't cross into statics
          if (visited.has(other.id)) continue;
          visited.add(other.id);
          stack.push(other);
        }
      }

      // Traverse constraints
      const bc = bodyConstraints.get(body.id);
      if (bc !== undefined) {
        for (let j = 0; j < bc.length; j++) {
          const c = bc[j];
          if (islandConstraints.has(c)) continue;
          islandConstraints.add(c);
          island.constraints.push(c);

          const other = c.bodyA.id === body.id ? c.bodyB : c.bodyA;
          if (other.type === BodyType.Static) continue;
          if (visited.has(other.id)) continue;
          visited.add(other.id);
          stack.push(other);
        }
      }
    }

    if (island.bodies.length > 0) {
      islands.push(island);
    }
  }

  return islands;
}

/** Helper to append a value to a Map<K, V[]>. */
function addToMapList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  let list = map.get(key);
  if (list === undefined) {
    list = [];
    map.set(key, list);
  }
  list.push(value);
}
