# Collision System

## Pipeline Overview

The collision system runs a **5-stage pipeline** every fixed timestep, orchestrated by `World.singleStep()`:

```
Integrate Velocities
        |
  Broad-phase (Spatial Hash)
        |
  Narrow-phase (SAT / Voronoi)
        |
  Manifold Persistence (Warm-Start Transfer)
        |
  Constraint Solving (Sequential Impulse + Position Correction)
```

Collision detection happens **after** velocity integration but **before** position integration. This allows the solver to correct velocities before they're committed to positions — the key insight behind semi-implicit Euler integration.

---

## Broad-phase: Spatial Hashing

**File:** `SpatialHash.ts`

A uniform grid partitions the world into cells. Each body's AABB is inserted into every cell it overlaps. Candidate pairs are generated from bodies sharing the same cell.

- **Cell key:** Cantor-style hash — `((cx * 92837111) ^ (cy * 689287499)) | 0`
- **Pair deduplication:** Canonical key `min(idA, idB):max(idA, idB)` via a `Set`
- **Complexity:** O(n) insertion, O(candidates) querying

Cell size is configurable (`WorldSettings.cellSize`, default 2). Smaller cells reduce spurious candidates but increase memory. A good heuristic is 2-4x the largest body diameter.

### Collision Filtering

Before narrowphase, pairs are filtered via bitmask (`CollisionFilter.ts`):

```
shouldCollide = (a.categoryBits & b.maskBits) !== 0
             && (b.categoryBits & a.maskBits) !== 0
```

Static-static pairs are always rejected (neither can move). Joint-connected pairs can be excluded via `World.addPairExclusion()`.

---

## Narrow-phase

**Files:** `narrowphase.ts`, `sat.ts`

Three dispatch paths based on shape type combinations:

### Circle vs Circle

Distance check between world-space centers. Single contact point on body A's surface. Normal points from A toward B.

### Circle vs Polygon (Voronoi Regions)

**File:** `narrowphase.ts` — `circleVsPolygon()`

The circle center is transformed into the polygon's local space. The algorithm finds the closest edge, then classifies the Voronoi region:

- **Edge interior:** Project center onto edge. Normal is the edge outward normal.
- **Vertex region:** Closest feature is a vertex. Normal points from vertex to center.
- **Circle inside polygon:** Special case — deepest edge becomes the separating axis.

A single contact point is produced.

### Polygon vs Polygon (SAT + Clipping)

**File:** `sat.ts` — `polygonVsPolygon()`

Two-phase algorithm:

**1. SAT (Separating Axis Theorem):** Test all edge normals from both polygons. Project both shapes onto each axis. If any axis shows zero overlap, the polygons are separated. The axis with minimum overlap becomes the collision normal (Minimum Translation Vector).

**2. Sutherland-Hodgman Clipping:** Generate contact points by clipping one polygon's edge against another:

1. Identify the **reference edge** — most aligned with the collision normal
2. Identify the **incident edge** — most anti-aligned on the other polygon
3. Clip the incident edge against the reference edge's side planes
4. Keep points behind the reference face
5. Deduplicate and cap at 2 contacts (the 2D standard)

**Feature IDs** encode which edges produced each contact (`(refEdgeIdx << 8) | incVertIdx`), enabling warm-start matching across frames.

---

## Manifolds

**File:** `Manifold.ts`

A manifold represents one collision pair:

```typescript
interface Manifold {
  bodyA: Body;
  bodyB: Body;
  normal: Vec2;             // Always points from A toward B
  contacts: ContactPoint[]; // 1-2 points
  friction: number;         // sqrt(a.friction * b.friction)
  restitution: number;      // max(a.restitution, b.restitution)
  isSensor: boolean;
}
```

Each contact carries cached impulses for warm-starting:

```typescript
interface ContactPoint {
  point: Vec2;              // World-space location
  depth: number;            // Penetration (positive = overlap)
  id: number;               // Feature ID for persistence matching
  normalImpulse: number;    // Cached from previous frame
  tangentImpulse: number;   // Cached from previous frame
}
```

### Material Mixing

- **Friction:** Geometric mean — `sqrt(a * b)`. Balances asymmetric surfaces (ice on rubber).
- **Restitution:** Max — `max(a, b)`. One elastic surface is enough to bounce.

---

## Manifold Persistence

**File:** `ManifoldMap.ts`

Tracks contacts across frames using a `Map<pairKey, Manifold>`. Each frame:

1. New manifolds arrive from narrowphase
2. For persisting pairs, old contacts are matched to new contacts by **feature ID**
3. `normalImpulse` and `tangentImpulse` transfer from old to new (warm-start data)
4. New pairs are flagged as `began`, lost pairs as `ended` (for event callbacks)

This persistence is critical — without it, the solver starts from zero each frame and stacks jitter.

---

## Constraint Solving

**File:** `ContactSolver.ts`

A sequential impulse solver with three phases per step:

### Phase 1: preStep

Build `ContactConstraint` for each contact. Precompute:

- **Lever arms** (`rA`, `rB`) — vectors from body centers to contact point
- **Effective masses** — account for both linear and rotational inertia:
  ```
  kNormal = invMassA + invMassB + invInertiaA * (rA × n)² + invInertiaB * (rB × n)²
  normalMass = 1 / kNormal
  ```
- **Velocity bias** — `max(baumgarteBias, restitutionBias)`:
  ```
  baumgarteBias = (beta * 0.5 / dt) * max(depth - slop, 0)
  restitutionBias = restitution * max(-vn, 0)    // only if approaching fast
  bias = max(baumgarteBias, restitutionBias)
  ```

The bias uses **max** (not sum) to prevent energy injection on elastic impacts. Summing would overcorrect — the restitution bounce already handles separation velocity, and adding Baumgarte on top injects extra energy that compounds across frames.

**Warm-start:** Apply cached impulses from the manifold immediately. This gives the solver a head start, dramatically improving convergence for persistent contacts (stacks, resting bodies).

### Phase 2: solve (called N times)

Each iteration processes all contacts:

**Normal impulse:**
```
vn = relativeVelocity · normal
lambda = normalMass * (-vn + bias)
newAccumulated = max(oldAccumulated + lambda, 0)   // can only push, not pull
lambda = newAccumulated - oldAccumulated
```

The accumulated clamping is essential — it prevents the solver from pulling bodies together on subsequent iterations.

**Friction impulse:**
```
vt = relativeVelocity · tangent
lambdaT = tangentMass * (-vt)
clamped to [-friction * normalImpulse, +friction * normalImpulse]   // Coulomb cone
```

### Phase 3: solvePositions (NGS)

After velocity solving and position integration, directly move bodies apart to resolve remaining penetration:

```
separation = -depth + slop
correction = clamp(beta * (-separation), 0, maxLinearCorrection)
impulse = correction / kNormal
```

Position correction does **not** change velocity. This prevents energy accumulation that destabilizes stacks — a key distinction from velocity-level Baumgarte.

---

## Tuning Parameters

| Parameter | Default | Purpose |
|---|---|---|
| `velocityIterations` | 8 | Solver convergence. More = more stable, slower |
| `positionIterations` | 4 | Penetration resolution. More = tighter contacts |
| `baumgarteFactor` | 0.2 | Velocity bias strength. 0.1-0.3 typical |
| `penetrationSlop` | 0.01 | Dead-zone before position correction kicks in |
| `restitutionSlop` | 0.5 | Min closing velocity for restitution bounce |
| `maxLinearCorrection` | 0.2 | Position correction cap per iteration |
| `cellSize` | 2 | Spatial hash grid resolution |

---

## Design Decisions

**Semi-implicit Euler integration.** Velocity is updated before position. This order is symplectic — it conserves energy better than explicit Euler and prevents the gradual energy gain that makes simulations explode.

**Normal always points A toward B.** Consistent convention across all narrowphase paths. Simplifies the solver since impulse direction is always known.

**Max 2 contacts per manifold.** The 2D standard. Two points are sufficient to represent any polygon-polygon contact (edge-edge or edge-vertex). Fewer constraints mean faster solving.

**Warm-starting via feature IDs.** Contact impulses persist across frames by matching geometric features, not positions. This tolerates slight contact drift between frames while preserving solver convergence.

**max(Baumgarte, restitution) not sum.** Prevents double-counting on elastic impacts. Baumgarte handles resting penetration correction; restitution handles bounce velocity. They serve the same purpose (separation) through different mechanisms, so the larger one wins.

**Position correction without velocity injection.** The solver moves bodies apart directly after velocity solving. Injecting velocity would accumulate energy in stacks, causing them to explode upward. Direct position adjustment is energy-neutral.
