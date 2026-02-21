# Phase 3: Solver and Engine Loop - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Make colliding bodies respond physically — bouncing with restitution, sliding with Coulomb friction, and stacking stably. Build the sequential impulses constraint solver with warm starting and position correction, plus the fixed-timestep engine loop that drives the full simulation step (integrate → broadphase → narrowphase → solve → correct). No constraints/joints (Phase 4), no rendering (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Solver tuning constants
- Claude's discretion on all solver tuning: iteration count, Baumgarte slop/bias values, position correction approach (Baumgarte vs split impulses), velocity thresholds
- Claude's discretion on whether constants are configurable per-world or module-level defaults
- Claude's discretion on sleeping bodies (sleep/wake vs always simulate)

### Claude's Discretion
- Solver iteration count (Box2D uses 8 as default — Claude can choose based on stability needs)
- Position correction strategy (Baumgarte stabilization vs split impulses)
- Whether solver constants are configurable at runtime (per-world) or fixed module defaults
- Whether sleeping bodies are implemented (engine targets < 500 bodies, so sleeping is optional)
- Fixed timestep rate and max accumulated steps per frame
- Restitution cutoff velocity (below which bouncing is suppressed)
- Friction model details (Coulomb with tangent impulse clamping)
- Material mixing strategy (already started in Phase 2 manifold — geometric mean friction, max restitution)
- Engine step API design (what world.step() looks like, gravity config)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The user trusts Claude to make physics-engine-conventional choices across all solver and engine loop decisions. Key context: engine targets < 500 bodies (from Phase 2), so favor correctness and simplicity over extreme optimization.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-solver-and-engine-loop*
*Context gathered: 2026-02-21*
