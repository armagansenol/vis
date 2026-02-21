# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A correct, performant rigid body physics simulation that you fully understand and control because you built every line of it.
**Current focus:** Phase 3: Solver and Engine Loop

## Current Position

Phase: 3 of 6 (Solver and Engine Loop)
Plan: 1 of 2 in current phase
Status: Executing Phase 3
Last activity: 2026-02-21 — Completed 03-01-PLAN.md

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 4min
- Total execution time: 28min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 01 P01 | 4min | 2 tasks | 14 files |
| Phase 01 P02 | 3min | 2 tasks | 7 files |
| Phase 01 P03 | 3min | 2 tasks | 5 files |
| Phase 02 P01 | 5min | 2 tasks | 7 files |
| Phase 02 P02 | 5min | 2 tasks | 6 files |
| Phase 02 P03 | 4min | 2 tasks | 12 files |
| Phase 03 P01 | 4min | 2 tasks | 4 files |

**Recent Trend:**
- Last 5 plans: 3min, 5min, 5min, 4min, 4min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 6 phases following strict bottom-up dependency chain (math -> collision -> solver -> constraints -> renderer -> demos)
- Roadmap: BODY-06 (fixed timestep loop) assigned to Phase 3 (Solver) since the engine loop orchestrates the solver
- Vec2 uses mutable class with method chaining (per user constraint)
- AABB touching edges count as overlapping (physics convention)
- EPSILON = 1e-6 as engine-wide float comparison constant
- Mat2 kept minimal: fromAngle, mulVec2, transpose, identity
- Shape is an interface (not abstract class) for zero runtime overhead
- Polygon uses private constructor + static factories to enforce convexity invariant
- Convexity validation throws descriptive error (does not silently compute convex hull)
- Box2D triangle-fan algorithm for polygon mass/inertia computation
- Body stores both mass and invMass; static/kinematic use invMass=0 for natural force immunity
- Semi-implicit Euler: velocity before position for energy conservation
- Force accumulators cleared after each integrate() call
- Self-pair rejection in SpatialHash.queryPairs to handle hash key collisions between different cell coordinates
- String-based pair deduplication with ordered ID keys (min:max) in spatial hash
- Normal convention: always points from bodyA toward bodyB across all narrowphase algorithms
- Voronoi region approach for circle-polygon collision (vertex, edge, interior cases)
- Sutherland-Hodgman clipping for polygon contact points (up to 2 per collision)
- Feature IDs encode (refEdgeIndex << 8 | incidentVertexIndex) for warm-starting
- Material mixing: geometric mean for friction, max for restitution
- ContactPoint extended with normalImpulse/tangentImpulse (default 0) for solver warm-starting
- Warm-start transfer matches contacts by feature ID within persisting manifolds
- Pair exclusion set on CollisionSystem for Phase 4 joint forward-compatibility
- Box2D impulse formula: lambda = normalMass * (-vn + bias) with positive bias for Baumgarte and restitution
- Compute restitution velocity BEFORE warm-start application in preStep
- Inline x/y arithmetic in solve() hot loop to avoid GC pressure

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 03-01-PLAN.md (Sequential impulse contact solver with normal/friction, warm-starting, Baumgarte)
Resume file: .planning/phases/03-solver-and-engine-loop/03-01-SUMMARY.md
