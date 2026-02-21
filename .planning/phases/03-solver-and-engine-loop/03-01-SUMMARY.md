---
phase: 03-solver-and-engine-loop
plan: 01
subsystem: physics
tags: [sequential-impulse, constraint-solver, friction, restitution, warm-starting, baumgarte]

# Dependency graph
requires:
  - phase: 02-collision-detection
    provides: "Manifold[] with ContactPoint (normalImpulse/tangentImpulse for warm-starting)"
  - phase: 01-math-and-dynamics
    provides: "Body with invMass/invInertia, Vec2 math"
provides:
  - "ContactSolver class with preStep/solve lifecycle"
  - "SolverConstants configuration interface with defaults"
  - "Barrel exports from src/solver/index.ts"
affects: [03-02-engine-loop, 04-constraints]

# Tech tracking
tech-stack:
  added: []
  patterns: [sequential-impulse-solver, accumulated-clamping, warm-starting, baumgarte-stabilization]

key-files:
  created:
    - src/solver/ContactSolver.ts
    - src/solver/SolverConstants.ts
    - src/solver/index.ts
    - tests/solver/ContactSolver.test.ts
  modified: []

key-decisions:
  - "Box2D impulse formula: lambda = normalMass * (-vn + bias) with positive bias for both Baumgarte and restitution"
  - "Compute restitution velocity BEFORE warm-start application in preStep"
  - "Inline x/y arithmetic in solve() hot loop to avoid GC pressure from Vec2 allocations"

patterns-established:
  - "Solver lifecycle: preStep(manifolds, dt) -> solve() x N -> postStep() (implicit via in-place mutation)"
  - "Accumulated clamping: store running total on ContactPoint, compute delta per iteration"

requirements-completed: [SOLV-01, SOLV-02, SOLV-03, SOLV-04, SOLV-05, SOLV-06]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 3 Plan 1: Sequential Impulse Contact Solver Summary

**Sequential impulse constraint solver with normal/friction resolution, accumulated clamping, Baumgarte stabilization, and warm-starting from cached impulses**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T14:58:19Z
- **Completed:** 2026-02-21T15:02:31Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 4

## Accomplishments
- ContactSolver resolves normal impulses with configurable restitution (e=0 inelastic to e=1 elastic)
- Coulomb friction model clamps tangent impulse to mu * normalImpulse cone
- Baumgarte position correction pushes overlapping bodies apart with penetration slop dead-zone
- Accumulated impulse clamping (not per-iteration) ensures normalImpulse >= 0 invariant
- Warm-starting applies cached impulses from previous frame before solve iterations
- 10 comprehensive tests covering all solver behaviors

## Task Commits

Each task was committed atomically:

1. **TDD RED: Failing tests for ContactSolver** - `e2da574` (test)
2. **TDD GREEN: Implement ContactSolver** - `5427a36` (feat)

_TDD plan: RED wrote 10 failing tests, GREEN implemented solver to pass all._

## Files Created/Modified
- `src/solver/ContactSolver.ts` - Sequential impulse constraint solver with preStep/solve lifecycle
- `src/solver/SolverConstants.ts` - Interface and defaults for solver tuning (iterations, beta, slop)
- `src/solver/index.ts` - Barrel exports for solver module
- `tests/solver/ContactSolver.test.ts` - 10 tests covering normal, friction, warm-start, clamping, Baumgarte, static body

## Decisions Made
- Used Box2D impulse formula `lambda = normalMass * (-vn + bias)` where bias is always positive for both Baumgarte correction and restitution bounce
- Compute relative velocity for restitution BEFORE applying warm-start impulses (matches Box2D behavior for correct bounce calculation)
- Inline x/y arithmetic throughout solve() instead of Vec2 method calls to avoid heap allocations in the hot loop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected impulse formula sign convention**
- **Found during:** TDD GREEN (implementation)
- **Issue:** Initial formula `lambda = normalMass * (-(vn + bias))` produced negative impulses for Baumgarte correction and incorrect bounce direction
- **Fix:** Changed to `lambda = normalMass * (-vn + bias)` matching Box2D reference implementation
- **Files modified:** src/solver/ContactSolver.ts
- **Verification:** All 10 tests pass including Baumgarte and bounce tests
- **Committed in:** 5427a36 (part of GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential correctness fix during implementation. No scope creep.

## Issues Encountered
None beyond the sign convention fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ContactSolver ready for integration into engine step loop (03-02)
- SolverConstants can be passed to tune iteration count and stabilization parameters
- All 214 existing tests pass (no regressions)

---
*Phase: 03-solver-and-engine-loop*
*Completed: 2026-02-21*
