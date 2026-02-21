---
phase: 02-collision-detection
plan: 02
subsystem: collision
tags: [sat, narrowphase, contact-manifold, sutherland-hodgman, voronoi-region]

requires:
  - phase: 01-math-shapes-bodies
    provides: "Vec2, Mat2, Shape, Circle, Polygon, Body types"
  - phase: 02-collision-detection
    plan: 01
    provides: "SpatialHash broadphase, CollisionFilter, AABB"
provides:
  - "ContactPoint and Manifold interfaces for solver consumption"
  - "Circle-circle collision detection with offset/rotation support"
  - "Circle-polygon Voronoi region collision detection"
  - "SAT polygon-polygon with Sutherland-Hodgman contact clipping"
  - "Narrowphase dispatch routing all shape pair combinations"
  - "Material mixing (geometric mean friction, max restitution)"
  - "Pair key canonical deduplication helper"
affects: [03-solver, 04-constraints]

tech-stack:
  added: []
  patterns:
    - "Voronoi region approach for circle-polygon contact"
    - "Sutherland-Hodgman clipping for polygon edge-edge contacts"
    - "Feature ID encoding (refEdge << 8 | incVertex) for warm-starting"
    - "Normal convention: always from bodyA toward bodyB"

key-files:
  created:
    - src/collision/Manifold.ts
    - src/collision/narrowphase.ts
    - src/collision/sat.ts
    - tests/collision/narrowphase.test.ts
    - tests/collision/sat.test.ts
  modified:
    - src/collision/index.ts

key-decisions:
  - "Normal convention: always points from bodyA toward bodyB across all algorithms"
  - "Voronoi region approach for circle-polygon (vertex, edge, interior cases)"
  - "Sutherland-Hodgman clipping for polygon contact points (up to 2 per collision)"
  - "Feature IDs encode (refEdgeIndex << 8 | incidentVertexIndex) for warm-starting persistence"
  - "Material mixing: geometric mean for friction, max for restitution"

patterns-established:
  - "Narrowphase dispatch by ShapeType enum pairs with body swap + normal flip for asymmetric pairs"
  - "Local-space computation with world-space transform for polygon algorithms"
  - "Contact clipping via reference/incident face selection"

requirements-completed: [COLL-02, COLL-03, COLL-04, COLL-05]

duration: 5min
completed: 2026-02-21
---

# Phase 2 Plan 2: Narrowphase Collision Detection Summary

**SAT polygon-polygon with Sutherland-Hodgman clipping, circle-circle/circle-polygon via Voronoi regions, and Manifold contact data structures**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T11:41:03Z
- **Completed:** 2026-02-21T11:46:16Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Complete narrowphase collision detection for all shape pair combinations (circle-circle, circle-polygon, polygon-polygon)
- SAT with minimum penetration axis and Sutherland-Hodgman clipping producing 1-2 contact points
- Contact manifold types with material mixing, sensor flags, and feature IDs for warm-starting
- 30 tests covering overlapping, separated, corner, interior, rotated, and edge-edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Manifold data structures and circle collision algorithms** - `819c164` (feat)
2. **Task 2: SAT polygon-polygon with Sutherland-Hodgman contact clipping** - `2fba50f` (feat)

## Files Created/Modified

- `src/collision/Manifold.ts` - ContactPoint, Manifold interfaces, mixMaterials, pairKey helpers
- `src/collision/narrowphase.ts` - circleVsCircle, circleVsPolygon, detectNarrowphase dispatch
- `src/collision/sat.ts` - polygonVsPolygon with SAT + Sutherland-Hodgman contact clipping
- `src/collision/index.ts` - Updated barrel exports for all narrowphase modules
- `tests/collision/narrowphase.test.ts` - 19 tests for circle-circle, circle-polygon, material mixing, dispatch
- `tests/collision/sat.test.ts` - 11 tests for SAT polygon-polygon with various shape combinations

## Decisions Made

- Normal convention: always points from bodyA toward bodyB across all algorithms
- Voronoi region approach for circle-polygon (three cases: vertex, edge interior, center inside polygon)
- Sutherland-Hodgman clipping against reference edge side planes for polygon contact generation
- Feature IDs encode `(refEdgeIndex << 8) | incidentVertexIndex` for solver warm-starting
- Material mixing: geometric mean for friction (balances ice-on-rubber), max for restitution (bouncier dominates)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Sutherland-Hodgman side plane orientation**
- **Found during:** Task 2 (SAT implementation)
- **Issue:** Side clip planes were using reversed tangent directions, causing all incident edge points to be clipped out
- **Fix:** Corrected side plane 1 to use +tangent at refV1 and side plane 2 to use -tangent at refV2
- **Files modified:** src/collision/sat.ts
- **Verification:** All 11 SAT tests pass including edge-edge 2-contact-point cases
- **Committed in:** 2fba50f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix necessary for correct contact clipping. No scope creep.

## Issues Encountered

None beyond the side plane orientation fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All narrowphase algorithms complete and tested
- Ready for Plan 3 (collision pipeline integration) or Phase 3 (solver)
- Manifold data structures provide everything the constraint solver needs: contact points, normals, depths, friction, restitution, feature IDs

---
## Self-Check: PASSED

All 6 files verified on disk. Commits 819c164 and 2fba50f confirmed in git log.

---
*Phase: 02-collision-detection*
*Completed: 2026-02-21*
