# Feature Research

**Domain:** 2D rigid body physics engine (TypeScript, from-scratch, browser-targeted)
**Researched:** 2026-02-21
**Confidence:** HIGH

Engines analyzed: Matter.js (v0.20.0), Box2D (v3.x / C), Planck.js (v1.4.3), p2.js / p2-es. These represent the full spectrum from beginner-friendly (Matter.js) to simulation-accurate (Box2D). The feature landscape below is derived from what all four engines converge on (table stakes), what only the best engines offer (differentiators), and what consistently causes pain (anti-features).

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = engine is not usable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Rigid body simulation** | The core purpose of the engine. Bodies with position, velocity, angular velocity, mass, inertia. | MEDIUM | Semi-implicit Euler integration is the standard. Must support static, dynamic, and kinematic body types. |
| **Shape primitives: circle, rectangle/box, convex polygon** | Every engine supports at minimum these three. Users build everything from them. | MEDIUM | Circles are cheapest to collide. Convex polygons use SAT. Rectangles are a special case of polygon. |
| **AABB broadphase** | Without broadphase, collision is O(n^2) and unusable beyond ~50 bodies. All engines have this. | MEDIUM | Options: spatial hash grid (simplest), sweep-and-prune (Box2D v2), dynamic AABB tree (Box2D v3). Grid is fine for v1. |
| **SAT narrowphase** | The standard 2D narrowphase algorithm for convex shapes. All JS engines use it. | HIGH | Must generate contact manifolds: contact points, normal, penetration depth. Circle-circle and circle-polygon need separate fast paths. |
| **Collision response with restitution and friction** | Without this, objects pass through each other or slide unnaturally. Every engine ships this. | HIGH | Sequential impulses solver (Erin Catto's method). Needs velocity-level impulses for restitution and Coulomb friction model. |
| **Gravity** | Global force vector. Every physics engine has this. Trivially expected. | LOW | Apply as acceleration to all dynamic bodies each step. Allow per-body gravity scale. |
| **Static bodies** | Walls, floors, platforms. Infinite mass, zero velocity. Every engine has them. | LOW | Just skip integration for static bodies. They still participate in collision detection. |
| **Fixed timestep loop** | Without deterministic stepping, simulation is unstable and frame-rate dependent. All engines use this. | LOW | Accumulator pattern: accumulate dt, step in fixed increments (e.g., 1/60s). Interpolate for rendering. |
| **Contact constraint solver** | Resolves penetration and applies friction. The heart of the engine. Every engine has one. | HIGH | Sequential impulses (iterative PGS). 4-10 iterations typical. Position correction via Baumgarte stabilization or split impulses. |
| **Material properties: density, friction, restitution** | Users need to model different materials (bouncy ball vs. heavy crate). All engines expose these per-shape. | LOW | Density derives mass from area. Friction coefficient for tangential response. Restitution (0-1) for bounciness. |
| **Force and impulse API** | Users need to push bodies around. `applyForce()`, `applyImpulse()`, `setVelocity()`. Every engine has this. | LOW | Forces accumulate over a step. Impulses change velocity instantly. Support application at arbitrary world points (creating torque). |
| **Collision filtering** | Users need to control which bodies collide. Category/mask bitmask system is universal. | LOW | 16 or 32-bit category + mask. Body A collides with Body B if `(A.category & B.mask) && (B.category & A.mask)`. |
| **Event/callback system** | `beginContact`, `endContact` at minimum. Users need to know when collisions happen for game logic. | LOW | Emit events after solver step. Provide both body references and contact data (normal, points). |
| **Built-in Canvas renderer** | Per PROJECT.md requirement. Immediate visual feedback. Matter.js ships one; Planck.js and Box2D do not (and users complain). | MEDIUM | Render bodies, shapes, constraints, contact points, AABBs. Debug drawing is essential for development. |
| **Constraint: distance/spring** | Connect two bodies at fixed or elastic distance. Every engine has this. Needed for chains, ropes, soft structures. | MEDIUM | Spring: stiffness + damping. Distance: rigid length constraint. Both are the simplest constraint type. |
| **Constraint: revolute/pin joint** | Hinge point where two bodies rotate around a shared anchor. Every engine has this. Needed for ragdolls, mechanisms. | MEDIUM | Remove 2 translational DOF, keep rotation free. Optional angle limits and motor. |

### Differentiators (Competitive Advantage)

Features that set vis apart. Not required for usability, but valued. These align with the project's Core Value of "correct, performant, fully understood."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Full TypeScript with strict types** | Matter.js is JS-only. Planck.js added TS types late. p2.js has community types. A ground-up TS engine with rich generics, discriminated unions for shapes/joints, and full IDE autocomplete is genuinely rare. | LOW | This is a build-time differentiator, not a runtime feature. But it dramatically improves DX. |
| **Body sleeping** | Pauses simulation for resting bodies. Box2D and p2.js have it. Matter.js has a basic version. Crucial for scenes with many static stacks. | MEDIUM | Track linear + angular velocity below threshold for N frames. Sleep entire islands. Wake on external contact. |
| **Warm starting** | Cache impulses from previous frame, apply at start of current frame. Makes stacking stable with fewer solver iterations. Box2D does this; Matter.js does not (hence its poor stacking). | MEDIUM | Requires contact persistence (matching contacts across frames by feature ID). Major stability improvement. |
| **Island solver** | Group connected bodies into islands, solve each independently. Enables sleeping of entire groups. Box2D and p2.js have it. | HIGH | Build contact graph, find connected components. Solve islands in parallel (or sequentially). Sleeping is per-island. |
| **Sensors (trigger shapes)** | Shapes that detect overlap but do not generate collision response. All engines support this. Needed for trigger zones, detection areas. | LOW | Simply skip solver for sensor contacts. Still fire beginContact/endContact events. |
| **Prismatic (slider) constraint** | Bodies slide along an axis. Used for pistons, elevators, sliding doors. Box2D, Planck.js, p2.js have it. Matter.js does not. | MEDIUM | Remove all DOF except translation along one axis. Optional limits and motor. |
| **Weld constraint** | Rigidly attach two bodies. Simpler than composite for dynamic welding. Box2D and Planck.js have it. | LOW | Remove all 3 DOF. Approximate (some flex in iterative solver, which is actually realistic). |
| **Ray casting** | Cast a ray and find first intersection. Essential for line-of-sight, projectiles, laser beams. Box2D has it. Matter.js has `Query.ray()`. | MEDIUM | Walk broadphase, test ray against each shape. Return hit point, normal, fraction, body. |
| **Point / AABB queries** | "What bodies are at this point?" or "What bodies overlap this rectangle?" Essential for mouse picking, area queries. | LOW | Broadphase query + narrowphase point-in-shape test. Simple to implement once broadphase exists. |
| **Composite / compound bodies** | Multiple shapes attached to one body. Every engine supports this. Needed for complex objects (cars, characters). | MEDIUM | One body, multiple shapes. Mass and inertia computed from union. Each shape has local offset. |
| **Mouse/pointer constraint** | Interactive dragging of bodies. Matter.js has `MouseConstraint`. Box2D has `MouseJoint`. Users expect interactivity in demos. | LOW | Spring constraint from body point to mouse position. High stiffness, some damping. |
| **Classic demo scenes** | Stacking, Newton's cradle, ragdoll, bouncing balls, car. Per PROJECT.md requirement. These are both showcase and integration tests. | MEDIUM | Each demo exercises multiple features. They prove the engine works correctly. |
| **Sub-stepping** | Run multiple physics sub-steps per frame for stability. Box2D v3 uses this as its primary approach. | LOW | Instead of 1 step at dt, do N steps at dt/N. Trades performance for stability. Simple to implement. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create significant problems. Deliberately NOT building these for v1.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Continuous Collision Detection (CCD)** | Fast objects tunnel through thin walls. Users want it fixed. | Extremely complex to implement correctly (TOI computation, sub-stepping, swept shapes). Matter.js has had an open issue for this since 2014 and never shipped it. Box2D spent years getting it right. It's a research-level problem. | Use sub-stepping (smaller dt) for fast objects. Make walls thicker. Cap velocity. Add bullet-body flag for future CCD work. |
| **Concave polygon decomposition** | Users want arbitrary shapes. | Automatic convex decomposition is a separate algorithm (Bayazit, Hertel-Mehlhorn) that adds significant complexity and edge cases. Matter.js requires external `poly-decomp` library and users constantly hit bugs. | Support compound bodies: user provides pre-decomposed convex parts. Accept convex-only and document it clearly. |
| **Soft body physics** | Cloth, jelly, deformable objects look cool. | Entirely different simulation domain (mass-spring or FEM). Doubles engine complexity. Not rigid body physics. | Approximate with spring-connected rigid body grids (Matter.js approach). Keep it as a demo pattern, not engine feature. |
| **3D support** | "Can you add Z?" | Different algorithms everywhere (GJK/EPA instead of SAT, quaternions instead of angles, 6 DOF instead of 3). 10x the complexity for a different product. | Stay 2D. The project name is "vis" and scope is 2D. |
| **Built-in WebGL renderer** | Performance for many objects. | Renderer complexity explodes (shaders, batching, texture atlases). Canvas 2D is sufficient for thousands of bodies. Renderer is not the engine's core value. | Keep renderer-agnostic core. Ship Canvas. Users can write WebGL renderers against the public API. |
| **ECS (Entity Component System) architecture** | Trendy pattern. Cache-friendly in theory. | Premature abstraction. Adds indirection everywhere. TypeScript class instances are fine for <10K bodies. ECS only pays off at extreme scale with WASM/SIMD. | Use simple class hierarchy. Body has shapes. World has bodies. Constraints reference bodies. Direct and debuggable. |
| **Gear joints** | Link rotation of two joints. Used in rare mechanical simulations. | Complex to implement (depends on revolute/prismatic joints existing, tricky constraint math). Very niche use case. Box2D warns about deletion order crashes. | Defer to v2+. Users who need gears are rare and can approximate with motor-driven revolute joints. |
| **Fluid simulation / particles** | Water, sand, liquid effects. | Entirely different simulation (SPH or position-based dynamics). Box2D has LiquidFun as a separate project. Not rigid body physics. | Out of scope. Particle effects are a rendering concern. |
| **Built-in game loop / runner** | Matter.js bundles `Runner`. | Couples engine to frame timing. Users have their own game loops (requestAnimationFrame, game frameworks). The engine should step on demand. | Provide `world.step(dt)` and let users call it from their own loop. Provide example code showing integration with rAF. |
| **Wheel joint** | Vehicle suspension simulation. | Specialized joint combining revolute + prismatic with spring. Niche. | Defer to v1.x. Can approximate with revolute joint + spring constraint for v1 demos. |

## Feature Dependencies

```
[Shape Primitives (circle, box, polygon)]
    |
    v
[AABB Broadphase] ----requires----> [Collision Filtering]
    |
    v
[SAT Narrowphase] ----requires----> [Contact Manifold Generation]
    |
    v
[Sequential Impulses Solver] ----requires----> [Material Properties (friction, restitution)]
    |                         ----enhanced-by--> [Warm Starting]
    |                         ----enhanced-by--> [Sub-stepping]
    v
[Collision Response]
    |
    v
[Contact Events] ----enables----> [Sensors]

[Rigid Body Simulation] ----requires----> [Force/Impulse API]
                        ----requires----> [Fixed Timestep Loop]
                        ----enhanced-by--> [Body Sleeping]

[Distance Constraint] ----foundation-for----> [Revolute Constraint]
                      ----foundation-for----> [Prismatic Constraint]
                      ----foundation-for----> [Weld Constraint]

[Broadphase] ----enables----> [Ray Casting]
             ----enables----> [Point / AABB Queries]

[Body Sleeping] ----requires----> [Island Solver]

[Canvas Renderer] ----independent-of----> [Physics Core]
                  ----enhanced-by----> [Debug Drawing (contacts, AABBs, constraints)]
```

### Dependency Notes

- **SAT Narrowphase requires Shape Primitives:** SAT operates on convex shapes with defined support functions. Shapes must exist first.
- **Sequential Impulses Solver requires Contact Manifolds:** The solver needs contact points, normals, and penetration depth from narrowphase.
- **Warm Starting requires Contact Persistence:** Must match contacts across frames by feature pair IDs. Without contact persistence, warm starting has nothing to cache.
- **Body Sleeping requires Island Solver:** Sleeping individual bodies is fragile. Sleeping entire islands (connected components of the contact graph) is the correct approach, as Box2D demonstrates.
- **Sensors require Contact Events:** Sensors are contacts that skip the solver but still fire events. Events must exist first.
- **Ray Casting requires Broadphase:** Walking the broadphase structure is how you avoid testing every shape.

## MVP Definition

### Launch With (v1)

Minimum viable physics engine -- enough to run classic demo scenes and be genuinely useful.

- [ ] **Rigid body simulation** (static, dynamic, kinematic) -- the core loop
- [ ] **Circle, box, convex polygon shapes** -- minimum shape vocabulary
- [ ] **AABB broadphase** (spatial hash grid or sweep-and-prune) -- performance gate
- [ ] **SAT narrowphase with contact manifolds** -- correctness gate
- [ ] **Sequential impulses solver** with friction and restitution -- the hard part
- [ ] **Warm starting** -- without this, stacking is unstable (Matter.js's biggest weakness)
- [ ] **Distance/spring constraint** -- needed for Newton's cradle, chains
- [ ] **Revolute/pin constraint** -- needed for ragdoll, mechanisms
- [ ] **Force/impulse API** -- users must be able to push bodies
- [ ] **Collision filtering** (category/mask) -- needed for any non-trivial scene
- [ ] **Contact events** (beginContact, endContact) -- needed for game logic
- [ ] **Fixed timestep simulation loop** -- determinism and stability
- [ ] **Canvas 2D renderer** with debug drawing -- immediate visual feedback
- [ ] **4 demo scenes** -- stacking boxes, bouncing balls, Newton's cradle, ragdoll

### Add After Validation (v1.x)

Features to add once the core is stable and demos are running.

- [ ] **Body sleeping + island solver** -- when scene complexity grows and perf matters
- [ ] **Sensors** -- when users want trigger zones without collision response
- [ ] **Ray casting + point/AABB queries** -- when users need spatial queries for game logic
- [ ] **Prismatic constraint** -- when users want sliders/pistons
- [ ] **Weld constraint** -- when users want to dynamically attach bodies
- [ ] **Mouse/pointer constraint** -- for interactive demos and debugging
- [ ] **Compound bodies** (multiple shapes per body) -- for complex objects
- [ ] **Sub-stepping** -- for users who need more stability with fast objects
- [ ] **Kinematic body improvements** -- proper velocity-based movement for platforms
- [ ] **More demos** -- car, piston mechanism, cloth approximation

### Future Consideration (v2+)

Features to defer until v1 is proven and adopted.

- [ ] **CCD (continuous collision detection)** -- hard problem, defer until tunneling is a real user complaint
- [ ] **Concave polygon support** (convex decomposition) -- defer, compound bodies cover most cases
- [ ] **Gear constraint** -- niche, defer
- [ ] **Wheel joint** -- can approximate with revolute + spring for now
- [ ] **WebGL renderer** -- only if Canvas performance becomes a bottleneck
- [ ] **WASM compilation** -- only if pure TS perf is insufficient
- [ ] **Soft body approximation** -- spring grids, not real soft body sim

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Rigid body simulation (core loop) | HIGH | MEDIUM | P1 |
| Shape primitives (circle, box, polygon) | HIGH | MEDIUM | P1 |
| AABB broadphase | HIGH | MEDIUM | P1 |
| SAT narrowphase + contact manifolds | HIGH | HIGH | P1 |
| Sequential impulses solver | HIGH | HIGH | P1 |
| Warm starting | HIGH | MEDIUM | P1 |
| Distance/spring constraint | HIGH | MEDIUM | P1 |
| Revolute constraint | HIGH | MEDIUM | P1 |
| Collision filtering | MEDIUM | LOW | P1 |
| Contact events | HIGH | LOW | P1 |
| Fixed timestep loop | HIGH | LOW | P1 |
| Canvas renderer + debug draw | HIGH | MEDIUM | P1 |
| Material properties | MEDIUM | LOW | P1 |
| Force/impulse API | HIGH | LOW | P1 |
| Body sleeping + islands | MEDIUM | HIGH | P2 |
| Sensors | MEDIUM | LOW | P2 |
| Ray casting | MEDIUM | MEDIUM | P2 |
| Point/AABB queries | MEDIUM | LOW | P2 |
| Prismatic constraint | LOW | MEDIUM | P2 |
| Weld constraint | LOW | LOW | P2 |
| Mouse constraint | MEDIUM | LOW | P2 |
| Compound bodies | MEDIUM | MEDIUM | P2 |
| Sub-stepping | LOW | LOW | P2 |
| CCD | HIGH | HIGH | P3 |
| Concave decomposition | MEDIUM | HIGH | P3 |
| Gear constraint | LOW | HIGH | P3 |
| WebGL renderer | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (v1.0)
- P2: Should have, add in v1.x once core is proven
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | Matter.js | Box2D (C/v3) | Planck.js | p2.js | vis (plan) |
|---------|-----------|--------------|-----------|-------|------------|
| Language | JavaScript | C17 | TypeScript | JavaScript | TypeScript |
| Body types (static/dynamic/kinematic) | All 3 | All 3 | All 3 | All 3 | All 3 (P1) |
| Circle, box, polygon | Yes | Yes | Yes | Yes | Yes (P1) |
| Broadphase | Grid | Dynamic AABB tree | AABB tree | Sweep-and-prune | Grid or S&P (P1) |
| SAT narrowphase | Yes | SAT + GJK | SAT | SAT | SAT (P1) |
| Contact manifolds | Basic | Full | Full | Full | Full (P1) |
| Warm starting | No | Yes | Yes | Yes | Yes (P1) |
| Sequential impulses | Yes | Yes (enhanced) | Yes | Yes | Yes (P1) |
| Body sleeping | Basic | Yes (island-based) | Yes | Yes | Island-based (P2) |
| CCD | No | Yes | Yes | Yes | No (P3) |
| Distance constraint | Yes | Yes | Yes | Yes | Yes (P1) |
| Revolute joint | Yes | Yes | Yes | Yes | Yes (P1) |
| Prismatic joint | No | Yes | Yes | Yes | P2 |
| Weld joint | No | Yes | Yes | Lock constraint | P2 |
| Gear joint | No | Yes | Yes | Yes | P3 |
| Wheel joint | No | Yes | Yes | No | P3 |
| Motor joint | No | Yes | Yes | Via revolute | P2 |
| Mouse joint | Yes | Yes | Yes | No (use spring) | P2 |
| Sensors | Yes | Yes | Yes | Yes | P2 |
| Ray casting | Yes (basic) | Yes (full) | Yes | Yes | P2 |
| Collision filtering | Yes | Yes (categories) | Yes | Yes (groups + masks) | Yes (P1) |
| Contact events | Yes | Yes (4 callbacks) | Yes | Yes | Yes (P1) |
| Concave polygons | Via poly-decomp | Via decomposition | Native | Via fromPolygon | P3 |
| Compound bodies | Via Composite | Yes | Yes | Yes | P2 |
| Built-in renderer | Yes (Canvas) | No | No | No | Yes, Canvas (P1) |
| Debug drawing | Yes | Testbed only | Testbed | Demos | Yes (P1) |
| TypeScript types | Community @types | N/A (C) | Yes (added) | Community (p2-es) | Native, ground-up |
| Zero dependencies | Yes | Yes | Yes | Yes | Yes |
| npm weekly downloads | ~128K | ~350 (box2dweb) | ~3.3K | ~2K (p2-es) | N/A |

## Sources

- [Matter.js official site and docs (v0.20.0)](https://brm.io/matter-js/)
- [Matter.js GitHub](https://github.com/liabru/matter-js) -- 17.9K stars, ~128K weekly npm downloads
- [Box2D official documentation](https://box2d.org/documentation/)
- [Box2D GitHub](https://github.com/erincatto/box2d) -- C17, MIT license
- [Planck.js GitHub](https://github.com/piqnt/planck.js) -- v1.4.3, 5.1K stars
- [Planck.js npm](https://www.npmjs.com/package/planck) -- 3.3K weekly downloads
- [p2.js GitHub (original)](https://github.com/schteppe/p2.js)
- [p2-es (maintained fork)](https://github.com/pmndrs/p2-es) -- ESM/CJS, TypeScript
- [Box2D joint types reference (iforce2d)](https://www.iforce2d.net/b2dtut/joints-overview) -- 11 joint types
- [Box2D v3 Solver2D post](https://box2d.org/posts/2024/02/solver2d/) -- solver architecture
- [Game physics warm starting (Allen Chou)](https://allenchou.net/2014/01/game-physics-stability-warm-starting/)
- [Toptal game physics tutorial (constrained rigid body simulation)](https://www.toptal.com/game/video-game-physics-part-iii-constrained-rigid-body-simulation)
- [Matter.js CCD issue #5 (open since 2014)](https://github.com/liabru/matter-js/issues/5)
- [Matter.js performance comparison](https://github.com/liabru/matter-js/issues/608) -- 40% of Box2D performance
- [JS physics engine benchmark](http://olegkikin.com/js-physics-engines-benchmark/)
- [Top 9 Open Source 2D Physics Engines Compared (daily.dev)](https://daily.dev/blog/top-9-open-source-2d-physics-engines-compared)
- [Sopiro/Physics (TypeScript 2D engine reference)](https://github.com/Sopiro/Physics) -- sequential impulses, islands, sleeping

---
*Feature research for: 2D rigid body physics engine (vis)*
*Researched: 2026-02-21*
