# Architecture Research

**Domain:** 2D rigid body physics engine
**Researched:** 2026-02-21
**Confidence:** HIGH

## Standard Architecture

### System Overview

Every major 2D physics engine (Box2D, Matter.js, Planck.js) converges on the same fundamental architecture. The engine is organized into three layers: **Math/Common** (foundational utilities), **Collision** (detection pipeline), and **Dynamics** (simulation, solving, world management). A **Renderer** sits outside the physics core entirely.

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                   │
│  │  Renderer │  │   Demos   │  │  User App │                   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                   │
│        └───────────────┼──────────────┘                         │
├────────────────────────┼────────────────────────────────────────┤
│                   PUBLIC API                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Engine / World  (orchestrator — owns the simulation)    │   │
│  └──────────┬───────────────────────────┬───────────────────┘   │
├─────────────┼───────────────────────────┼───────────────────────┤
│         DYNAMICS LAYER                  │                        │
│  ┌──────────┴──────┐  ┌────────────┐   │                        │
│  │     Bodies      │  │   Joints   │   │                        │
│  │  (rigid bodies, │  │ (distance, │   │                        │
│  │   fixtures,     │  │  revolute, │   │                        │
│  │   mass, inertia)│  │  spring)   │   │                        │
│  └──────────┬──────┘  └──────┬─────┘   │                        │
│             └────────┬───────┘         │                        │
│             ┌────────┴─────────┐       │                        │
│             │     Solver       │       │                        │
│             │  (sequential     │       │                        │
│             │   impulses,      │       │                        │
│             │   velocity +     │       │                        │
│             │   position       │       │                        │
│             │   iterations)    │       │                        │
│             └──────────────────┘       │                        │
├────────────────────────────────────────┼────────────────────────┤
│         COLLISION LAYER                │                        │
│  ┌─────────────┐  ┌───────────────┐   │                        │
│  │  Broadphase  │  │  Narrowphase  │   │                        │
│  │  (AABB tree  │  │  (SAT, GJK,  │   │                        │
│  │   or grid)   │  │   manifolds)  │   │                        │
│  └──────┬──────┘  └───────┬───────┘   │                        │
│         └────────┬────────┘           │                        │
│         ┌────────┴─────────┐          │                        │
│         │  Contact Manager │──────────┘                        │
│         │  (pairs, caching,│                                    │
│         │   begin/end)     │                                    │
│         └──────────────────┘                                    │
├─────────────────────────────────────────────────────────────────┤
│         MATH / COMMON LAYER                                     │
│  ┌────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐            │
│  │ Vec2   │  │ Vertices │  │ Bounds │  │  Matrix  │            │
│  │        │  │          │  │ (AABB) │  │ (2x2/3x3)│            │
│  └────────┘  └──────────┘  └────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **World / Engine** | Owns body list, joint list, gravity. Orchestrates the simulation step. The single entry point for advancing physics. | Everything — it is the orchestrator |
| **Body** | Stores position, velocity, angular velocity, mass, inverse mass, inertia, inverse inertia, force accumulator, torque. Contains one or more Shapes/Fixtures. | World (lifecycle), Solver (reads/writes velocities), Collision (provides shapes) |
| **Shape** | Geometric definition: circle (center + radius), polygon (vertices), edge. Computes AABB. Immutable geometry. | Body (owned by), Narrowphase (collision tests), Broadphase (AABB) |
| **Broadphase** | Quickly culls pairs that cannot collide. Outputs candidate pairs. Typical: AABB grid or dynamic AABB tree. | Shapes (reads AABBs), Contact Manager (outputs pairs) |
| **Narrowphase** | Exact collision test on candidate pairs. Outputs contact manifold (normal, depth, contact points). SAT for convex polygons, specialized for circles. | Broadphase (receives pairs), Contact Manager (outputs manifolds) |
| **Contact Manager** | Tracks active contact pairs across frames. Fires begin/end contact events. Caches warm-starting impulses. | Narrowphase (receives manifolds), Solver (provides contacts), Events |
| **Solver** | Resolves penetrations and enforces joint constraints using Sequential Impulses. Two phases: velocity iterations then position iterations. | Bodies (reads/writes), Contacts (reads manifolds), Joints (reads constraints) |
| **Joint / Constraint** | Defines a relationship between two bodies (distance, revolute, prismatic, spring). Produces constraint equations for the Solver. | Bodies (references two bodies), Solver (consumed by) |
| **Renderer** | Reads body positions/angles and draws them. Completely decoupled from physics. | Bodies (read-only), World (read-only for debug draw) |
| **Vec2 / Math** | Vector operations, matrix operations, geometric utilities. Pure functions, no state. | Everything (utility) |

## How Engines Are Organized: Evidence from Source Code

### Box2D (C++ — the canonical reference)

Three modules: `Common`, `Collision`, `Dynamics`. This is the gold standard that Planck.js copies directly.

### Planck.js (TypeScript port of Box2D)

```
src/
├── common/          # Vec2, Math, Settings, Transform, Rot
├── collision/       # Shapes, AABB, BroadPhase, Distance, TimeOfImpact
│   └── shapes/      # CircleShape, PolygonShape, EdgeShape, ChainShape
├── dynamics/        # World, Body, Fixture, Contact, Joint, Solver
│   ├── contacts/    # Contact implementations per shape-pair
│   └── joints/      # DistanceJoint, RevoluteJoint, PrismaticJoint, etc.
├── serializer/      # Save/load state
└── Settings.ts      # Global constants (slop, max vertices, etc.)
```

### Matter.js (JavaScript — more modular)

```
src/
├── body/            # Body, Composite, World
├── collision/       # Collision, Contact, Detector, Grid, Pair, Pairs, SAT, Query
├── constraint/      # Constraint, MouseConstraint
├── core/            # Engine, Events, Runner, Sleeping, Plugin, Common, Matter
├── factory/         # Bodies (factory), Composites (factory)
├── geometry/        # Axes, Bounds, Vector, Vertices, Svg
├── render/          # Render
└── module/          # Module system
```

## Recommended Project Structure for `vis`

Based on the patterns above, adapted for a from-scratch TypeScript engine:

```
src/
├── math/                # Zero-dependency foundation
│   ├── Vec2.ts          # 2D vector: add, sub, dot, cross, normalize, rotate
│   ├── Mat2.ts          # 2x2 matrix (rotation, constraint solving)
│   └── utils.ts         # Clamp, lerp, constants (PI, EPSILON)
│
├── geometry/            # Shape definitions and geometric queries
│   ├── Shape.ts         # Base shape interface/abstract class
│   ├── Circle.ts        # Circle shape
│   ├── Polygon.ts       # Convex polygon shape
│   ├── AABB.ts          # Axis-aligned bounding box
│   └── Vertices.ts      # Vertex utilities (hull, area, centroid, inertia)
│
├── body/                # Rigid body representation
│   ├── Body.ts          # Position, velocity, mass, inertia, shape, forces
│   └── BodyFactory.ts   # Convenience constructors (rectangle, circle, polygon)
│
├── collision/           # Detection pipeline
│   ├── Broadphase.ts    # AABB grid or spatial hash — outputs candidate pairs
│   ├── Narrowphase.ts   # SAT implementation — outputs contact manifolds
│   ├── Manifold.ts      # Contact normal, depth, contact points
│   ├── Pair.ts          # Pair tracking, caching, begin/end events
│   └── PairManager.ts   # Manages active pairs across frames
│
├── constraint/          # Joints and constraints
│   ├── Constraint.ts    # Base constraint interface
│   ├── DistanceJoint.ts # Fixed distance between two points
│   ├── RevoluteJoint.ts # Pin/hinge joint
│   └── Spring.ts        # Damped spring
│
├── dynamics/            # Solver and integration
│   ├── Solver.ts        # Sequential impulse solver (velocity + position phases)
│   ├── Island.ts        # Connected component for solving (optional optimization)
│   └── Sleeping.ts      # Sleep detection for inactive bodies
│
├── engine/              # Orchestration
│   ├── World.ts         # Owns bodies, constraints, gravity. The simulation container.
│   ├── Engine.ts        # Fixed-timestep loop, accumulator pattern, step orchestration
│   └── Events.ts        # Event emitter (collisionStart, collisionEnd, beforeUpdate, etc.)
│
├── render/              # Visualization (decoupled from physics)
│   └── CanvasRenderer.ts # Canvas 2D rendering of bodies, constraints, debug info
│
└── index.ts             # Public API exports
```

### Structure Rationale

- **math/ is standalone:** Zero imports from other modules. Can be tested and used independently. Everything else depends on it.
- **geometry/ depends only on math/:** Shape definitions are pure geometry. They do not know about physics (mass, velocity). This separation keeps collision detection clean.
- **body/ depends on math/ + geometry/:** A Body has a Shape and physical properties. It does not know about collision detection or solving.
- **collision/ depends on math/ + geometry/:** The detection pipeline operates on shapes and AABBs. It produces manifolds but does not resolve them.
- **constraint/ depends on math/ + body/:** Constraints reference bodies and produce equations for the solver.
- **dynamics/ depends on everything above:** The solver reads manifolds and constraint equations, then writes to body velocities/positions.
- **engine/ orchestrates all layers:** World owns the collections. Engine runs the timestep loop.
- **render/ reads from body/ and engine/:** Completely one-directional. Physics never imports from render.

## Simulation Loop Architecture

### The Fixed-Timestep Step Function

This is the heart of every 2D physics engine. The canonical flow inside `Engine.step(dt)`:

```
Engine.step(dt):
┌─────────────────────────────────────────────────────────┐
│ 1. ACCUMULATE TIME                                      │
│    accumulator += dt                                    │
│    while (accumulator >= fixedDt):                      │
│                                                         │
│    2. APPLY FORCES                                      │
│       For each body:                                    │
│         velocity += (gravity + externalForces) * dt     │
│         angularVelocity += torque * invInertia * dt     │
│         Clear force/torque accumulators                 │
│                                                         │
│    3. BROADPHASE                                        │
│       Update AABBs for all bodies                       │
│       Find candidate collision pairs                    │
│                                                         │
│    4. NARROWPHASE                                       │
│       For each candidate pair:                          │
│         Run SAT (or circle-specific test)               │
│         If colliding → generate contact manifold        │
│         Update pair tracking (new/persisted/removed)    │
│                                                         │
│    5. SOLVE VELOCITIES (N iterations)                   │
│       For each contact manifold:                        │
│         Compute and apply normal impulse                │
│         Compute and apply friction impulse              │
│       For each joint/constraint:                        │
│         Compute and apply constraint impulse            │
│                                                         │
│    6. INTEGRATE POSITIONS                               │
│       For each body:                                    │
│         position += velocity * dt                       │
│         angle += angularVelocity * dt                   │
│                                                         │
│    7. SOLVE POSITIONS (M iterations)                    │
│       For each contact:                                 │
│         Push apart to resolve remaining overlap         │
│       For each joint:                                   │
│         Correct position drift                          │
│                                                         │
│    8. FIRE EVENTS                                       │
│       collisionStart, collisionEnd, collisionActive     │
│                                                         │
│    9. SLEEP CHECK                                       │
│       Mark bodies with low velocity as sleeping         │
│                                                         │
│    accumulator -= fixedDt                               │
│    end while                                            │
│                                                         │
│ 10. RENDER (interpolated)                               │
│     alpha = accumulator / fixedDt                       │
│     renderPosition = lerp(prevPosition, position, alpha)│
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Forces/Impulses
        │
        ▼
  ┌──────────┐     ┌──────────────┐     ┌──────────────┐
  │  Bodies   │────▶│  Broadphase  │────▶│  Narrowphase │
  │(positions,│     │(AABB pairs)  │     │(SAT manifolds│
  │ velocities│     └──────────────┘     └──────┬───────┘
  │ shapes)   │                                 │
  └─────┬─────┘                                 │
        │         ┌────────────────┐            │
        │         │  Constraints   │            │
        │         │  (joints,      │            │
        │         │   springs)     │            │
        │         └───────┬────────┘            │
        │                 │                     │
        │    ┌────────────┴─────────────────────┘
        │    │
        ▼    ▼
  ┌──────────────┐
  │    Solver     │
  │  (velocity    │──────▶  Updated velocities & positions
  │   + position  │         written back to Bodies
  │   iterations) │
  └──────────────┘
        │
        ▼ (read-only)
  ┌──────────────┐
  │   Renderer   │──────▶  Canvas pixels
  └──────────────┘
```

### Key Data Flows

1. **Force application flow:** User code --> Body.applyForce() --> force accumulator --> integrated into velocity during step
2. **Collision detection flow:** Body shapes --> AABB update --> Broadphase pairs --> SAT narrowphase --> Contact manifolds --> Pair manager (caching + events)
3. **Constraint resolution flow:** Contact manifolds + Joint definitions --> Solver --> impulse corrections --> written to body velocities/positions
4. **Rendering flow:** Body positions/angles --> Renderer (read-only, interpolated for smoothness)

## Architectural Patterns

### Pattern 1: Sequential Impulses Solver

**What:** The dominant constraint solving algorithm in 2D game physics. Iteratively applies impulses to satisfy each constraint one at a time, repeating for N iterations until convergence. Popularized by Erin Catto (Box2D creator) at GDC 2006.

**When to use:** Always — this is the standard for real-time 2D physics. Alternatives (XPBD, direct solvers) are either more complex or less suitable.

**Trade-offs:** Simple to implement, stable, fast (O(N) per iteration). Does not converge to exact solution — more iterations = better quality but slower. 4-8 velocity iterations and 2-4 position iterations is typical.

**Example:**
```typescript
// Velocity constraint solving (simplified)
for (let iter = 0; iter < velocityIterations; iter++) {
  for (const contact of contacts) {
    // Relative velocity at contact point
    const dv = getRelativeVelocity(contact);
    const vn = Vec2.dot(dv, contact.normal);

    // Normal impulse (prevent penetration)
    let lambda = -contact.massNormal * (vn - contact.restitution * contact.velocityBias);

    // Clamp: accumulated impulse must be non-negative (can only push apart)
    const oldImpulse = contact.normalImpulse;
    contact.normalImpulse = Math.max(oldImpulse + lambda, 0);
    lambda = contact.normalImpulse - oldImpulse;

    // Apply impulse to both bodies
    applyImpulse(contact.bodyA, contact.bodyB, contact.normal, lambda);
  }
}
```

### Pattern 2: Warm Starting

**What:** Cache impulses from the previous frame and apply them at the start of the current frame's solve. This gives the solver a head start, dramatically improving convergence.

**When to use:** Always, once contact pair persistence is implemented. Critical for stable stacking.

**Trade-offs:** Requires contact pair caching across frames (adds complexity to pair manager). Massive stability improvement for very little cost.

### Pattern 3: Fixed Timestep with Accumulator

**What:** Decouple physics from rendering. Physics steps at a fixed dt (e.g., 1/60s). The game loop accumulates real elapsed time and takes as many fixed steps as needed to catch up. Rendering interpolates between the previous and current physics state for visual smoothness.

**When to use:** Always. Variable timestep physics is unstable and non-deterministic.

**Trade-offs:** Adds one frame of visual latency (interpolation shows a state slightly behind the actual simulation). Worth it for determinism and stability.

**Example:**
```typescript
const FIXED_DT = 1 / 60;
let accumulator = 0;
let prevTime = performance.now();

function gameLoop(currentTime: number) {
  const frameTime = Math.min((currentTime - prevTime) / 1000, 0.25); // clamp to avoid spiral of death
  prevTime = currentTime;
  accumulator += frameTime;

  while (accumulator >= FIXED_DT) {
    world.step(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  const alpha = accumulator / FIXED_DT;
  renderer.draw(world, alpha); // interpolate positions for smooth rendering
  requestAnimationFrame(gameLoop);
}
```

### Pattern 4: Separation of Shape and Body

**What:** Shapes are pure geometry (vertices, radius). Bodies hold physics state (mass, velocity). A Body contains one or more Shapes (via Fixtures in Box2D/Planck.js). This mirrors Box2D's Body -> Fixture -> Shape hierarchy.

**When to use:** From the start. Cleanly separates collision geometry from dynamics.

**Trade-offs:** Slightly more types to manage. For v1, one shape per body is fine — the architecture supports multiple shapes later without refactoring.

## Anti-Patterns

### Anti-Pattern 1: Coupling Physics and Rendering

**What people do:** Body class imports Canvas context, draws itself, or renderer directly mutates body state.
**Why it's wrong:** Makes the engine untestable without a browser. Prevents using the engine in Node.js, web workers, or with WebGL renderers. Violates single responsibility.
**Do this instead:** Renderer reads body positions/angles. Physics never knows rendering exists. The public API exposes body state; rendering is a separate consumer.

### Anti-Pattern 2: Variable Timestep Physics

**What people do:** Pass `requestAnimationFrame` delta directly to `world.step()`.
**Why it's wrong:** Physics becomes non-deterministic. Large dt spikes cause tunneling and explosions. Constraint solver convergence varies wildly between frames.
**Do this instead:** Fixed timestep with accumulator pattern. Always step with the same dt.

### Anti-Pattern 3: Allocating Objects Every Frame

**What people do:** Create new Vec2, manifold, or pair objects during collision detection every frame.
**Why it's wrong:** Causes GC pressure. In JavaScript/TypeScript, GC pauses create visible frame hitches. Physics engines process thousands of vector operations per frame.
**Do this instead:** Pre-allocate and reuse objects. Use object pools for contacts and manifolds. Prefer mutating methods (`vec.set(x, y)`) alongside pure methods.

### Anti-Pattern 4: Solving Contacts and Joints Separately

**What people do:** First solve all contacts, then solve all joints in a separate loop.
**Why it's wrong:** Joints and contacts interact. Solving them separately means they fight each other, reducing convergence quality.
**Do this instead:** Interleave contacts and joints in the same solver iteration loop, as Box2D does.

### Anti-Pattern 5: Skipping Inverse Mass / Inverse Inertia

**What people do:** Store mass and compute `1/mass` every time it's needed. Or treat static bodies with `mass = Infinity`.
**Why it's wrong:** Division is slow (repeated thousands of times). Infinity causes NaN propagation bugs.
**Do this instead:** Store `inverseMass` and `inverseInertia`. Static bodies have `inverseMass = 0` and `inverseInertia = 0`. The solver naturally handles this: zero inverse mass means impulses don't affect the body.

## Build Order (Dependency-Driven)

This is critical for the roadmap. Components must be built bottom-up following the dependency graph:

```
Phase 1: math/         ← No dependencies. Build and test first.
              │
Phase 2: geometry/     ← Depends on math/. Shapes, AABB, vertices.
              │
Phase 3: body/         ← Depends on math/ + geometry/. Body with shape, mass, velocity.
              │
Phase 4: collision/    ← Depends on math/ + geometry/. Broadphase + SAT narrowphase.
              │
Phase 5: dynamics/     ← Depends on everything above. Solver with sequential impulses.
              │
Phase 6: engine/       ← Depends on everything. World, fixed-timestep loop, events.
              │
Phase 7: constraint/   ← Depends on body/ + dynamics/. Joints and springs.
              │
Phase 8: render/       ← Depends on body/ + engine/. Canvas renderer.
              │
Phase 9: demos/        ← Depends on everything. Integration test scenes.
```

**Why this order:**
- You cannot test collision without shapes (Phase 2 before 4)
- You cannot test the solver without bodies and manifolds (Phase 3+4 before 5)
- Constraints are harder than contacts and can be deferred (Phase 7 after 5+6)
- Rendering should come after you have a working simulation to visualize (Phase 8 late)
- Each phase produces testable, demonstrable output

**Alternative consideration:** Phases 7 and 8 could swap. Having a renderer earlier (Phase 7) provides visual debugging for constraint work (Phase 8). This is a pragmatic trade-off — visual feedback accelerates development.

## Scaling Considerations

| Concern | 10-50 bodies | 100-500 bodies | 1000+ bodies |
|---------|--------------|----------------|--------------|
| Broadphase | Brute-force O(n^2) works fine | Spatial hash or AABB grid needed | Dynamic AABB tree (BVH) for best perf |
| Solver | 4-6 iterations sufficient | 6-8 iterations for stable stacking | Consider island decomposition |
| Memory | No pooling needed | Object pooling for contacts recommended | Typed arrays for body state (SoA layout) |
| Sleep | Optional | Helpful — many bodies reach rest | Essential — most bodies should sleep |

### Scaling Priorities

1. **First bottleneck: Broadphase.** O(n^2) brute-force breaks around 200+ bodies. An AABB grid or spatial hash is the first optimization that matters.
2. **Second bottleneck: GC pressure.** Object allocation during collision detection causes frame hitches. Object pooling and mutation-based APIs fix this.
3. **Third bottleneck: Solver iterations.** Island decomposition lets you solve independent groups separately, but this is an optimization for 500+ body scenes.

## Sources

- [Box2D Documentation — Simulation](https://box2d.org/documentation/md_simulation.html) (HIGH confidence — authoritative, from engine creator Erin Catto)
- [Box2D v2.3.0 User Manual](https://fizyka.umk.pl/~jacek/dydaktyka/modsym/studenci/2015-2016/box2d.org/box2d_manual_v2.3.0.pdf) (HIGH confidence — official manual)
- [Box2D Solver2D Blog Post](https://box2d.org/posts/2024/02/solver2d/) (HIGH confidence — Erin Catto on sequential impulses internals)
- [Box2D Simulation Islands](https://box2d.org/posts/2023/10/simulation-islands/) (HIGH confidence — official blog)
- [Erin Catto — Sequential Impulses, GDC 2006](https://box2d.org/files/ErinCatto_SequentialImpulses_GDC2006.pdf) (HIGH confidence — the foundational paper)
- [Matter.js API Documentation](https://brm.io/matter-js/docs/) (HIGH confidence — official docs, module listing)
- [Matter.js GitHub — liabru/matter-js](https://github.com/liabru/matter-js) (HIGH confidence — source code structure)
- [Planck.js GitHub — piqnt/planck.js](https://github.com/piqnt/planck.js) (HIGH confidence — source code, TypeScript port of Box2D)
- [Glenn Fiedler — Fix Your Timestep!](https://www.gafferongames.com/post/fix_your_timestep/) (HIGH confidence — seminal article on fixed timestep)
- [Allen Chou — Game Physics: Constraints & Sequential Impulse](https://allenchou.net/2013/12/game-physics-constraints-sequential-impulse/) (MEDIUM confidence — well-regarded tutorial)
- [Toptal — Video Game Physics Part III: Constrained Rigid Body Simulation](https://www.toptal.com/game/video-game-physics-part-iii-constrained-rigid-body-simulation) (MEDIUM confidence — detailed tutorial with code)

---
*Architecture research for: 2D rigid body physics engine (vis)*
*Researched: 2026-02-21*
