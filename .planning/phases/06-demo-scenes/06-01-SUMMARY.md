---
phase: 06-demo-scenes
plan: 01
subsystem: ui
tags: [canvas, dark-theme, mouse-interaction, demo, physics-visualization]

# Dependency graph
requires:
  - phase: 05-renderer
    provides: Renderer with Y-up coordinate system, DebugRenderer overlays, RenderOptions
  - phase: 04-constraints
    provides: MouseConstraint, DistanceConstraint, RevoluteConstraint
  - phase: 03-solver
    provides: World with fixed-timestep accumulator, ContactSolver
provides:
  - Dark-themed demo page shell with tab navigation, sidebar controls, canvas, mouse interaction
  - Stacking boxes scene factory (10 boxes on static ground with gravity slider)
  - Bouncing balls scene factory (5 circles with staggered drop and restitution variation)
  - Scene management infrastructure (switchScene, cleanup, tab switching)
  - Point-in-shape hit testing for circle and convex polygon bodies
  - Drag visual feedback overlay (line + body highlight)
affects: [06-demo-scenes]

# Tech tracking
tech-stack:
  added: []
  patterns: [scene-factory-pattern, custom-rAF-loop, screen-to-world-transform, point-in-shape-hit-testing]

key-files:
  created:
    - examples/index.html
    - examples/demos/stacking.ts
    - examples/demos/bouncing.ts
  modified:
    - src/engine/World.ts

key-decisions:
  - "Demo page runs its own rAF loop instead of Renderer.start() for post-draw overlay control"
  - "Added public gravity getter to World for runtime parameter tweaking"
  - "Scene factories return DemoScene objects with create/cleanup/tweaks for lifecycle management"

patterns-established:
  - "Scene factory pattern: export function returning DemoScene { name, create, cleanup, tweaks }"
  - "Custom rAF loop: world.step(dt) + renderer.draw(alpha) + drawDragFeedback() for overlay control"
  - "screenToWorld inverse transform matching Renderer Y-up: wx = (sx - offsetX) / scale, wy = (height - offsetY - sy) / scale"

requirements-completed: [DEMO-01, DEMO-02]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 6 Plan 1: Demo Page Shell + First Two Scenes Summary

**Dark-themed demo page with tabbed navigation, mouse drag interaction, and stacking boxes / bouncing balls scene factories**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T10:22:01Z
- **Completed:** 2026-02-22T10:26:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Polished dark-themed demo page at examples/index.html with 4-tab navigation, sidebar controls, and 800x600 canvas
- Full mouse drag interaction: point-in-shape hit testing, MouseConstraint lifecycle, drag line + body highlight overlay
- Stacking boxes demo: 10 boxes with low restitution settling on static ground with walls and gravity slider
- Bouncing balls demo: 5 circles dropped at 600ms intervals with restitution 0.2-0.9 showing different bounce heights

## Task Commits

Each task was committed atomically:

1. **Task 1: Demo page shell with tabs, sidebar, canvas, mouse interaction, dark theme** - `6a44c74` (feat)
2. **Task 2: Stacking boxes and bouncing balls scene factories** - `e668bcd` (feat)

## Files Created/Modified
- `examples/index.html` - Demo page shell with dark theme, tab navigation, sidebar controls, canvas, mouse interaction, custom rAF loop
- `examples/demos/stacking.ts` - Stacking boxes scene factory with gravity slider tweak
- `examples/demos/bouncing.ts` - Bouncing balls scene factory with staggered drop and drop height tweak
- `src/engine/World.ts` - Added public gravity getter for runtime parameter tweaking

## Decisions Made
- Demo page drives its own rAF loop (not Renderer.start()) to enable post-draw overlay for drag feedback
- Added World.gravity getter since settings was private -- needed for gravity slider tweak
- Scene factories use closure pattern to capture world reference for tweaks onChange callbacks
- Bouncing balls uses setTimeout with disposed flag guard for clean timer cleanup on scene switch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added public gravity getter to World**
- **Found during:** Task 1 (Demo page shell)
- **Issue:** World.settings is private, no way to modify gravity at runtime for the gravity slider tweak
- **Fix:** Added `get gravity()` accessor to World class returning the internal settings.gravity Vec2
- **Files modified:** src/engine/World.ts
- **Verification:** TypeScript compiles, gravity slider can modify world.gravity.y at runtime
- **Committed in:** 6a44c74 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed scene cleanup targeting wrong scene on tab switch**
- **Found during:** Task 2 (Scene factories)
- **Issue:** Tab click handler set currentSceneIndex before calling switchScene, so cleanup() was called on the new scene instead of the old one
- **Fix:** Added activeScene tracking variable, cleanup references activeScene instead of scenes[currentSceneIndex]
- **Files modified:** examples/index.html
- **Verification:** Tab switching correctly cleans up previous scene timers
- **Committed in:** e668bcd (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Demo infrastructure complete: tab switching, sidebar controls, mouse interaction, scene lifecycle
- Plan 02 only needs to add Newton's Cradle and Ragdoll scene factory functions
- Stub scenes already in place for cradle and ragdoll tabs

---
*Phase: 06-demo-scenes*
*Completed: 2026-02-22*
