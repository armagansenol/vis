# Phase 4: Constraints - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Bodies can be connected with joints and springs that the solver enforces alongside contact constraints. This phase delivers four constraint types: distance (rigid), spring (elastic), revolute joint (hinge with optional limits), and mouse constraint (interactive dragging). No new constraint types beyond these four.

</domain>

<decisions>
## Implementation Decisions

### Constraint API surface
- Claude's discretion on API style (standalone classes vs factory methods) — pick what fits existing codebase patterns
- Claude's discretion on anchor point specification (local-space vs world-space auto-convert) — follow physics engine conventions
- Claude's discretion on parameter mutability — decide based on what demos and mouse constraint require
- Claude's discretion on constraint architecture (common interface vs independent types) — integrate cleanly with existing solver

### Spring behavior
- Claude's discretion on parameter model (frequency/damping ratio vs raw stiffness/damping) — pick the most practical approach
- Claude's discretion on rest length defaults (auto from initial distance vs explicit)
- Claude's discretion on max force capping for stability
- Claude's discretion on whether distance and spring are separate classes or unified with stiffness parameter

### Revolute joint limits
- Claude's discretion on motor support — decide based on Phase 6 demo needs (ragdoll)
- Claude's discretion on limit feel (hard stops vs soft compliance)
- Claude's discretion on reference angle computation (auto from initial pose vs explicit)
- Claude's discretion on runtime constraint removal — decide based on demo requirements

### Mouse constraint feel
- Claude's discretion on drag stiffness (stiff vs soft elastic following)
- Claude's discretion on max force capping
- Claude's discretion on attach point (click point vs center of mass)
- Claude's discretion on lifecycle (auto-destroy on release vs persist)

### Claude's Discretion
All implementation decisions for this phase are at Claude's discretion. The user trusts Claude to make standard physics engine choices across all four areas: API design, spring model, revolute joint behavior, and mouse constraint interaction. Claude should follow established conventions from engines like Box2D, Matter.js, and similar references.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow conventions from established 2D physics engines (Box2D, Matter.js, Planck.js) for all constraint types.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-constraints*
*Context gathered: 2026-02-22*
