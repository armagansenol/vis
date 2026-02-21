# vis

## What This Is

A 2D physics engine written in TypeScript from scratch. It handles rigid body dynamics, collision detection and resolution, constraints (joints, springs), and force simulation with a built-in Canvas renderer. Built for learning, control, and performance — a general-purpose library usable for web animations, games, and simulations.

## Core Value

A correct, performant rigid body physics simulation that you fully understand and control because you built every line of it.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Rigid body simulation (rectangles, circles, convex polygons) with mass, velocity, angular velocity
- [ ] Collision detection with SAT and AABB broadphase
- [ ] Collision resolution with contact points, restitution, and friction
- [ ] Constraints system — distance joints, springs, pin joints
- [ ] Gravity, applied forces, impulses
- [ ] Built-in Canvas 2D renderer
- [ ] Deterministic fixed-timestep simulation loop
- [ ] Classic demo scenes — stacking boxes, bouncing balls, Newton's cradle, ragdoll

### Out of Scope

- Continuous collision detection (CCD) — adds significant complexity, not needed for v1
- Soft body physics — different domain, v2+ consideration
- 3D — this is a 2D engine
- WebGL renderer — Canvas is sufficient for v1
- ECS architecture — may consider later, keep it simple for now
- Mobile touch input handling — renderer concern, not physics engine

## Context

- The project name is "vis"
- Inspired by Matter.js but built from scratch for deep understanding
- TypeScript with full type declarations for consumers
- API style to be decided during implementation — no premature commitment
- Target: modern browsers, ES module distribution
- Classic demos serve as both integration tests and showcase

## Constraints

- **Language**: TypeScript — full type safety, published with .d.ts declarations
- **Runtime**: Browser (Canvas 2D API for rendering)
- **Architecture**: Physics engine core must be renderer-independent internally, even though a Canvas renderer ships with it
- **No dependencies**: Zero runtime dependencies — everything from scratch

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript | Type safety + learning value | — Pending |
| Canvas 2D renderer included | Immediate visual feedback for development and demos | — Pending |
| Zero dependencies | Full understanding of every line, no black boxes | — Pending |
| API style deferred | Decide after core is working, informed by real usage | — Pending |

---
*Last updated: 2026-02-21 after initialization*
