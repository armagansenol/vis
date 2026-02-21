# Phase 2: Collision Detection - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect all collisions between rigid bodies, produce accurate contact data (points, normals, penetration depth), cache manifolds across frames, and fire contact events. This phase builds the full detection pipeline — broadphase culling, narrowphase SAT/circle tests, manifold management, and event dispatch. No solver response (Phase 3), no constraints (Phase 4), no rendering (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Broadphase strategy
- Target body count: hundreds (< 500) — broadphase can be simple and correct over hyper-optimized
- Claude's discretion: cell sizing strategy (fixed vs auto), rebuild vs incremental, static body handling

### Contact data design
- Up to 2 contact points per manifold — handles edge-edge and flat-on-flat contacts for stable 2D stacking
- Claude's discretion: manifold persistence strategy, body pair identification scheme, friction/restitution mixing location

### Collision filtering
- Sensor bodies supported — bodies with a sensor flag detect overlap and fire events but produce no collision response
- Claude's discretion: filtering mechanism (bitmask categories, groups, or none), pair exclusion, static-static skip rules

### Event system design
- Claude's discretion: dispatch pattern (callbacks vs event queue), event data richness, sensor event separation, preSolve callback inclusion

### Claude's Discretion
- Broadphase cell sizing, rebuild strategy, and static body handling
- Manifold persistence and warm-starting preparation for Phase 3
- Contact pair identification scheme
- Friction/restitution mixing location (contact vs solver)
- Collision filtering approach (bitmask, groups, or deferred)
- Pair exclusion lists for jointed bodies (Phase 4 forward-thinking)
- Static-static collision skip rules
- Event dispatch pattern and data payload
- Sensor event API (same events vs separate)
- Whether to include preSolve callback

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The user trusts Claude to make physics-engine-conventional choices across all areas. Key constraint: engine targets < 500 bodies, so favor simplicity and correctness over raw performance.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-collision-detection*
*Context gathered: 2026-02-21*
