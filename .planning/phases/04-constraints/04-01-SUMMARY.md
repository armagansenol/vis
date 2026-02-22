---
phase: 04-constraints
plan: 01
subsystem: physics
tags: [constraints, distance-joint, spring-joint, sequential-impulse, baumgarte, catto-soft-constraints]

requires:
  - phase: 03-solver-and-engine-loop
    provides: ContactSolver with sequential impulse pattern, World.singleStep pipeline, pair exclusion API
provides:
  - Constraint interface (preStep/solveVelocity lifecycle)
  - DistanceConstraint (rigid 1D with Baumgarte stabilization)
  - SpringConstraint (soft 1D with Catto gamma/beta formulation)
  - World.addConstraint/removeConstraint API
  - Interleaved constraint/contact solving in World solver loop
affects: [04-02, 05-renderer, 06-demos]

tech-stack:
  added: []
  patterns: [constraint-interface, local-anchor-transform, soft-constraint-gamma-beta, interleaved-solver-loop]

key-files:
  created:
    - src/constraints/Constraint.ts
    - src/constraints/DistanceConstraint.ts
    - src/constraints/SpringConstraint.ts
    - src/constraints/index.ts
    - tests/constraints/DistanceConstraint.test.ts
    - tests/constraints/SpringConstraint.test.ts
  modified:
    - src/engine/World.ts
    - src/index.ts

key-decisions:
  - "Constraint interface includes collideConnected property for uniform pair exclusion handling"
  - "Bilateral distance constraint (not rope) -- maintains exact distance in both push and pull directions"
  - "Separate DistanceConstraint and SpringConstraint classes for clarity of intent"
  - "Anchors stored as plain {x, y} objects (not Vec2) to prevent external mutation without allocation"

patterns-established:
  - "Constraint interface: preStep(dt) + solveVelocity() lifecycle matching ContactSolver pattern"
  - "Local-space anchors transformed to world space via cos/sin inline math in preStep"
  - "Catto gamma/beta formulation for soft constraints (SpringConstraint)"
  - "Nyquist frequency clamping for soft constraint stability"

requirements-completed: [CONS-01, CONS-02]

duration: 4min
completed: 2026-02-22
---

# Phase 4 Plan 1: Constraint Interface + Distance and Spring Constraints Summary

**Constraint interface with rigid distance (Baumgarte) and elastic spring (Catto gamma/beta) constraints integrated into World solver loop**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T07:13:57Z
- **Completed:** 2026-02-22T07:17:53Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Constraint interface defining preStep/solveVelocity lifecycle for all joint types
- DistanceConstraint maintaining fixed separation with Baumgarte position correction
- SpringConstraint with configurable hertz/dampingRatio using Catto's soft constraint formulation
- World.addConstraint/removeConstraint with automatic pair exclusion for connected bodies
- Interleaved constraint/contact solving in the iteration loop (Box2D pattern)
- 9 constraint tests covering distance maintenance, spring elasticity, damping behavior, and Nyquist safety

## Task Commits

Each task was committed atomically:

1. **Task 1: Constraint interface + DistanceConstraint + SpringConstraint** - `b390098` (feat)
2. **Task 2: World integration + tests** - `a4cb1c7` (feat)

## Files Created/Modified
- `src/constraints/Constraint.ts` - Interface with bodyA, bodyB, collideConnected, preStep, solveVelocity
- `src/constraints/DistanceConstraint.ts` - Rigid 1D distance with Baumgarte stabilization and warm-starting
- `src/constraints/SpringConstraint.ts` - Soft 1D distance with Catto gamma/beta and Nyquist clamping
- `src/constraints/index.ts` - Barrel exports for constraint module
- `src/engine/World.ts` - Added constraint storage, add/remove API, interleaved solver integration
- `src/index.ts` - Added constraints barrel export
- `tests/constraints/DistanceConstraint.test.ts` - 4 tests for distance maintenance and auto-length
- `tests/constraints/SpringConstraint.test.ts` - 5 tests for spring behavior, damping, and stability

## Decisions Made
- Constraint interface includes `collideConnected` as a readonly property for uniform handling in World.addConstraint
- Bilateral distance constraint (not rope) -- no impulse clamping, maintains distance in both directions
- Local anchors stored as plain `{x, y}` objects cloned on construction (avoids Vec2 allocation, prevents mutation)
- Separate Distance and Spring classes rather than unified class with optional stiffness

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Constraint interface established for RevoluteConstraint and MouseConstraint (Plan 2)
- World integration pattern proven -- new constraint types only need to implement the interface
- All 237 tests pass (zero regressions)

---
*Phase: 04-constraints*
*Completed: 2026-02-22*
