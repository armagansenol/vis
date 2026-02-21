---
phase: 01-foundation
plan: 02
subsystem: shapes
tags: [typescript, physics, circle, polygon, convex-hull, mass-inertia, box2d-algorithm]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: "Vec2, Mat2, AABB math primitives"
provides:
  - "Circle shape with mass/inertia computation and AABB"
  - "Convex Polygon with Box2D triangle-fan mass computation"
  - "Polygon.box factory for rectangles"
  - "Polygon.regular factory for N-sided regular polygons"
  - "Material interface with density, friction, restitution defaults"
  - "Shape interface with computeMassData and computeAABB"
  - "Precomputed edge normals for SAT collision detection"
  - "Support function for GJK/SAT algorithms"
affects: [dynamics, collision]

# Tech tracking
tech-stack:
  added: []
  patterns: [box2d-triangle-fan-mass, parallel-axis-theorem, ccw-winding-enforcement, convexity-validation]

key-files:
  created:
    - src/shapes/Shape.ts
    - src/shapes/Circle.ts
    - src/shapes/Polygon.ts
    - src/shapes/index.ts
    - tests/shapes/Circle.test.ts
    - tests/shapes/Polygon.test.ts
  modified:
    - src/index.ts

key-decisions:
  - "Shape is an interface (not abstract class) -- lighter weight, no runtime overhead"
  - "Polygon constructor is private; use fromVertices/box/regular factories for validation guarantees"
  - "Convexity validation throws descriptive error rather than silently computing convex hull (per research recommendation)"
  - "Edge normals use right-hand perpendicular (y, -x) for outward-facing normals on CCW polygons"
  - "Polygon mass computation follows Box2D triangle-fan algorithm exactly (reference point at first vertex)"

patterns-established:
  - "Factory pattern: Polygon uses static factory methods with private constructor to enforce invariants"
  - "Parallel axis theorem applied for all shapes with offset from body center"
  - "Vertices cloned on construction to prevent external mutation"

requirements-completed: [SHAP-01, SHAP-02, SHAP-03, BODY-09]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 1 Plan 2: Shape Geometry Summary

**Circle and Convex Polygon shapes with Box2D-style mass/inertia computation, convexity validation, and precomputed edge normals -- 30 tests passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T09:47:04Z
- **Completed:** 2026-02-21T09:50:13Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Circle shape with radius, offset, mass/inertia computation (parallel axis theorem), and AABB
- Convex Polygon with fromVertices (convexity check + CCW enforcement), box factory, regular polygon factory
- Box2D triangle-fan algorithm for polygon mass, centroid, and moment of inertia
- Precomputed outward-facing edge normals for future SAT collision detection
- Support function for future GJK/SAT algorithms
- Material properties (density, friction, restitution) with sensible defaults on all shapes
- 30 comprehensive tests validating mass properties against known analytical values

## Task Commits

Each task was committed atomically:

1. **Task 1: Shape types, Circle, material properties** - `4dd251e` (feat)
2. **Task 2: Polygon with validation, Box/regular factories** - `404f081` (feat)

## Files Created/Modified
- `src/shapes/Shape.ts` - ShapeType enum, Material/MassData interfaces, default constants, Shape interface
- `src/shapes/Circle.ts` - Circle shape with mass/inertia and AABB computation
- `src/shapes/Polygon.ts` - Convex polygon with factories, mass computation, normals, support function
- `src/shapes/index.ts` - Barrel export for shapes module
- `src/index.ts` - Added shapes re-export
- `tests/shapes/Circle.test.ts` - 12 tests for Circle (mass, AABB, defaults, parallel axis)
- `tests/shapes/Polygon.test.ts` - 18 tests for Polygon (box, regular, convexity, normals, support, AABB)

## Decisions Made
- Shape is an interface (not abstract class) for zero runtime overhead
- Polygon uses private constructor + static factories to enforce convexity invariant
- Convexity validation throws a descriptive error (does not silently compute convex hull)
- Edge normals computed as right-hand perpendicular of edge direction for CCW polygons
- Mass computation follows Box2D's exact triangle-fan algorithm with first vertex as reference point

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shape geometry complete -- Circle and Polygon ready for Body class (Plan 03) to derive mass and moment of inertia
- All 30 shape tests passing with TypeScript strict mode, zero type errors
- Edge normals and support function ready for collision detection (Phase 2)

## Self-Check: PASSED

- All 7 key files verified present on disk
- Commit `4dd251e` (Task 1) verified in git log
- Commit `404f081` (Task 2) verified in git log

---
*Phase: 01-foundation*
*Completed: 2026-02-21*
