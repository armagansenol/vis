# Pitfalls Research

**Domain:** 2D rigid body physics engine (TypeScript, from scratch)
**Researched:** 2026-02-21
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Variable Timestep Simulation Loop

**What goes wrong:**
Using `requestAnimationFrame` delta time directly as the physics `dt` causes non-deterministic behavior. Stacking scenes collapse on slow frames, constraints stretch, and bodies tunnel through walls when frame rate dips. The simulation literally produces different results on different machines.

**Why it happens:**
It feels natural to pass the frame delta straight into the physics update. Variable dt means the integrator accumulates different errors each frame, contact impulses vary wildly, and solver convergence changes per-step. A 16ms frame and a 32ms frame produce fundamentally different constraint forces.

**How to avoid:**
Implement the "Fix Your Timestep" pattern from day one. Use a fixed dt (1/120s to 1/60s), accumulate real time in a remainder, and run multiple physics steps per render frame when needed. Interpolate render state between the previous and current physics state using `alpha = remainder / dt` for smooth visuals. Guard against the "spiral of death" by capping the maximum accumulated time (e.g., 250ms) so a long frame pause does not cause dozens of catch-up steps.

**Warning signs:**
- Stacking boxes that work at 60fps but collapse at 30fps
- Constraints that stretch or break when tab is backgrounded then returned
- Non-reproducible bug reports that depend on machine performance

**Phase to address:**
Core simulation loop (Phase 1). This must be correct before any other physics code is built on top of it.

---

### Pitfall 2: Euler Integration Without Understanding Its Limits

**What goes wrong:**
Explicit (forward) Euler integration over-estimates energy, causing objects to gain speed over time. Springs and pendulums spiral outward. Stacking bodies jitter and eventually explode. The simulation "looks almost right" initially but degrades over time or under stress.

**Why it happens:**
Forward Euler is the simplest integrator and every tutorial starts with it. Developers ship it without realizing it is conditionally stable — it only works when `dt * stiffness` is small enough. Once constraints or springs push past that threshold, energy grows exponentially.

**How to avoid:**
Use Symplectic (Semi-implicit) Euler as the baseline integrator: update velocity first, then update position using the new velocity. This is energy-conserving for conservative forces and is what Box2D uses. It is barely more complex than forward Euler but dramatically more stable. Verify correctness with a simple pendulum test — it should not gain amplitude over thousands of frames.

**Warning signs:**
- Pendulum or spring test gaining energy over time (amplitude growing)
- Objects slowly drifting upward against gravity
- Stacked bodies vibrating and eventually launching

**Phase to address:**
Core dynamics (Phase 1). The integrator is the foundation; switching later means re-tuning every scene.

---

### Pitfall 3: SAT Collision Detection Returning Wrong Minimum Translation Vector

**What goes wrong:**
The Separating Axis Theorem implementation returns incorrect collision normals or penetration depths, especially for rotated polygons. Objects resolve in the wrong direction, get pushed into walls, or jitter between frames. Edge cases with nearly parallel edges produce near-zero or flipped normals.

**Why it happens:**
Three common root causes: (1) Only testing axes from one shape instead of both shapes. SAT requires testing normals from shape A AND shape B. (2) Not enforcing a consistent MTV direction — the normal must always point from A to B. If the direction flips frame-to-frame, resolution oscillates. (3) Floating-point precision issues on nearly-parallel edges producing degenerate axes.

**How to avoid:**
Test normals from both shapes. After finding the axis of minimum penetration, enforce direction: compute the vector from A's center to B's center; if `dot(mtv_normal, center_diff) < 0`, flip the normal. Add an epsilon tolerance (~1e-6) when comparing penetration depths to handle near-parallel edges. Write explicit unit tests for: axis-aligned boxes, rotated boxes at 45 degrees, edge-on-edge contact, and vertex-on-edge contact.

**Warning signs:**
- Objects snapping to wrong sides of other objects after collision
- Jittering at rest (normal flipping each frame)
- Collisions that work for axis-aligned shapes but break when rotated

**Phase to address:**
Collision detection (Phase 2). Must be solid before building resolution on top.

---

### Pitfall 4: Missing or Incorrect Contact Manifold Persistence

**What goes wrong:**
Contacts are regenerated from scratch every frame. Without persistent contact tracking, warm starting is impossible, the solver starts from zero each frame, stacking is unstable, and resting objects vibrate permanently. A stack of 3+ boxes will never come to rest.

**Why it happens:**
Generating contacts each frame is simpler to implement. Developers skip manifold caching because it requires matching contacts between frames, handling contact creation/deletion, and storing accumulated impulses — all of which add significant complexity.

**How to avoid:**
Implement a contact cache keyed by body-pair ID. Each frame, run narrow-phase collision to get new contacts, then match them against cached contacts using proximity (if a new contact point is within a threshold distance of a cached one, treat it as the same contact and preserve its accumulated impulse). Remove stale contacts that no longer appear. Limit manifold size to 4 contact points maximum per pair, keeping the deepest penetration point and maximizing area coverage. This enables warm starting, which is the single biggest stability improvement for iterative solvers.

**Warning signs:**
- Resting bodies vibrate instead of sleeping
- Stacks collapse that should be stable
- Adding more solver iterations does not improve stability much

**Phase to address:**
Collision resolution (Phase 3). Contact caching should be built alongside the constraint solver, not retrofitted.

---

### Pitfall 5: Impulse Clamping Done Wrong in Sequential Impulse Solver

**What goes wrong:**
The solver applies unbounded impulses, allows negative normal impulses (pulling), or clamps intermediate impulses instead of accumulated impulses. Result: bodies explode, pass through each other, or stick together like glue.

**Why it happens:**
The clamping logic in sequential impulse is subtle. You must accumulate the total impulse applied to each contact, clamp the *accumulated* value (not the per-iteration delta), and then apply only the difference. Clamping the delta directly prevents convergence because it forgets previous iterations' contributions. Friction clamping is similarly tricky — it must be bounded by `mu * normal_impulse`, using the accumulated normal impulse.

**How to avoid:**
Follow Erin Catto's accumulated impulse method exactly: (1) Compute the impulse delta for this iteration. (2) Store `old_accumulated = accumulated_impulse`. (3) Set `accumulated_impulse = max(0, accumulated_impulse + delta)` for normal, or clamp within `[-mu*Fn, mu*Fn]` for friction. (4) Apply `accumulated_impulse - old_accumulated` as the actual impulse. This ensures convergence while respecting physical bounds.

**Warning signs:**
- Bodies sticking together after collision (negative impulse pulling them)
- Solver not converging even with many iterations
- Friction causing objects to accelerate instead of decelerate

**Phase to address:**
Constraint solver (Phase 3). Get this right before adding joints or springs.

---

### Pitfall 6: Position Drift / Sinking Through Floors

**What goes wrong:**
Objects slowly sink into surfaces they rest on. A box on the ground floor gradually penetrates downward over hundreds of frames. Joints slowly separate. The simulation looks fine for the first second, then visibly degrades.

**Why it happens:**
Velocity-level constraint solving is a linearization of the true nonlinear position constraint. Each frame introduces a tiny position error that accumulates. Without explicit position correction, constraint drift is inevitable. This is fundamental to how iterative velocity solvers work — it is not a bug in your math.

**How to avoid:**
Implement position correction using one of these approaches (ordered by recommendation): (1) **Baumgarte stabilization** (simplest) — feed a fraction of the penetration depth back as a velocity bias in the constraint. Use `beta = 0.1 to 0.3`, tuned per scenario. Good for small errors. (2) **Split impulses / pseudo-velocities** — correct position using a separate "bias velocity" that does not affect real velocity, preventing artificial energy injection. (3) **NGS (Nonlinear Gauss-Seidel)** — directly solve position constraints in a separate pass after velocity solving. Most robust but most expensive. Box2D v3 uses this approach. Start with Baumgarte (it is 5 lines of code), upgrade to split impulses or NGS if tuning becomes painful.

**Warning signs:**
- Objects slowly sinking into ground plane
- Joint-connected bodies gradually separating
- Penetration depth growing over time in debug output

**Phase to address:**
Constraint solver (Phase 3). Add immediately after basic collision response works.

---

### Pitfall 7: Wrong Moment of Inertia Calculations

**What goes wrong:**
Rotational response looks physically wrong. Thin rods spin too fast, squares spin too slow, irregular polygons wobble unnaturally. Collision response produces unrealistic angular velocities.

**Why it happens:**
Three mistakes: (1) Using the wrong formula — each shape type (circle, rectangle, convex polygon) has a different moment of inertia formula, and they must be computed about the center of mass, not the geometric center. (2) Forgetting to store and use **inverse** inertia (the solver needs `1/I` everywhere, and infinite-mass static bodies need `inverseMass = 0, inverseInertia = 0`). (3) For convex polygons, not using the triangle-decomposition method to compute inertia from vertices.

**How to avoid:**
Implement inertia formulas per shape: Circle `I = 0.5 * m * r^2`. Rectangle `I = (m/12) * (w^2 + h^2)`. Convex polygon: decompose into triangles from centroid, sum each triangle's contribution using the parallel axis theorem. Store `inverseMass` and `inverseInertia` on the body; set both to 0 for static bodies. Validate with known test cases — a square should have the same inertia regardless of orientation.

**Warning signs:**
- A dropped rectangle spins unrealistically fast or slow on impact
- Collision response that looks right for circles but wrong for polygons
- Static bodies being affected by collisions (inverseInertia not zero)

**Phase to address:**
Core body definitions (Phase 1), validated during collision resolution (Phase 3).

---

### Pitfall 8: O(n^2) Collision Without Broadphase

**What goes wrong:**
The engine works fine with 10 bodies but becomes unusable at 100+ bodies. Frame time grows quadratically. Developers waste time optimizing narrow-phase math when the real problem is checking every pair.

**Why it happens:**
During initial development, checking all pairs is the simplest approach and "works" for small test scenes. The performance cliff is not gradual — it hits suddenly when body count crosses a threshold, and by then the narrowphase is deeply integrated without a broadphase layer.

**How to avoid:**
Design the collision pipeline as broadphase -> narrowphase from the start, even if the initial broadphase is naive. Start with a simple **spatial hash grid** — it is O(n) for uniform-sized objects, easy to implement, and handles the 2D case well. Cell size should be ~2x the diameter of the largest common object. For scenes with varied object sizes, consider a **dynamic AABB tree** (what Box2D uses). The broadphase interface should return candidate pairs; narrowphase tests only those pairs.

**Warning signs:**
- Frame time scaling quadratically with body count
- Profiler showing >50% time in collision detection
- Inability to run 200+ body scenes at 60fps

**Phase to address:**
Collision detection architecture (Phase 2). Define the broadphase/narrowphase interface before implementing either.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip broadphase entirely | Simpler code, faster to ship | O(n^2) collision, unusable past ~50 bodies | Never — even a naive grid is worth it |
| Forward Euler integrator | 2 lines of code | Energy gain, instability in springs/constraints | Never — semi-implicit Euler is equally simple |
| No contact caching | Simpler collision pass | Unstable stacking, no warm starting possible | Prototype only, must add before constraints |
| Hardcoded gravity direction | Avoids vector math | Cannot do space games, inclined planes, etc. | Acceptable if only ground-plane scenes needed |
| Single-point contact manifold | Avoids manifold management | Rocking/wobbling flat surfaces, unstable stacks | Prototype only |
| Skip friction entirely | Simpler impulse math | Everything slides like ice, unrealistic feel | Phase 2 prototype, must add in Phase 3 |
| No sleep system | Avoids state machine complexity | CPU wasted on resting bodies, limits scene size | Acceptable until performance phase |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Allocating objects per frame (new Vec2 in hot loops) | GC pauses, frame spikes | Pre-allocate scratch vectors, use object pools for contacts | >50 bodies, GC becomes visible |
| Recomputing AABB every narrowphase test | Redundant math in tight loop | Cache AABB on body, invalidate on position/rotation change | >100 bodies |
| Not exiting SAT early on separating axis | Testing all axes even when separation found | Return immediately on first separating axis | >200 polygon-polygon pairs |
| Using `Math.sqrt` when `distanceSquared` suffices | Unnecessary sqrt in broadphase distance checks | Compare squared distances | >500 distance checks per frame |
| Solver iterating over sleeping bodies | Wasting iterations on stationary clusters | Implement sleep islands — skip solver for islands where all bodies are at rest | >200 bodies with many at rest |
| Creating arrays/closures in the step loop | Allocation pressure every frame | Pre-allocate, reuse buffers, avoid functional patterns in hot path | >100 bodies, visible in profiler |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual debug rendering | Cannot diagnose collision issues, contact normals, AABBs | Build debug draw (contact points, normals, AABBs, velocity vectors) alongside the renderer from day one |
| World scale mismatch | Bodies behave strangely — too floaty or too rigid | Keep dynamic body sizes in the 0.1–10 meter range; use a pixels-to-meters ratio if working in pixel coordinates |
| No way to pause/step simulation | Cannot inspect single-frame behavior | Add pause, single-step, and slow-motion controls to demo harness |
| Exposing raw physics units to users | Confusing API — users must understand impulses, radians, etc. | Provide helper functions with intuitive units (degrees, pixels, percentage-based damping) |

## "Looks Done But Isn't" Checklist

- [ ] **Collision detection:** Works for axis-aligned shapes but breaks for rotated polygons — test at 15, 30, 45, 60, 75, 90 degree rotations
- [ ] **Stacking:** 3 boxes stack, but 6+ boxes collapse — need warm starting and adequate solver iterations (8-10 minimum)
- [ ] **Restitution:** Bouncing ball works, but ball resting on floor vibrates — need velocity threshold below which restitution is zeroed out
- [ ] **Friction:** Flat surfaces work, but angled surfaces cause sliding — friction impulse must use the tangent vector at the contact point, not a world-axis approximation
- [ ] **Constraints/joints:** Joint holds under light load but separates under stress — need position correction (Baumgarte or NGS), not just velocity constraints
- [ ] **Demo scenes:** Newton's cradle "works" but energy leaks or grows — integration, restitution, and contact persistence must all be correct simultaneously
- [ ] **Performance:** 50-body demo runs fine, but never tested 500 bodies — broadphase and sleep system needed
- [ ] **Determinism:** Simulation looks correct but produces different results on replay — floating-point operation order or variable timestep is the cause

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Variable timestep baked in | MEDIUM | Wrap physics update in fixed-step accumulator; requires re-tuning all constants |
| Forward Euler everywhere | LOW | Swap velocity/position update order (2-line change for semi-implicit Euler) |
| No broadphase | MEDIUM | Insert broadphase layer between world.step and narrowphase; requires refactoring collision pipeline |
| No contact caching | HIGH | Requires contact ID system, manifold data structure, and re-architecture of collision pass |
| Wrong impulse clamping | MEDIUM | Fix clamping logic to use accumulated impulses; requires careful re-testing of all constraint types |
| Wrong inertia formulas | LOW | Fix formulas, re-run rotation tests; isolated to body initialization |
| No position correction | LOW | Add Baumgarte bias term to constraint solver (~5 lines); tune beta parameter |
| O(n^2) baked into architecture | HIGH | Full collision pipeline refactor if broadphase/narrowphase boundary was not designed in |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Variable timestep | Phase 1: Core loop | Pendulum test produces identical results at 30fps and 144fps |
| Wrong integrator | Phase 1: Dynamics | Pendulum amplitude stays constant over 10,000 frames |
| Wrong inertia | Phase 1: Body setup | Dropped rectangle angular velocity matches analytical prediction |
| No broadphase | Phase 2: Collision detection | 500-body scene runs at 60fps; collision time is O(n) in profiler |
| SAT bugs | Phase 2: Narrowphase | Automated tests pass for all rotation angles, edge cases |
| No contact caching | Phase 3: Resolution | 6-box stack stable at rest for 10 seconds |
| Wrong impulse clamping | Phase 3: Solver | Bodies do not stick, explode, or gain energy in any test scene |
| Position drift | Phase 3: Solver | Resting body penetration depth < 0.01 units after 10,000 frames |
| No sleep system | Phase 4: Performance | 1000-body scene with 900 at rest runs at 60fps |
| No debug rendering | Phase 1: Renderer | Contact normals, AABBs, velocities visible in all demo scenes |

## Sources

- [Fix Your Timestep — Gaffer on Games](https://www.gafferongames.com/post/fix_your_timestep/)
- [Erin Catto — Sequential Impulses (GDC 2006)](https://box2d.org/files/ErinCatto_SequentialImpulses_GDC2006.pdf)
- [Allen Chou — Game Physics: Constraints & Sequential Impulse](https://allenchou.net/2013/12/game-physics-constraints-sequential-impulse/)
- [Allen Chou — Game Physics: Contact Constraints](https://allenchou.net/2013/12/game-physics-resolution-contact-constraints/)
- [Allen Chou — Game Physics: Warm Starting](https://allenchou.net/2014/01/game-physics-stability-warm-starting/)
- [Allen Chou — Game Physics: Broadphase Dynamic AABB Tree](https://allenchou.net/2014/02/game-physics-broadphase-dynamic-aabb-tree/)
- [dyn4j — SAT (Separating Axis Theorem)](https://dyn4j.org/2010/01/sat/)
- [Toptal — Video Game Physics Tutorial Part II: Collision Detection](https://www.toptal.com/game/video-game-physics-part-ii-collision-detection-for-solid-objects)
- [Toptal — Video Game Physics Tutorial Part III: Constrained Rigid Body Simulation](https://www.toptal.com/game/video-game-physics-part-iii-constrained-rigid-body-simulation)
- [Dirk Gregorius — Contacts (Valve, GDC 2015)](https://media.steampowered.com/apps/valve/2015/DirkGregorius_Contacts.pdf)
- [Erik Onarheim — Understanding Collision Constraint Solvers](https://erikonarheim.com/posts/understanding-collision-constraint-solvers/)
- [myPhysicsLab — Rigid Body Physics Engine](https://www.myphysicslab.com/explain/physics-engine-en.html)
- [Optimizing 2D Physics Spatial Hashing (2025)](https://cpoli.live/blog/2025/spatial-hashing/)
- [UBC Lecture — 2D Rigid Body Physics and Collision Detection using Sequential Impulses](https://www.cs.ubc.ca/~rhodin/2020_2021_CPSC_427/lectures/D_CollisionTutorial.pdf)
- [Gaffer on Games — Rotation & Inertia Tensors](https://gafferongames.com/post/rotation_and_inertia_tensors/)
- [winter.dev — Designing a Physics Engine](https://winter.dev/articles/physics-engine)

---
*Pitfalls research for: 2D rigid body physics engine (vis)*
*Researched: 2026-02-21*
