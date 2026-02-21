---
phase: 01-foundation
plan: 01
subsystem: math
tags: [typescript, vite, vitest, bun, vec2, mat2, aabb, physics-math]

# Dependency graph
requires:
  - phase: none
    provides: "Greenfield project"
provides:
  - "Vec2 mutable 2D vector with method chaining"
  - "Mat2 2x2 rotation matrix"
  - "AABB axis-aligned bounding box with overlap/combine"
  - "Math utilities (clamp, lerp, approxEqual, degToRad, radToDeg, randomRange)"
  - "Project scaffolding with bun, Vite library mode, Vitest, TypeScript strict"
affects: [shapes, dynamics, collision, renderer]

# Tech tracking
tech-stack:
  added: [typescript 5.9, vite 6.4, vitest 3.2, vite-plugin-dts 4.5, bun 1.3]
  patterns: [mutable-vec2-chaining, barrel-exports, vite-library-mode, subpath-exports]

key-files:
  created:
    - src/math/Vec2.ts
    - src/math/Mat2.ts
    - src/math/AABB.ts
    - src/math/utils.ts
    - src/math/index.ts
    - tests/math/Vec2.test.ts
    - tests/math/Mat2.test.ts
    - tests/math/AABB.test.ts
    - tests/math/utils.test.ts
    - package.json
    - tsconfig.json
    - vite.config.ts
    - vitest.config.ts
  modified: []

key-decisions:
  - "Vec2 uses class with mutable instance methods returning this for chaining (per user decision)"
  - "AABB touching edges count as overlapping (standard physics engine convention for broadphase)"
  - "Mat2 kept minimal: fromAngle, mulVec2, transpose, identity (per research recommendation)"
  - "EPSILON = 1e-6 as engine-wide float comparison constant"

patterns-established:
  - "Mutable-with-chaining: instance methods mutate this and return this; static methods return new instances"
  - "Barrel exports: each module has index.ts re-exporting all public types"
  - "Test structure mirrors src: tests/math/*.test.ts for src/math/*.ts"

requirements-completed: [MATH-01, MATH-02, MATH-03, MATH-04]

# Metrics
duration: 4min
completed: 2026-02-21
---

# Phase 1 Plan 1: Project Scaffolding + Math Primitives Summary

**Bun/Vite/Vitest/TypeScript project with mutable Vec2, Mat2 rotation matrix, AABB broadphase box, and math utilities -- 71 tests passing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-21T09:40:18Z
- **Completed:** 2026-02-21T09:44:18Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Project scaffolded with bun, Vite library mode (multi-entry), Vitest, and TypeScript strict mode
- Vec2 with full mutable API: add, sub, scale, normalize, rotate, perpendicular, negate, copy, set, dot, cross, length, clone, plus static methods and factories
- Mat2 rotation matrix: fromAngle, mulVec2 (non-mutating), transpose (inverse rotation), identity
- AABB with overlap detection, containment check, combine, width/height/center/perimeter
- Math utilities: EPSILON, clamp, lerp, approxEqual, degToRad, radToDeg, randomRange
- 71 comprehensive tests with known analytical values all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold project** - `17721a9` (chore)
2. **Task 2: Math primitives + tests** - `4659cea` (feat)

## Files Created/Modified
- `package.json` - Project config with subpath exports for vis/math, vis/shapes, vis/dynamics
- `tsconfig.json` - TypeScript strict mode, ESNext target, bundler resolution
- `vite.config.ts` - Vite library mode with 4 entry points, vite-plugin-dts
- `vitest.config.ts` - Test runner configured with tests/ root
- `src/math/Vec2.ts` - Mutable 2D vector with method chaining (MATH-01)
- `src/math/Mat2.ts` - 2x2 rotation matrix (MATH-02)
- `src/math/AABB.ts` - Axis-aligned bounding box (MATH-03)
- `src/math/utils.ts` - Math utility functions and EPSILON (MATH-04)
- `src/math/index.ts` - Barrel export for math module
- `tests/math/Vec2.test.ts` - 31 tests for Vec2
- `tests/math/Mat2.test.ts` - 11 tests for Mat2
- `tests/math/AABB.test.ts` - 12 tests for AABB
- `tests/math/utils.test.ts` - 17 tests for utilities

## Decisions Made
- Vec2 implemented as class with mutable instance methods returning `this` (per user constraint)
- AABB touching edges count as overlapping (physics convention -- broadphase should err on the side of detecting potential collisions)
- Mat2.mulVec2 returns a new Vec2 and does NOT mutate the input (safety over performance for matrix transforms)
- EPSILON = 1e-6 as a module-level constant, not configurable per-call

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed bun (missing from system)**
- **Found during:** Task 1 (project scaffolding)
- **Issue:** `bun` command not found -- not installed on system
- **Fix:** Installed bun via official install script (curl -fsSL https://bun.sh/install)
- **Files modified:** None (system-level install)
- **Verification:** `bun --version` returns 1.3.9, `bun install` succeeds
- **Committed in:** 17721a9 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added .gitignore**
- **Found during:** Task 1 (project scaffolding)
- **Issue:** No .gitignore file -- node_modules and dist would be committed
- **Fix:** Created .gitignore with node_modules/, dist/, *.tsbuildinfo
- **Files modified:** .gitignore
- **Verification:** git status does not show node_modules or dist
- **Committed in:** 17721a9 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed test expectations for -0 and AABB edge semantics**
- **Found during:** Task 2 (math tests)
- **Issue:** Vec2 perpendicular of (1,0) produces x=-0 which fails Object.is against 0; AABB test expected touching edges to NOT overlap but physics convention is they should
- **Fix:** Used approxEqual in perpendicular test; changed AABB test to expect touching edges as overlapping
- **Files modified:** tests/math/Vec2.test.ts, tests/math/AABB.test.ts
- **Verification:** All 71 tests pass
- **Committed in:** 4659cea (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug)
**Impact on plan:** All auto-fixes necessary for correctness and project setup. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Math foundation complete -- Vec2, Mat2, AABB, and utilities ready for shapes and dynamics modules
- All 71 tests passing with TypeScript strict mode
- Plans 01-02 (shapes) and 01-03 (body/integration) can proceed

## Self-Check: PASSED

- All 13 key files verified present on disk
- Commit `17721a9` (Task 1) verified in git log
- Commit `4659cea` (Task 2) verified in git log

---
*Phase: 01-foundation*
*Completed: 2026-02-21*
