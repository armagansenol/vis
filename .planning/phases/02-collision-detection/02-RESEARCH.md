# Phase 2: Collision Detection - Research

**Researched:** 2026-02-21
**Domain:** 2D rigid body collision detection (broadphase, narrowphase, manifolds, events)
**Confidence:** HIGH

## Summary

Phase 2 builds the complete collision detection pipeline for a 2D rigid body physics engine targeting < 500 bodies. The pipeline consists of four stages: (1) spatial hash broadphase to cull non-overlapping pairs, (2) SAT narrowphase for polygon-polygon and circle-polygon detection, (3) contact manifold generation with frame-to-frame persistence, and (4) an event system for beginContact/endContact notifications. All collision math is hand-written (no external libraries) -- this is a from-scratch engine.

The existing Phase 1 foundation provides strong building blocks: `AABB.overlaps()`, `Polygon.normals` (precomputed outward-facing edge normals), `Polygon.support()` (max-dot vertex finder), `Circle` with radius and offset, `Body` with position/angle/shape, and `ShapeType` enum for dispatch. The Body class currently lacks an `id` field, which must be added for pair identification and manifold caching.

**Primary recommendation:** Build the pipeline bottom-up -- spatial hash first, then narrowphase dispatch + SAT + circle tests, then manifold manager with pair caching, then event system on top. Keep all collision code pure (no mutation of body state) so Phase 3 solver can consume contact data cleanly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Target body count: hundreds (< 500) -- broadphase can be simple and correct over hyper-optimized
- Up to 2 contact points per manifold -- handles edge-edge and flat-on-flat contacts for stable 2D stacking
- Sensor bodies supported -- bodies with a sensor flag detect overlap and fire events but produce no collision response

### Claude's Discretion
- Broadphase cell sizing, rebuild strategy, and static body handling
- Manifold persistence and warm-starting preparation for Phase 3
- Contact pair identification scheme
- Friction/restitution mixing location (contact vs solver)
- Collision filtering approach (bitmask, groups, or deferred)
- Pair exclusion lists for jointed bodies (Phase 4 forward-thinking)
- Static-static collision skip rules
- Event dispatch pattern and data payload
- Sensor event API (same events vs separate)
- Whether to include preSolve callback

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLL-01 | AABB broadphase using spatial hash grid producing candidate pairs | Spatial hash architecture pattern, cell sizing strategy, rebuild-per-frame approach |
| COLL-02 | SAT narrowphase for polygon-polygon collision with minimum penetration axis | SAT algorithm pattern with existing Polygon.normals and support(), axis projection, overlap/MTV computation |
| COLL-03 | Circle-circle collision detection (fast path) | Distance-squared vs sum-of-radii-squared, trivial contact point at midpoint along normal |
| COLL-04 | Circle-polygon collision detection | Voronoi region approach -- closest feature on polygon to circle center, vertex vs edge cases |
| COLL-05 | Contact manifold generation with contact points, normal, and penetration depth | Manifold data structure with up to 2 contact points, clipping for polygon-polygon edge contacts |
| COLL-06 | Collision filtering via category/mask bitmask | 16-bit or 32-bit category/mask on Body, bitwise AND filter in broadphase |
| EVNT-01 | beginContact event fired when two bodies start colliding | Manifold tracking across frames, new pair detection triggers event |
| EVNT-02 | endContact event fired when two bodies stop colliding | Stale pair detection (present last frame, absent this frame) triggers event |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7 | Language | Already in project |
| Vitest | ^3.0 | Testing | Already in project, used for all Phase 1 tests |

### Supporting
No external libraries. This is a from-scratch physics engine. All collision detection code is hand-written.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Spatial hash | BVH tree | BVH better for varied-size bodies but more complex; spatial hash ideal for < 500 similarly-sized bodies |
| SAT | GJK/EPA | GJK is more general (works with any convex shape) but SAT is simpler, faster for polygons with few vertices, and directly provides contact data |
| Full rebuild per frame | Incremental spatial hash | Incremental avoids rehashing static bodies but adds complexity; full rebuild is ~0.1ms for 500 bodies, not worth optimizing |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── collision/
│   ├── SpatialHash.ts       # Broadphase spatial hash grid
│   ├── narrowphase.ts       # SAT, circle-circle, circle-polygon dispatch
│   ├── sat.ts               # SAT polygon-polygon implementation
│   ├── Manifold.ts          # Contact manifold data structure
│   ├── ManifoldMap.ts       # Pair-keyed manifold cache across frames
│   ├── CollisionSystem.ts   # Orchestrates broadphase -> narrowphase -> manifold management
│   ├── CollisionFilter.ts   # Category/mask bitmask filtering
│   └── index.ts             # Barrel exports
├── events/
│   ├── EventDispatcher.ts   # Generic typed event emitter
│   └── index.ts
├── math/                    # (existing)
├── shapes/                  # (existing)
└── dynamics/                # (existing, Body needs id + sensor + category/mask additions)
```

### Pattern 1: Spatial Hash Broadphase
**What:** A grid of fixed-size cells. Each body's AABB is mapped to the cells it overlaps. Bodies sharing a cell are candidate collision pairs.
**When to use:** Always, as the first pipeline stage.
**Key design decisions:**
- **Cell size:** Use 2x the average body AABB dimension. For < 500 bodies, a fixed cell size (e.g., configurable, default ~2 units) works well. Overly small cells cause bodies to span many cells; overly large cells defeat the purpose.
- **Rebuild strategy:** Full clear-and-insert every frame. For < 500 bodies, rebuilding is simpler and just as fast as incremental updates. Avoids stale-cell bugs entirely.
- **Static body handling:** Insert static bodies every frame (same as dynamic). The rebuild cost is negligible. This avoids a separate "dirty" tracking system.
- **Pair deduplication:** Use a Set with a canonical pair key `min(idA, idB) << 16 | max(idA, idB)` (or string key `${minId}:${maxId}`) to avoid reporting the same pair twice when bodies share multiple cells.
- **Static-static skip:** Skip pairs where both bodies are static (they never need collision detection).

```typescript
class SpatialHash {
  private cellSize: number;
  private invCellSize: number;
  private cells: Map<number, Body[]>;

  constructor(cellSize: number = 2) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
  }

  clear(): void {
    this.cells.clear();
  }

  insert(body: Body, aabb: AABB): void {
    const minCX = Math.floor(aabb.min.x * this.invCellSize);
    const minCY = Math.floor(aabb.min.y * this.invCellSize);
    const maxCX = Math.floor(aabb.max.x * this.invCellSize);
    const maxCY = Math.floor(aabb.max.y * this.invCellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = hashCell(cx, cy);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(body);
      }
    }
  }

  queryPairs(): [Body, Body][] {
    // Collect unique pairs from cells
  }
}

function hashCell(cx: number, cy: number): number {
  // Cantor pairing or bit-interleave for signed integers
  // Simple approach: (cx * 92837111) ^ (cy * 689287499)
  return ((cx * 92837111) ^ (cy * 689287499)) | 0;
}
```

### Pattern 2: SAT Narrowphase for Polygon-Polygon
**What:** Separating Axis Theorem -- project both polygons onto each candidate separating axis (edge normals of both polygons). If projections overlap on all axes, collision exists. The axis with minimum overlap is the MTV (minimum translation vector).
**When to use:** For every polygon-polygon candidate pair from broadphase.

**Algorithm (leveraging existing Polygon.normals):**
1. For each normal in polygonA.normals and polygonB.normals (transformed to world space):
   a. Project all vertices of A onto the axis -> get [minA, maxA]
   b. Project all vertices of B onto the axis -> get [minB, maxB]
   c. Compute overlap = min(maxA, maxB) - max(minA, minB)
   d. If overlap <= 0: no collision (separating axis found), early return
   e. Track axis with smallest positive overlap -> this is the minimum penetration axis
2. If all axes overlap: collision confirmed. Return normal = minimum penetration axis, depth = minimum overlap.
3. Ensure normal points from A toward B (flip if dot(normal, B.center - A.center) < 0).

**Contact point generation (clipping):**
After finding the collision normal and penetration depth, identify the reference face (edge most aligned with collision normal) and incident face (edge most anti-aligned on the other body). Clip the incident face against the reference face side planes to produce up to 2 contact points. This is the Sutherland-Hodgman approach used by Box2D.

```typescript
interface ContactPoint {
  point: Vec2;      // World-space contact position
  depth: number;    // Penetration depth at this point
  id: number;       // Feature ID for warm-starting persistence
}

interface Manifold {
  bodyA: Body;
  bodyB: Body;
  normal: Vec2;     // Points from A to B
  contacts: ContactPoint[];  // 1-2 points
}
```

### Pattern 3: Circle-Circle Fast Path
**What:** Simplest collision test. Distance between centers vs sum of radii.
**Implementation:**
```typescript
function circleVsCircle(a: Body, b: Body): Manifold | null {
  const ca = a.shape as Circle;
  const cb = b.shape as Circle;

  // World-space centers (account for shape offset + body rotation)
  const centerA = getWorldCenter(a, ca);
  const centerB = getWorldCenter(b, cb);

  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const distSq = dx * dx + dy * dy;
  const sumR = ca.radius + cb.radius;

  if (distSq >= sumR * sumR) return null;

  const dist = Math.sqrt(distSq);
  const normal = dist > 0
    ? new Vec2(dx / dist, dy / dist)
    : new Vec2(1, 0); // Coincident centers: arbitrary normal

  const depth = sumR - dist;
  const contactPoint = new Vec2(
    centerA.x + normal.x * ca.radius,
    centerA.y + normal.y * ca.radius,
  );

  return { bodyA: a, bodyB: b, normal, contacts: [{ point: contactPoint, depth, id: 0 }] };
}
```

### Pattern 4: Circle-Polygon (Voronoi Region Approach)
**What:** Find the closest feature (vertex or edge) on the polygon to the circle center. Three cases:
1. Circle center closest to a vertex -> vertex-circle contact
2. Circle center closest to an edge (projects between edge endpoints) -> edge-circle contact
3. Circle center inside polygon -> find minimum penetration edge

**Algorithm:**
1. Transform circle center to polygon's local space
2. For each edge, find closest point and track minimum separation
3. If circle center is inside polygon, normal = edge normal of minimum penetration edge, depth = radius + signed distance
4. If outside, check vertex vs edge region, compute penetration

### Pattern 5: Contact Manifold Persistence
**What:** Cache manifolds between frames keyed by body pair ID. Enables warm-starting in Phase 3.
**Design:**
- **Pair key:** `pairId = min(bodyA.id, bodyB.id) * MAX_BODIES + max(bodyA.id, bodyB.id)` or use a Map keyed by string `${minId}:${maxId}`
- **Contact ID:** Feature-based ID per contact point (e.g., edge index on reference face + vertex index on incident face). This lets the solver match old impulses to new contacts.
- **Frame lifecycle:** Each frame: (1) run detection, (2) for each new manifold, look up old manifold by pair key, (3) match contacts by feature ID and copy cached impulse, (4) replace old manifold with new one, (5) any old manifold not refreshed this frame -> fire endContact

```typescript
class ManifoldMap {
  private manifolds: Map<string, Manifold> = new Map();
  private frameStamp: number = 0;

  // Returns pairs that are new this frame (for beginContact)
  // and pairs that disappeared (for endContact)
  update(newManifolds: Manifold[]): { began: Manifold[], ended: Manifold[] } {
    // ...
  }
}
```

### Pattern 6: Collision Filtering (Category/Mask Bitmask)
**What:** Each body has a `categoryBits` (which categories it belongs to) and `maskBits` (which categories it collides with). Two bodies collide only if `(a.categoryBits & b.maskBits) !== 0 && (b.categoryBits & a.maskBits) !== 0`.
**Defaults:** categoryBits = 0x0001, maskBits = 0xFFFF (collides with everything).
**Where to check:** In broadphase pair collection, before AABB overlap test. Cheapest filter first.

### Pattern 7: Event Dispatch
**What:** Simple callback registration with typed event payloads.
**Design:**
- Use a lightweight typed emitter pattern (not Node.js EventEmitter -- too heavy for a physics engine)
- Events: `beginContact(manifold)`, `endContact(manifold)`
- Sensor bodies use the same events but their manifolds are flagged `isSensor: true` so the solver knows to skip them
- Dispatch after manifold update, before solver (Phase 3)
- Include a `preSolve` callback hook for advanced use (user can modify/disable contacts before solving)

```typescript
interface ContactEvent {
  bodyA: Body;
  bodyB: Body;
  manifold: Manifold;
  isSensor: boolean;
}

type ContactListener = (event: ContactEvent) => void;

class EventDispatcher {
  private beginListeners: ContactListener[] = [];
  private endListeners: ContactListener[] = [];

  onBeginContact(listener: ContactListener): void { ... }
  onEndContact(listener: ContactListener): void { ... }
  emit(type: 'begin' | 'end', event: ContactEvent): void { ... }
}
```

### Anti-Patterns to Avoid
- **Mutating body state during detection:** Detection should be pure -- produce contact data, never move bodies. That is the solver's job (Phase 3).
- **Allocating Vec2s in tight loops:** Reuse scratch vectors for projection/clipping. Pre-allocate and set rather than `new Vec2()` inside per-axis loops.
- **Storing world-space vertices on the shape:** Shapes store local-space data only. Transform to world space on-the-fly during narrowphase using body position + angle. This avoids synchronization bugs.
- **Using string pair keys in hot loops:** For the spatial hash cell key, use integer math (multiply + XOR). String pair keys are acceptable for manifold caching (Map<string, Manifold>) since it happens once per pair per frame, not per cell.
- **Forgetting to handle coincident centers:** Circle-circle with zero distance needs a fallback normal (e.g., (1, 0)).
- **Normal direction inconsistency:** Always ensure the manifold normal points from bodyA toward bodyB. Flip if needed. The solver depends on this convention.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| N/A | N/A | N/A | This IS a hand-rolled engine; all collision code is intentionally custom |

**Key insight:** This phase is deliberately building everything from scratch. The "don't hand-roll" principle does not apply -- the entire engine IS the hand-rolled solution. However, follow well-established algorithms (Box2D-style SAT, Sutherland-Hodgman clipping) rather than inventing novel approaches.

## Common Pitfalls

### Pitfall 1: Incorrect Normal Direction in SAT
**What goes wrong:** The collision normal points from B to A instead of A to B (or vice versa), causing the solver to push bodies into each other instead of apart.
**Why it happens:** SAT finds the minimum penetration axis but doesn't inherently know which direction it should point.
**How to avoid:** After finding the min-penetration axis, compute `dot(normal, centerB - centerA)`. If negative, flip the normal. Establish and document the convention: normal points from A toward B.
**Warning signs:** Bodies accelerate into each other on contact instead of bouncing apart.

### Pitfall 2: Missing Edge Cases in Circle-Polygon
**What goes wrong:** Circle passes through polygon vertices or gets stuck at corners.
**Why it happens:** Only checking edge projections, not vertex regions. The Voronoi region approach has three distinct cases (vertex, edge, interior) that must all be handled.
**How to avoid:** Explicitly handle vertex-region contacts (closest point is a vertex, not an edge projection). Test with circles approaching polygon corners at various angles.
**Warning signs:** Circles "tunneling" through polygon corners, or jittering at vertices.

### Pitfall 3: Contact Point Instability (Jitter)
**What goes wrong:** Contact points jump between frames even when bodies are resting, causing the solver to oscillate.
**Why it happens:** Without manifold persistence and feature-based contact IDs, every frame generates "new" contacts from scratch, losing accumulated impulse data.
**How to avoid:** Assign feature IDs to contact points (based on edge/vertex indices involved). When updating manifolds, match new contacts to old contacts by feature ID and carry over cached impulses.
**Warning signs:** Stacked boxes vibrating or slowly sinking through each other.

### Pitfall 4: Broadphase Cell Size Too Small or Too Large
**What goes wrong:** Too small = bodies span many cells, O(n^2) degeneration. Too large = all bodies in one cell, broadphase useless.
**Why it happens:** Cell size not tuned to body sizes in the simulation.
**How to avoid:** Default cell size = 2x average body AABB dimension. Make it configurable. For this engine (< 500 bodies), even a mediocre cell size will perform adequately.
**Warning signs:** Broadphase returning nearly as many pairs as brute-force N*(N-1)/2.

### Pitfall 5: Forgetting to Transform Vertices/Normals to World Space
**What goes wrong:** SAT operates on local-space data, producing wrong collision results for rotated bodies.
**Why it happens:** Polygon stores vertices and normals in local space (correctly). Developer forgets to rotate them by body angle and translate by body position during narrowphase.
**How to avoid:** Create a helper function `getWorldVertices(body)` / `getWorldNormals(body)` and use it consistently. Consider caching world-space data per frame if profiling shows it matters.
**Warning signs:** Collisions work for axis-aligned bodies but fail for rotated ones.

### Pitfall 6: Not Skipping Static-Static Pairs
**What goes wrong:** Wasted computation detecting collisions between two immovable bodies.
**Why it happens:** No early-out check in broadphase or narrowphase.
**How to avoid:** In pair collection, skip pairs where `bodyA.type === Static && bodyB.type === Static`. Also skip `Kinematic-Static` if neither has velocity (optional optimization).
**Warning signs:** Performance degradation with many static environment bodies.

## Code Examples

### World-Space Vertex Transformation
```typescript
function getWorldVertices(body: Body, polygon: Polygon): Vec2[] {
  const rot = Mat2.fromAngle(body.angle);
  return polygon.vertices.map(v => {
    const local = Vec2.add(v, polygon.offset);
    return rot.mulVec2(local).add(body.position);
  });
}

function getWorldNormals(body: Body, polygon: Polygon): Vec2[] {
  const rot = Mat2.fromAngle(body.angle);
  return polygon.normals.map(n => rot.mulVec2(n));
}
```

### SAT Axis Projection
```typescript
function projectPolygon(vertices: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of vertices) {
    const proj = v.dot(axis);
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }
  return [min, max];
}
```

### Pair Key Generation
```typescript
function pairKey(idA: number, idB: number): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}
```

### Bitmask Filter Check
```typescript
function shouldCollide(a: Body, b: Body): boolean {
  return (a.categoryBits & b.maskBits) !== 0
      && (b.categoryBits & a.maskBits) !== 0;
}
```

### Contact Feature ID (for manifold persistence)
```typescript
// Encode reference edge index + incident vertex index into a single number
function contactId(refEdge: number, incVertex: number): number {
  return (refEdge << 8) | incVertex;
}
```

## Body Modifications Required

The existing `Body` class needs several additions for Phase 2:

1. **`id: number`** -- Unique integer ID assigned at creation (use a static counter). Required for pair identification, manifold caching, and spatial hash deduplication.
2. **`isSensor: boolean`** -- Default false. Sensor bodies detect overlap and fire events but produce no collision response.
3. **`categoryBits: number`** -- Default 0x0001. Which collision categories this body belongs to.
4. **`maskBits: number`** -- Default 0xFFFF. Which collision categories this body collides with.

## Friction/Restitution Mixing

**Recommendation:** Compute mixed material properties at manifold creation time and store on the manifold. This keeps the solver simple (just reads `manifold.friction` and `manifold.restitution`).

**Mixing rules (Box2D convention):**
- Friction: geometric mean `sqrt(frictionA * frictionB)` -- prevents zero-friction bodies from making everything frictionless
- Restitution: max `max(restitutionA, restitutionB)` -- the bouncier material dominates

```typescript
manifold.friction = Math.sqrt(shapeA.material.friction * shapeB.material.friction);
manifold.restitution = Math.max(shapeA.material.restitution, shapeB.material.restitution);
```

## Pipeline Orchestration

The collision system orchestrates the full pipeline each frame:

```
CollisionSystem.detect(bodies: Body[]):
  1. Compute AABBs for all bodies
  2. Build spatial hash (clear + insert all)
  3. Collect candidate pairs (with bitmask filter + static-static skip)
  4. For each pair: run narrowphase dispatch (circle-circle / circle-polygon / polygon-polygon)
  5. Update ManifoldMap with new manifolds
  6. Fire beginContact for new pairs, endContact for removed pairs
  7. Return active manifolds (for Phase 3 solver consumption)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sort-and-sweep broadphase | Spatial hash (for uniform body sizes) | Common in modern 2D engines | Simpler implementation, O(n) insert, good cache behavior |
| Per-frame contact generation | Persistent contact manifolds with warm-starting | Box2D (2006+) | Critical for stable stacking, industry standard |
| Single contact point | Up to 2 contact points (edge clipping) | Standard since Box2D | Stable flat-on-flat resting without jitter |

**Deprecated/outdated:**
- Brute-force O(n^2) broadphase: Only acceptable for < 50 bodies
- GJK for 2D polygon-polygon: Overkill for convex polygons with small vertex counts; SAT is simpler and faster

## Open Questions

1. **Cell size auto-tuning vs fixed**
   - What we know: Fixed cell size works for < 500 similarly-sized bodies
   - What's unclear: If body sizes vary widely (tiny circles + large polygons), fixed cell size may be suboptimal
   - Recommendation: Use configurable fixed cell size (default 2.0). Document that users with wildly varying sizes should adjust. Auto-tuning is premature optimization for this scale.

2. **preSolve callback timing**
   - What we know: Box2D fires preSolve before solving each manifold, allowing users to disable contacts or modify friction/restitution per-frame
   - What's unclear: Whether this is needed in v1 or adds unnecessary API surface
   - Recommendation: Include preSolve hook as a simple optional callback on the collision system. It is low implementation cost and high value for interactive simulations (e.g., one-way platforms).

3. **Pair exclusion for jointed bodies**
   - What we know: Phase 4 (constraints) will need connected bodies to skip collision detection
   - What's unclear: Whether to add the exclusion list infrastructure now or in Phase 4
   - Recommendation: Add an empty `pairExclusions: Set<string>` on the collision system now. Check it during pair collection. Phase 4 populates it when constraints are created. Zero implementation cost to leave empty.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/shapes/Polygon.ts` (normals, support function), `src/shapes/Circle.ts`, `src/math/AABB.ts` (overlaps), `src/dynamics/Body.ts`
- Box2D Lite / Box2D source: Industry-standard reference for SAT, clipping, manifold persistence, warm-starting patterns
- Erin Catto's GDC presentations (2005-2014): Authoritative source for sequential impulse solver contact preparation

### Secondary (MEDIUM confidence)
- Spatial hash grid sizing heuristics: Multiple physics engine implementations agree on 2x average body size
- Sutherland-Hodgman clipping for 2D contact generation: Well-documented algorithm, standard in 2D physics engines

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no external dependencies, all hand-rolled code using established algorithms
- Architecture: HIGH -- pipeline pattern (broadphase -> narrowphase -> manifold -> events) is industry standard, existing codebase interfaces are well-understood
- Pitfalls: HIGH -- these are well-documented failure modes from physics engine development literature

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable domain, algorithms do not change)
