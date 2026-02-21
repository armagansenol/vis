# Phase 1: Foundation - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Math primitives (Vec2, Mat2, AABB), shape geometry (circle, box, convex polygon), and rigid body representation with semi-implicit Euler integration under forces and gravity. No collision detection, no solver, no rendering — just bodies moving through space.

</domain>

<decisions>
## Implementation Decisions

### Math API Design
- Vec2 operations are **mutable (in-place)** — `vec.add(other)` modifies `vec` and returns it for chaining. Less GC pressure, critical for a physics engine's hot loop.
- Export **user-friendly math utilities** beyond what the engine needs internally — lerp, random range, angle conversions, clamp. Users building games/simulations will want these.

### Shape Representation
- Convex polygons accept **both raw vertices AND factory helpers** — `Polygon.fromVertices([...])` and `Polygon.regular(sides, radius)` etc.
- Shapes support a **local offset** from body center — prepares for compound bodies in v2 without a refactor.

### Body Creation API
- **Sensible physics defaults** for new bodies — dynamic type, density=1, friction=0.3, restitution=0.2, gravity scale=1. Users shouldn't need to configure everything for basic usage.

### Project Setup
- Source organized **by domain** — `src/math/`, `src/collision/`, `src/dynamics/`, `src/render/` mirroring the architecture layers.
- Library exports via **both** single entry (`import { World, Body, Vec2 } from 'vis'`) and subpath exports (`import { Vec2 } from 'vis/math'`) for tree-shaking.
- **bun** as package manager.
- **Vite dev server** for demo development with HMR.

### Claude's Discretion
- Vec2 structure (class with methods vs plain objects + functions) — pick what's best for a physics engine
- Convexity validation strategy (throw error vs compute convex hull)
- Shape-to-body relationship model (one-to-one vs contained property)
- Body type specification approach (enum, factory methods, or mass-based)
- World-body ownership model (addBody vs createBody)
- Numerical precision handling (epsilon strategy)
- Mat2 API surface

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The user deferred most implementation details to Claude's judgment, focusing on the key ergonomic decisions: mutable math, sensible defaults, domain-organized code, and bun + Vite tooling.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-21*
