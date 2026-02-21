---
phase: 02-collision-detection
plan: 01
subsystem: collision
tags: [spatial-hash, broadphase, bitmask, collision-filter, aabb]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Body, AABB, Shape, Vec2, BodyType"
provides:
  - "SpatialHash broadphase for AABB pair collection"
  - "shouldCollide bitmask + static-static filter"
  - "Body.id auto-incrementing identity"
  - "Body.isSensor, categoryBits, maskBits fields"
affects: [02-collision-detection, 03-solver]

# Tech tracking
tech-stack:
  added: []
  patterns: ["spatial hash grid with integer key hashing", "bitmask collision filtering"]

key-files:
  created:
    - src/collision/SpatialHash.ts
    - src/collision/CollisionFilter.ts
    - src/collision/index.ts
    - tests/collision/CollisionFilter.test.ts
    - tests/collision/SpatialHash.test.ts
  modified:
    - src/dynamics/Body.ts
    - src/index.ts

key-decisions:
  - "Self-pair rejection in queryPairs to handle hash key collisions between different cell coordinates"
  - "String-based pair deduplication with ordered ID keys (min:max)"

patterns-established:
  - "Body.resetIdCounter() for test isolation of auto-incrementing IDs"
  - "Filter predicate passed to broadphase queryPairs for decoupled filtering"

requirements-completed: [COLL-01, COLL-06]

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 2 Plan 1: Collision Infrastructure Summary

**Spatial hash broadphase with bitmask collision filtering and Body identity fields (id, isSensor, categoryBits, maskBits)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T11:33:40Z
- **Completed:** 2026-02-21T11:38:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Body extended with auto-incrementing id, isSensor, categoryBits, maskBits fields
- SpatialHash broadphase correctly identifies overlapping AABB candidate pairs with deduplication
- shouldCollide filter enforces bitmask rules and static-static pair rejection
- 19 new tests (12 CollisionFilter + 7 SpatialHash), 147 total tests all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Body with collision identity fields** - `49f40f8` (feat)
2. **Task 2: Implement spatial hash broadphase** - `48f1cef` (feat)

## Files Created/Modified
- `src/dynamics/Body.ts` - Added id, isSensor, categoryBits, maskBits fields + resetIdCounter
- `src/collision/SpatialHash.ts` - Spatial hash grid broadphase with insert, clear, queryPairs
- `src/collision/CollisionFilter.ts` - shouldCollide bitmask + static-static filter
- `src/collision/index.ts` - Barrel exports for collision module
- `src/index.ts` - Added collision module re-export
- `tests/collision/CollisionFilter.test.ts` - 12 tests for body fields and filter logic
- `tests/collision/SpatialHash.test.ts` - 7 tests for broadphase correctness

## Decisions Made
- Added self-pair rejection (`a.id === b.id` check) in SpatialHash.queryPairs to handle hash key collisions where different (cx, cy) coordinates map to the same integer key, causing a body to appear multiple times in one cell array
- Used string-based Set with `min:max` ID keys for pair deduplication (simple, correct)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed self-pair in SpatialHash due to hash key collisions**
- **Found during:** Task 2 (SpatialHash implementation)
- **Issue:** The integer hash function `((cx * 92837111) ^ (cy * 689287499)) | 0` can produce identical keys for different (cx, cy) pairs. When a body spans multiple cells that hash-collide, it appears multiple times in the same cell array, causing self-pairing (body paired with itself).
- **Fix:** Added `if (a.id === b.id) continue;` guard before deduplication check in queryPairs.
- **Files modified:** src/collision/SpatialHash.ts
- **Verification:** All SpatialHash tests pass including multi-cell spanning tests.
- **Committed in:** 48f1cef (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential correctness fix for hash collision edge case. No scope creep.

## Issues Encountered
None beyond the hash collision bug documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Broadphase pipeline complete: insert bodies -> queryPairs with filter -> get candidate pairs
- Ready for Plan 02 (narrow phase SAT/GJK collision detection) to consume candidate pairs
- Body identity fields ready for contact manifold tracking

---
*Phase: 02-collision-detection*
*Completed: 2026-02-21*
