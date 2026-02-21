# Requirements: vis

**Defined:** 2026-02-21
**Core Value:** A correct, performant rigid body physics simulation that you fully understand and control because you built every line of it.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Math & Foundation

- [x] **MATH-01**: Vec2 class with add, sub, scale, dot, cross, normalize, length, rotate, perpendicular operations
- [x] **MATH-02**: Mat2 class for 2D rotation matrices
- [x] **MATH-03**: AABB (axis-aligned bounding box) with overlap test and combine operations
- [x] **MATH-04**: Common math utilities (clamp, lerp, approximately-equal with epsilon)

### Body Simulation

- [x] **BODY-01**: Rigid body with position, velocity, angular velocity, mass, inertia, and inverse mass/inertia
- [x] **BODY-02**: Static body type (infinite mass, zero velocity, participates in collision)
- [x] **BODY-03**: Dynamic body type (affected by forces, gravity, collisions)
- [x] **BODY-04**: Kinematic body type (user-controlled velocity, not affected by forces)
- [x] **BODY-05**: Semi-implicit Euler integration for position and rotation updates
- [ ] **BODY-06**: Fixed timestep simulation loop with accumulator pattern and interpolation
- [x] **BODY-07**: User can apply force at arbitrary world point (creating torque)
- [x] **BODY-08**: User can apply impulse at arbitrary world point (instant velocity change)
- [x] **BODY-09**: Per-shape material properties: density (derives mass from area), friction coefficient, restitution (0-1)
- [x] **BODY-10**: Gravity as global acceleration with per-body gravity scale override

### Shapes

- [x] **SHAP-01**: Circle shape with radius, center offset, and area/inertia computation
- [x] **SHAP-02**: Box/rectangle shape as a special case of convex polygon
- [x] **SHAP-03**: Convex polygon shape with vertex winding, support function, area/inertia computation

### Collision Detection

- [x] **COLL-01**: AABB broadphase using spatial hash grid producing candidate pairs
- [ ] **COLL-02**: SAT narrowphase for polygon-polygon collision with minimum penetration axis
- [ ] **COLL-03**: Circle-circle collision detection (fast path)
- [ ] **COLL-04**: Circle-polygon collision detection
- [ ] **COLL-05**: Contact manifold generation with contact points, normal, and penetration depth
- [x] **COLL-06**: Collision filtering via category/mask bitmask (body A collides with B if categories & masks match)

### Solver

- [ ] **SOLV-01**: Sequential impulses (iterative PGS) velocity solver with configurable iteration count
- [ ] **SOLV-02**: Normal impulse resolution with restitution (bounciness)
- [ ] **SOLV-03**: Tangential friction impulse with Coulomb friction model
- [ ] **SOLV-04**: Position correction via Baumgarte stabilization to resolve penetration
- [ ] **SOLV-05**: Accumulated impulse clamping (not per-iteration clamping)
- [ ] **SOLV-06**: Warm starting — cache and reapply impulses from previous frame via contact persistence

### Constraints

- [ ] **CONS-01**: Distance constraint — maintain fixed distance between two body anchor points
- [ ] **CONS-02**: Spring constraint — elastic distance with configurable stiffness and damping
- [ ] **CONS-03**: Revolute/pin joint — two bodies share a hinge point, free rotation, optional angle limits
- [ ] **CONS-04**: Mouse/pointer constraint — spring from body point to mouse position for interactive dragging

### Events

- [ ] **EVNT-01**: beginContact event fired when two bodies start colliding (with body refs and contact data)
- [ ] **EVNT-02**: endContact event fired when two bodies stop colliding

### Rendering

- [ ] **RNDR-01**: Canvas 2D renderer that draws bodies as their shape (circles, polygons)
- [ ] **RNDR-02**: Debug drawing mode showing AABBs, contact points, contact normals, constraint connections
- [ ] **RNDR-03**: Render interpolation between physics steps for smooth visuals at any frame rate

### Demos

- [ ] **DEMO-01**: Stacking boxes demo — boxes stacked on a static ground, testing solver stability
- [ ] **DEMO-02**: Bouncing balls demo — circles with varied restitution falling and bouncing
- [ ] **DEMO-03**: Newton's cradle demo — pendulum balls using distance constraints
- [ ] **DEMO-04**: Ragdoll demo — linked body segments using revolute joints

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Physics

- **ADVP-01**: Body sleeping — pause simulation for resting bodies (velocity below threshold for N frames)
- **ADVP-02**: Island solver — group connected bodies, solve independently, enable island-based sleeping
- **ADVP-03**: Sensors — trigger shapes that detect overlap but skip collision response
- **ADVP-04**: Ray casting — cast ray, find first intersection with hit point, normal, fraction, body
- **ADVP-05**: Point/AABB queries — find bodies at a point or overlapping a rectangle
- **ADVP-06**: Compound bodies — multiple shapes attached to one body with combined mass/inertia
- **ADVP-07**: Sub-stepping — multiple physics sub-steps per frame for stability with fast objects

### Additional Constraints

- **ACONS-01**: Prismatic (slider) constraint — bodies slide along an axis with optional limits/motor
- **ACONS-02**: Weld constraint — rigidly attach two bodies

### Additional Demos

- **ADEMO-01**: Car demo with revolute joints and motor
- **ADEMO-02**: Piston mechanism demo
- **ADEMO-03**: Cloth approximation using spring grids

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Continuous Collision Detection (CCD) | Research-level problem, enormous complexity. Use sub-stepping and velocity caps instead. |
| Concave polygon decomposition | Separate algorithm with many edge cases. Support compound bodies of convex parts instead. |
| Soft body physics | Different simulation domain (mass-spring or FEM), not rigid body physics. |
| 3D support | Different algorithms everywhere (GJK/EPA, quaternions, 6 DOF). 10x complexity for a different product. |
| WebGL renderer | Renderer complexity explodes. Canvas 2D sufficient for thousands of bodies. |
| ECS architecture | Premature abstraction. Simple class hierarchy is direct and debuggable. |
| Gear joints | Niche use case, complex constraint math. Approximate with motor-driven revolute joints. |
| Fluid/particle simulation | Entirely different simulation domain (SPH or position-based dynamics). |
| Built-in game loop/runner | Couples engine to frame timing. Users call world.step(dt) from their own loop. |
| Wheel joint | Specialized combined joint. Approximate with revolute + spring for v1. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MATH-01 | Phase 1 | Complete |
| MATH-02 | Phase 1 | Complete |
| MATH-03 | Phase 1 | Complete |
| MATH-04 | Phase 1 | Complete |
| BODY-01 | Phase 1 | Complete |
| BODY-02 | Phase 1 | Complete |
| BODY-03 | Phase 1 | Complete |
| BODY-04 | Phase 1 | Complete |
| BODY-05 | Phase 1 | Complete |
| BODY-06 | Phase 3 | Pending |
| BODY-07 | Phase 1 | Complete |
| BODY-08 | Phase 1 | Complete |
| BODY-09 | Phase 1 | Complete |
| BODY-10 | Phase 1 | Complete |
| SHAP-01 | Phase 1 | Complete |
| SHAP-02 | Phase 1 | Complete |
| SHAP-03 | Phase 1 | Complete |
| COLL-01 | Phase 2 | Complete |
| COLL-02 | Phase 2 | Pending |
| COLL-03 | Phase 2 | Pending |
| COLL-04 | Phase 2 | Pending |
| COLL-05 | Phase 2 | Pending |
| COLL-06 | Phase 2 | Complete |
| EVNT-01 | Phase 2 | Pending |
| EVNT-02 | Phase 2 | Pending |
| SOLV-01 | Phase 3 | Pending |
| SOLV-02 | Phase 3 | Pending |
| SOLV-03 | Phase 3 | Pending |
| SOLV-04 | Phase 3 | Pending |
| SOLV-05 | Phase 3 | Pending |
| SOLV-06 | Phase 3 | Pending |
| CONS-01 | Phase 4 | Pending |
| CONS-02 | Phase 4 | Pending |
| CONS-03 | Phase 4 | Pending |
| CONS-04 | Phase 4 | Pending |
| RNDR-01 | Phase 5 | Pending |
| RNDR-02 | Phase 5 | Pending |
| RNDR-03 | Phase 5 | Pending |
| DEMO-01 | Phase 6 | Pending |
| DEMO-02 | Phase 6 | Pending |
| DEMO-03 | Phase 6 | Pending |
| DEMO-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after roadmap creation*
