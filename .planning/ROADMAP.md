# Roadmap: vis

## Overview

Build a 2D rigid body physics engine bottom-up, from math primitives through collision detection, solver, constraints, rendering, and demo scenes. Each phase delivers a complete, testable layer that the next phase depends on. The strict dependency chain (math -> geometry -> bodies -> collision -> solver -> constraints -> renderer -> demos) means phases execute sequentially with no shortcuts.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Math primitives, shape geometry, and rigid body representation
- [ ] **Phase 2: Collision Detection** - Broadphase, narrowphase, contact manifolds, and collision events
- [ ] **Phase 3: Solver and Engine Loop** - Sequential impulses solver with warm starting, fixed-timestep simulation loop
- [ ] **Phase 4: Constraints** - Distance joints, springs, revolute joints, and mouse constraint
- [ ] **Phase 5: Renderer** - Canvas 2D renderer with debug drawing and frame interpolation
- [ ] **Phase 6: Demo Scenes** - Four canonical demos that validate the full engine stack

## Phase Details

### Phase 1: Foundation
**Goal**: Users can create rigid bodies with shapes, apply forces and impulses, and bodies integrate correctly under gravity using semi-implicit Euler
**Depends on**: Nothing (first phase)
**Requirements**: MATH-01, MATH-02, MATH-03, MATH-04, SHAP-01, SHAP-02, SHAP-03, BODY-01, BODY-02, BODY-03, BODY-04, BODY-05, BODY-07, BODY-08, BODY-09, BODY-10
**Success Criteria** (what must be TRUE):
  1. Vec2 and Mat2 operations produce correct results for all standard operations (add, sub, dot, cross, rotate, normalize)
  2. Circle, box, and convex polygon shapes compute correct area and moment of inertia
  3. A dynamic body with gravity applied updates position and velocity correctly each integration step using semi-implicit Euler
  4. Applying a force at an off-center world point creates both linear acceleration and angular torque
  5. Static and kinematic bodies do not respond to forces or gravity; kinematic bodies move at user-set velocity
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffolding + math primitives (Vec2, Mat2, AABB, utils)
- [ ] 01-02-PLAN.md — Shape geometry (Circle, Convex Polygon, Box factory, materials)
- [ ] 01-03-PLAN.md — Rigid body, integration, forces/impulses, barrel exports

### Phase 2: Collision Detection
**Goal**: The engine detects all collisions between bodies, produces accurate contact data, and fires contact events
**Depends on**: Phase 1
**Requirements**: COLL-01, COLL-02, COLL-03, COLL-04, COLL-05, COLL-06, EVNT-01, EVNT-02
**Success Criteria** (what must be TRUE):
  1. Spatial hash broadphase correctly identifies overlapping AABB pairs and eliminates non-overlapping pairs
  2. SAT narrowphase detects polygon-polygon collisions and returns correct minimum penetration axis and depth for rotated shapes
  3. Circle-circle and circle-polygon collisions produce accurate contact points and normals
  4. Contact manifolds persist across frames (contact caching by body-pair ID) enabling warm starting in Phase 3
  5. beginContact and endContact events fire at the correct frames when collisions start and stop
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Solver and Engine Loop
**Goal**: Colliding bodies respond physically correct -- they bounce, slide with friction, and stack stably under the fixed-timestep simulation loop
**Depends on**: Phase 2
**Requirements**: SOLV-01, SOLV-02, SOLV-03, SOLV-04, SOLV-05, SOLV-06, BODY-06
**Success Criteria** (what must be TRUE):
  1. A ball dropped onto a static floor bounces to a height proportional to its restitution coefficient
  2. A box on a tilted surface slides or stays put based on friction coefficient (Coulomb friction model)
  3. A stack of 5+ boxes on a static ground settles and remains stable (warm starting and accumulated impulse clamping working)
  4. The simulation produces identical results regardless of rendering frame rate (fixed timestep with accumulator pattern)
  5. Penetrating bodies are pushed apart over time without visible jitter (Baumgarte position correction)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Constraints
**Goal**: Bodies can be connected with joints and springs that the solver enforces alongside contact constraints
**Depends on**: Phase 3
**Requirements**: CONS-01, CONS-02, CONS-03, CONS-04
**Success Criteria** (what must be TRUE):
  1. Two bodies connected by a distance constraint maintain fixed separation regardless of forces applied
  2. A spring constraint produces oscillating elastic behavior with configurable stiffness and damping
  3. A revolute joint allows free rotation around a shared hinge point and respects optional angle limits
  4. Dragging a body with the mouse constraint moves it smoothly with spring-like following behavior
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Renderer
**Goal**: The physics simulation is visible on screen with smooth rendering and optional debug overlays
**Depends on**: Phase 3
**Requirements**: RNDR-01, RNDR-02, RNDR-03
**Success Criteria** (what must be TRUE):
  1. All body shapes (circles, boxes, convex polygons) render correctly at their physics positions and rotations
  2. Debug mode displays AABBs, contact points, contact normals, and constraint connections as overlays
  3. Bodies move smoothly on screen at any monitor refresh rate due to render interpolation between physics steps
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Demo Scenes
**Goal**: Four canonical demos validate the full engine and serve as both integration tests and library showcase
**Depends on**: Phase 4, Phase 5
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04
**Success Criteria** (what must be TRUE):
  1. Stacking boxes demo: 10+ boxes stacked on static ground settle into a stable pile without collapse or jitter
  2. Bouncing balls demo: circles with varied restitution values (0.2 to 0.9) bounce to visibly different heights
  3. Newton's cradle demo: releasing one ball transfers momentum through the chain, last ball swings out correctly
  4. Ragdoll demo: linked body segments swing naturally under gravity with revolute joints at each connection
  5. All demos run in a browser via Vite dev server with interactive mouse dragging
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Collision Detection | 0/3 | Not started | - |
| 3. Solver and Engine Loop | 0/3 | Not started | - |
| 4. Constraints | 0/2 | Not started | - |
| 5. Renderer | 0/1 | Not started | - |
| 6. Demo Scenes | 0/2 | Not started | - |
