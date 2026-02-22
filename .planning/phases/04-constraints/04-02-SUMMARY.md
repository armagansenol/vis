---
phase: 04-constraints
plan: 02
subsystem: physics
tags: [constraints, revolute-joint, mouse-joint, angle-limits, motor, soft-constraint, interactive-dragging]

requires:
  - phase: 04-constraints-01
    provides: Constraint interface, World.addConstraint integration, local-anchor transform pattern
provides:
  - RevoluteConstraint (2D hinge joint with optional angle limits and motor)
  - MouseConstraint (2D soft constraint for interactive dragging)
  - Complete constraint system (4 types: distance, spring, revolute, mouse)
affects: [05-renderer, 06-demos]

tech-stack:
  added: []
  patterns: [2x2-effective-mass-matrix, cramer-rule-inline-inverse, revolute-angle-limits, motor-impulse-clamping, mouse-soft-constraint-gamma-beta]

key-files:
  created:
    - src/constraints/RevoluteConstraint.ts
    - src/constraints/MouseConstraint.ts
    - tests/constraints/RevoluteConstraint.test.ts
    - tests/constraints/MouseConstraint.test.ts
  modified:
    - src/constraints/index.ts

key-decisions:
  - "RevoluteConstraint takes worldAnchor in constructor, converts to local-space for each body automatically"
  - "Mouse constraint uses bodyA=bodyB=body for Constraint interface compatibility (only body is used in math)"
  - "Mouse maxForce defaults to 1000 * body.mass for sensible drag behavior without explicit tuning"
  - "Revolute limit state uses accumulated impulse clamping (>=0 at lower, <=0 at upper, bilateral at equal)"

patterns-established:
  - "2x2 K matrix build + Cramer's rule inline inverse for 2D point constraints"
  - "Revolute angle limit state machine: inactive/atLower/atUpper/equal with per-state clamping"
  - "Motor impulse with accumulated clamping to maxMotorTorque * dt"
  - "Mouse constraint gamma/beta for 2D soft constraint with max force clamping on accumulated impulse magnitude"

requirements-completed: [CONS-03, CONS-04]

duration: 4min
completed: 2026-02-22
---

# Phase 4 Plan 2: Revolute and Mouse Constraints Summary

**RevoluteConstraint (2D hinge with angle limits and motor) and MouseConstraint (soft spring drag) completing the 4-type constraint system**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T07:20:50Z
- **Completed:** 2026-02-22T07:24:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- RevoluteConstraint with 2x2 point constraint keeping anchor points coincident, plus 1D angular limit/motor
- MouseConstraint with Catto gamma/beta soft constraint for smooth interactive dragging with max force clamping
- All four constraint types (Distance, Spring, Revolute, Mouse) working via World.addConstraint
- 11 new tests (6 revolute + 5 mouse) bringing total to 248 passing tests with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: RevoluteConstraint with angle limits and motor** - `d8d8e5d` (feat)
2. **Task 2: MouseConstraint for interactive dragging** - `320f78a` (feat)

## Files Created/Modified
- `src/constraints/RevoluteConstraint.ts` - 2D hinge joint with 2x2 K matrix, angle limits, motor, warm-starting
- `src/constraints/MouseConstraint.ts` - Soft 2D constraint to world target with gamma/beta and max force clamping
- `src/constraints/index.ts` - Added RevoluteConstraint and MouseConstraint exports
- `tests/constraints/RevoluteConstraint.test.ts` - 6 tests: anchor coincidence, limits, motor, reference angle, getJointAngle, collideConnected
- `tests/constraints/MouseConstraint.test.ts` - 5 tests: movement, convergence, maxForce, setTarget, rotation

## Decisions Made
- RevoluteConstraint constructor takes worldAnchor (not local anchors) for ergonomic API -- converts to local-space internally
- MouseConstraint references body as both bodyA and bodyB for Constraint interface compatibility
- Default maxForce = 1000 * body.mass prevents need for manual tuning in most cases
- Baumgarte beta=0.2 for revolute point constraint matches existing DistanceConstraint convention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four constraint types complete and tested
- Phase 4 (Constraints) fully done -- ready for Phase 5 (Renderer)
- 248 total tests passing with zero regressions

---
*Phase: 04-constraints*
*Completed: 2026-02-22*
