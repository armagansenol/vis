# Project Research Summary

**Project:** vis
**Domain:** 2D Rigid Body Physics Engine (TypeScript library, zero runtime dependencies)
**Researched:** 2026-02-21
**Confidence:** HIGH

## Executive Summary

`vis` is a from-scratch 2D rigid body physics engine written in TypeScript, intended as a browser-targeted library with zero runtime dependencies. Research across the field (Box2D, Matter.js, Planck.js, p2.js) converges on a well-understood architecture: a layered system of Math, Geometry, Body, Collision, Dynamics, Constraints, and Renderer, with the World/Engine as the orchestrator. The dominant solver approach — Sequential Impulses (Erin Catto's method) combined with warm starting, fixed-timestep integration using Symplectic Euler, and a broadphase/narrowphase collision pipeline — is both well-documented and validated by every major engine in production. This is a solved domain with high-confidence patterns. The recommended build order is strictly bottom-up: math first, then geometry, body, collision detection, solver, constraints, renderer, and finally demo scenes.

The key differentiator over Matter.js (the dominant JS physics engine) is threefold: native TypeScript with ground-up type safety, warm starting (which Matter.js lacks, causing poor stacking stability), and correct impulse clamping. Building these three correctly from the start puts vis ahead of Matter.js on its biggest known weaknesses. The competitive bar is not high — Matter.js has 128K weekly downloads despite well-documented stability flaws. A correct, well-typed TypeScript engine that stacks reliably is genuinely rare in the browser ecosystem.

The primary risks are all implementation-level, not design-level. The physics algorithms are documented in canonical sources (Catto GDC 2006, Gaffer on Games, Allen Chou). The risk is in subtle correctness traps: SAT returning wrong normals for rotated polygons, impulse clamping using delta instead of accumulated impulses, missing contact persistence preventing warm starting, and variable timestep causing non-determinism. All of these have clear prevention strategies. The mitigation is comprehensive unit testing at every layer, integrated from Phase 1, before building anything on top.

## Key Findings

### Recommended Stack

The modern TypeScript library toolchain for 2026 is compact and fast. TypeScript 5.9.3 (stay off 6.0 until it stabilizes), tsdown 0.20.x as the library bundler (replacing the no-longer-maintained tsup, built on Rolldown/Rust for dramatically faster builds and clean `.d.ts` output), Vitest 4.0.x for testing (native TS support, no transform config, built-in coverage), and Biome 2.3.x for linting and formatting (single tool, 10-100x faster than ESLint + Prettier). Vite 7.x is used only for demo pages. The zero-dependency constraint is absolute — no gl-matrix, no math utilities, no ECS frameworks.

**Core technologies:**
- TypeScript 5.9.3: Language — latest stable, full `.d.ts` generation for library consumers
- tsdown 0.20.x: Library bundler — Rolldown-based, ESM + CJS dual output, superior `.d.ts` via rolldown-plugin-dts
- Vitest 4.0.x: Testing — native TypeScript, fast watch mode, coverage via `@vitest/coverage-v8`
- Biome 2.3.x: Lint + format — single binary, replaces ESLint + Prettier, zero transitive deps
- Vite 7.x: Demo dev server — HMR for Canvas demos; not used for library builds
- Node.js 22.x: Runtime (dev only) — current LTS, required by tsdown

### Expected Features

All four analyzed engines converge on the same table-stakes features. The MVP requires the full collision pipeline (broadphase, SAT narrowphase, contact manifolds), a Sequential Impulses solver with warm starting, distance and revolute constraints, collision filtering and events, and a Canvas renderer with debug drawing. The single most important differentiator to implement in v1 is warm starting — Matter.js omits it and users consistently report unstable stacking as its biggest flaw. A Canvas renderer ships with the library (unlike Box2D, Planck.js, and p2.js, which ship no renderer — users complain).

**Must have (table stakes — v1.0):**
- Rigid body simulation (static, dynamic, kinematic) — the core simulation loop
- Circle, box, convex polygon shapes — minimum shape vocabulary
- AABB broadphase (spatial hash grid) — prevents O(n^2) performance cliff
- SAT narrowphase with contact manifolds — correctness of collision detection
- Sequential Impulses solver with friction and restitution — the hard part
- Warm starting — critical for stable stacking; Matter.js lacks this
- Distance/spring and revolute/pin constraints — Newton's cradle, chains, ragdolls
- Collision filtering (category/mask bitmask) — needed for non-trivial scenes
- Contact events (beginContact, endContact) — game logic hooks
- Fixed timestep loop with accumulator pattern — determinism and stability
- Canvas 2D renderer with debug drawing — immediate visual feedback
- 4 demo scenes (stacking boxes, bouncing balls, Newton's cradle, ragdoll)
- Force/impulse API — users must be able to push bodies
- Material properties (density, friction, restitution) — per-shape material model

**Should have (competitive — v1.x):**
- Body sleeping + island solver — performance for large scenes with resting bodies
- Sensors (trigger shapes) — collision detection without response
- Ray casting + point/AABB queries — game logic spatial queries
- Prismatic (slider) constraint — pistons, elevators (Matter.js lacks this)
- Weld constraint — dynamic body attachment
- Mouse/pointer constraint — interactive demos
- Compound bodies (multiple shapes per body) — complex object shapes
- Sub-stepping — stability for fast objects without full CCD complexity

**Defer (v2+):**
- CCD (continuous collision detection) — hard problem; use thicker walls and sub-stepping for now
- Concave polygon support — compound bodies cover most cases
- WebGL renderer — Canvas 2D is sufficient for thousands of bodies
- Gear/wheel joints — niche; can approximate with existing constraints

### Architecture Approach

Every major 2D physics engine (Box2D, Planck.js, Matter.js) converges on a three-layer architecture: Math/Common (pure utilities, no dependencies), Collision (detection pipeline: broadphase -> narrowphase -> contact manager), and Dynamics (solver, integration, world management). The Renderer sits entirely outside the physics core and reads body state in one direction only. The World/Engine is the orchestrator that owns all collections and runs the fixed-timestep loop. This architecture is proven, well-documented, and directly applicable.

**Major components:**
1. **math/** — Vec2, Mat2, utils; zero imports, pure functions, the foundation everything else depends on
2. **geometry/** — Shape, Circle, Polygon, AABB, Vertices; pure geometry, no physics state
3. **body/** — Body (position, velocity, mass, inertia, force accumulator, shape); physics state without collision knowledge
4. **collision/** — Broadphase (spatial hash), Narrowphase (SAT), Manifold, PairManager; detection pipeline, produces manifolds
5. **constraint/** — DistanceJoint, RevoluteJoint, Spring; constraint equations consumed by the solver
6. **dynamics/** — Solver (Sequential Impulses), Island, Sleeping; reads manifolds and constraints, writes to bodies
7. **engine/** — World (owns collections), Engine (fixed-timestep loop), Events; orchestration layer
8. **render/** — CanvasRenderer; reads body state read-only, completely decoupled from physics

### Critical Pitfalls

1. **Variable timestep simulation** — Pass `requestAnimationFrame` delta directly to physics and the simulation is non-deterministic, frame-rate-dependent, and unstable on slow machines. Fix: implement the Fixed Timestep / accumulator pattern from day one, before any other physics code.

2. **Forward Euler integration** — Explicit Euler over-estimates energy; springs spiral, stacks explode over time. Fix: use Symplectic (Semi-implicit) Euler instead (update velocity first, then position using new velocity). Two-line change, dramatically more stable.

3. **Missing contact manifold persistence** — Regenerating contacts from scratch every frame makes warm starting impossible and stacking permanently unstable. Fix: implement a contact cache keyed by body-pair ID from the start; this is a prerequisite for warm starting.

4. **Impulse clamping using delta instead of accumulated impulse** — Clamping the per-iteration delta instead of the accumulated impulse prevents solver convergence. Fix: follow Erin Catto's accumulated impulse method exactly — clamp the accumulated value, apply only the difference.

5. **SAT returning wrong normals for rotated polygons** — Omitting axes from one shape, or failing to enforce consistent MTV direction, causes collision resolution to push objects the wrong way. Fix: test normals from both shapes, enforce normal direction with a center-to-center dot product check, add epsilon tolerance on near-parallel edges.

6. **O(n^2) collision without broadphase** — The engine works at 10 bodies but becomes unusable at 100+. Fix: design the collision pipeline as broadphase -> narrowphase from the start, even if the initial broadphase is a naive spatial hash.

## Implications for Roadmap

Based on the architecture's strict dependency graph and the pitfall-to-phase mapping, the natural phase structure is bottom-up with testing integrated at every layer.

### Phase 1: Foundation — Math, Geometry, and Body

**Rationale:** Everything in the engine depends on Vec2, AABB, and Body. There is no physics without shapes and bodies. Symplectic Euler integration and inverse mass/inertia storage must be correct here — retrofitting the integrator later requires re-tuning every scene. This is also where moment of inertia formulas are validated.
**Delivers:** Vec2, Mat2, math utilities; Circle, Polygon, AABB, Vertices; Body with position, velocity, mass, inverse mass, inertia, inverse inertia, force accumulator; BodyFactory convenience constructors.
**Addresses:** Shape primitives, rigid body representation, material properties (density to mass).
**Avoids:** Forward Euler pitfall (use Symplectic Euler from the start), wrong inertia formulas, storing mass instead of inverse mass.

### Phase 2: Collision Detection Pipeline

**Rationale:** Cannot test the solver without collision data. Broadphase and narrowphase must be an explicit architectural boundary — retrofitting a broadphase after the fact is a high-cost recovery. SAT correctness must be verified with comprehensive rotation tests before building resolution on top.
**Delivers:** Broadphase (spatial hash grid), SAT narrowphase, contact manifold generation, PairManager for contact persistence and begin/end events, collision filtering.
**Addresses:** AABB broadphase, SAT narrowphase, contact manifolds, contact events, collision filtering.
**Avoids:** O(n^2) collision pitfall (broadphase/narrowphase separation from the start), SAT normal direction bug (unit tests at 15/30/45/60/75/90 degree rotations).

### Phase 3: Solver and Collision Resolution

**Rationale:** Contact caching (from Phase 2) enables warm starting here. Sequential Impulses with correct accumulated impulse clamping, Baumgarte position correction, and warm starting must be built together — they are tightly coupled. This is the hardest phase and where most engine failures originate.
**Delivers:** Sequential Impulses solver with velocity and position iterations, warm starting, Baumgarte stabilization for position drift, friction impulse with Coulomb model, restitution with velocity threshold, fixed-timestep Engine loop with accumulator and spiral-of-death guard.
**Addresses:** Collision response, friction, restitution, fixed timestep simulation loop.
**Avoids:** Impulse clamping bug (use accumulated impulse method), contact caching gap (prerequisite for warm starting), position drift (Baumgarte from the start), variable timestep pitfall.

### Phase 4: Constraints

**Rationale:** Constraints depend on the solver infrastructure built in Phase 3. Distance and revolute joints come first (they are also the basis for springs and more complex joints). Mouse constraint is low-cost and enables interactive debugging.
**Delivers:** DistanceJoint, RevoluteJoint, Spring, mouse/pointer constraint; constraint equations integrated into the solver velocity loop alongside contacts.
**Addresses:** Distance/spring constraint, revolute/pin constraint, mouse constraint.
**Avoids:** Solving contacts and joints in separate loops (interleave in the same solver iteration loop per Box2D's approach).

### Phase 5: Renderer and Debug Drawing

**Rationale:** A working simulation exists after Phase 3. Visual debugging through the renderer significantly accelerates constraint work in Phase 4 and demo creation in Phase 6. Building the renderer after a working simulation means it can immediately visualize real physics. Debug drawing (contact normals, AABBs, velocity vectors) is a first-class feature, not an afterthought. Note: renderer could move to after Phase 3 if visual feedback is preferred during constraint development.
**Delivers:** CanvasRenderer with body drawing (position interpolation using alpha), debug drawing (contact points, normals, AABBs, constraint lines, velocity vectors), mock CanvasRenderingContext2D for Vitest.
**Addresses:** Built-in Canvas renderer requirement, debug drawing, UX pitfall of no visual debugging.
**Uses:** Fixed-timestep alpha interpolation from Phase 3, body state from Phase 1.

### Phase 6: Demo Scenes and Integration Tests

**Rationale:** Demos are integration tests that simultaneously verify correctness of all prior phases and serve as the library showcase. They exercise the full stack: stacking tests warm starting and solver stability, Newton's cradle tests restitution and contact persistence, ragdoll tests revolute constraints, bouncing balls test broadphase and circle collision.
**Delivers:** 4 canonical demo scenes (stacking boxes, bouncing balls, Newton's cradle, ragdoll), Vite-powered demo harness with pause/step/slow-motion controls.
**Addresses:** Demo scenes requirement from PROJECT.md, mouse constraint interactivity.
**Avoids:** "Looks done but isn't" checklist — each demo exercises a failure mode from PITFALLS.md.

### Phase 7: Performance and Advanced Features (v1.x)

**Rationale:** Add performance features and advanced constraints once the core is proven correct by demos. Body sleeping requires island decomposition (a connected-component graph algorithm over the contact graph) — this is well-understood but complex, and premature optimization before correctness is established.
**Delivers:** Island solver, body sleeping, sensors, ray casting, point/AABB queries, prismatic constraint, weld constraint, compound bodies, sub-stepping.
**Addresses:** v1.x features from FEATURES.md; performance with 500+ body scenes.
**Avoids:** Sleep system pitfall (sleep islands, not individual bodies); solver iterating over sleeping bodies.

### Phase Ordering Rationale

- **Bottom-up dependency order is mandatory.** The architecture's dependency graph (math -> geometry -> body -> collision -> dynamics -> constraints -> render -> demos) has no shortcuts. Skipping layers creates high-cost rework.
- **Contact caching (Phase 2) before solver (Phase 3)** because warm starting is a Phase 3 requirement and requires contact persistence from Phase 2 as a prerequisite.
- **Constraints (Phase 4) after solver (Phase 3)** because constraints produce equations consumed by the solver; the solver infrastructure must exist first.
- **Renderer (Phase 5) relatively late** because it reads body state read-only and has no physics dependencies. Moving it earlier trades correctness validation for visual feedback — acceptable if preferred.
- **Demos (Phase 6) last** because they are integration tests; they can only be correct when all prior phases are correct.
- **Performance (Phase 7) after demos** because demo correctness is the validation gate for the core. Optimizing before correctness is proven is premature.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Solver):** Sequential Impulses with accumulated clamping, warm starting, and Baumgarte are well-documented but the implementation details are subtle. Recommend reviewing Erin Catto GDC 2006 and Allen Chou's contact constraints series as phase-level references before implementation.
- **Phase 7 (Island Solver / Sleeping):** Island decomposition (connected-component BFS/DFS on contact graph) is an algorithm requiring careful implementation. Body sleeping as islands (not individual bodies) has non-obvious correctness requirements (wake propagation).

Phases with standard patterns (skip research-phase):
- **Phase 1 (Math/Geometry/Body):** Vec2 operations and moment of inertia formulas are textbook. No research needed.
- **Phase 2 (Collision):** SAT is canonical and well-documented (dyn4j, Toptal tutorial). Spatial hash broadphase is straightforward.
- **Phase 4 (Constraints):** Distance and revolute joints are covered in every constraint solver tutorial. Standard patterns.
- **Phase 5 (Renderer):** Canvas 2D renderer is trivial. Interpolation formula is in STACK.md. No research needed.
- **Phase 6 (Demos):** Demo scenes are integration exercises, not research problems.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | TypeScript 5.9, Vitest 4, Biome 2 are current stable releases. tsdown 0.20.x is v0.x but from the Vite ecosystem (void(0) team), actively maintained with 89+ dependents. Fallback to tsup is explicit. |
| Features | HIGH | Derived from source analysis of Matter.js, Box2D v3, Planck.js, p2-es. Feature landscape is stable and well-understood. Competitor weakness analysis (warm starting gap in Matter.js) is verified. |
| Architecture | HIGH | Box2D's architecture is the canonical reference (Erin Catto, official documentation). Planck.js is a direct TypeScript port. The three-layer pattern is proven across all major 2D physics engines. |
| Pitfalls | HIGH | All pitfalls sourced from authoritative references (Catto GDC 2006, Gaffer on Games, Allen Chou series, Dirk Gregorius). Prevention strategies are specific and actionable, not general advice. |

**Overall confidence:** HIGH

### Gaps to Address

- **tsdown v0.x stability:** If tsdown introduces breaking changes in a minor version, fall back to tsup 8.5.x (same CLI interface, same config shape). Monitor tsdown changelog during Phase 1 setup.
- **Broadphase choice:** Research recommends spatial hash grid for v1 simplicity. If scene object sizes vary widely, a dynamic AABB tree may be needed sooner. Validate with a 200-body mixed-size scene during Phase 2.
- **Contact manifold point count:** Research recommends 4 points maximum per pair (keeping deepest + maximizing area coverage). The specific selection algorithm needs implementation decision during Phase 2 — multiple valid approaches exist.
- **Baumgarte beta tuning:** Beta = 0.1-0.3 is the recommended range, but correct value is scene-dependent. Plan to tune per demo scene during Phase 3/6.

## Sources

### Primary (HIGH confidence)
- [Box2D Documentation — Simulation](https://box2d.org/documentation/md_simulation.html) — architecture, solver, simulation loop
- [Erin Catto — Sequential Impulses, GDC 2006](https://box2d.org/files/ErinCatto_SequentialImpulses_GDC2006.pdf) — solver algorithm, impulse clamping, warm starting
- [Glenn Fiedler — Fix Your Timestep](https://www.gafferongames.com/post/fix_your_timestep/) — fixed timestep, accumulator pattern, spiral of death
- [Allen Chou — Game Physics series](https://allenchou.net/2013/12/game-physics-constraints-sequential-impulse/) — contacts, warm starting, broadphase
- [TypeScript 5.9 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html) — stack
- [Vitest 4.0 Announcement](https://vitest.dev/blog/vitest-4) — stack
- [Biome 2.0 Blog](https://biomejs.dev/blog/biome-v2/) — stack
- [Matter.js GitHub — liabru/matter-js](https://github.com/liabru/matter-js) — competitor analysis, feature gaps
- [Planck.js GitHub — piqnt/planck.js](https://github.com/piqnt/planck.js) — TypeScript port of Box2D, architecture reference

### Secondary (MEDIUM confidence)
- [tsdown docs](https://tsdown.dev/guide/) — library bundler; v0.x, actively developed
- [dyn4j — SAT](https://dyn4j.org/2010/01/sat/) — SAT algorithm reference
- [Toptal — Video Game Physics Part II and III](https://www.toptal.com/game/video-game-physics-part-ii-collision-detection-for-solid-objects) — collision and constraint tutorials
- [Sopiro/Physics — TypeScript 2D engine reference](https://github.com/Sopiro/Physics) — sequential impulses, islands, sleeping in TS
- [winter.dev — Designing a Physics Engine](https://winter.dev/articles/physics-engine) — implementation guide
- [Optimizing 2D Physics Spatial Hashing (2025)](https://cpoli.live/blog/2025/spatial-hashing/) — broadphase optimization

### Tertiary (LOW confidence)
- [JS physics engine benchmark](http://olegkikin.com/js-physics-engines-benchmark/) — competitor performance comparison; may be outdated

---
*Research completed: 2026-02-21*
*Ready for roadmap: yes*
