# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** A correct, performant rigid body physics simulation that you fully understand and control because you built every line of it.
**Current focus:** Phase 2: Collision Detection

## Current Position

Phase: 2 of 6 (Collision Detection) -- COMPLETE
Plan: 3 of 3 in current phase
Status: Phase 2 Complete, ready for Phase 3
Last activity: 2026-02-21 — Completed 02-03-PLAN.md

Progress: [████░░░░░░] 43%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 4min
- Total execution time: 24min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 01 P01 | 4min | 2 tasks | 14 files |
| Phase 01 P02 | 3min | 2 tasks | 7 files |
| Phase 01 P03 | 3min | 2 tasks | 5 files |
| Phase 02 P01 | 5min | 2 tasks | 7 files |
| Phase 02 P02 | 5min | 2 tasks | 6 files |
| Phase 02 P03 | 4min | 2 tasks | 12 files |

**Recent Trend:**
- Last 5 plans: 3min, 3min, 5min, 5min, 4min
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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 02-03-PLAN.md (Collision pipeline, ManifoldMap persistence, EventDispatcher -- Phase 2 complete)
Resume file: .planning/phases/02-collision-detection/02-03-SUMMARY.md
