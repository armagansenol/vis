# Phase 3: Solver and Engine Loop - Research

**Researched:** 2026-02-21
**Domain:** Sequential impulse constraint solver, fixed-timestep simulation loop
**Confidence:** HIGH

## Summary

Phase 3 implements the collision response solver (sequential impulses / PGS) and the fixed-timestep engine loop that orchestrates the full simulation step. The solver takes manifolds produced by Phase 2's CollisionSystem and computes velocity corrections so bodies bounce, slide with friction, and stack stably. The engine loop wraps the entire pipeline (integrate, broadphase, narrowphase, solve, correct) in a fixed-timestep accumulator pattern that decouples physics from rendering frame rate.

The algorithmic foundation is well-established: Erin Catto's Sequential Impulses (equivalent to Projected Gauss-Seidel) from Box2D/Box2D-Lite, combined with Baumgarte position stabilization and warm starting via the ManifoldMap contact persistence already built in Phase 2. The existing codebase provides all needed inputs: Body with `invMass`/`invInertia`/`integrate()`, Manifold with `contacts[].normalImpulse`/`tangentImpulse` and feature-ID-based warm-start transfer, and CollisionSystem.detect() returning active manifolds.

**Primary recommendation:** Implement a ContactSolver class that pre-computes per-contact effective masses, applies warm-started impulses, then iterates 8 times solving normal+friction constraints with accumulated impulse clamping. Wrap this in a World class with a fixed-timestep accumulator (1/60s, max 5 steps) that calls integrate -> detect -> solve -> position-correct each step.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- No locked decisions -- all solver and engine loop choices are at Claude's discretion

### Claude's Discretion
- Solver iteration count (Box2D uses 8 as default -- Claude can choose based on stability needs)
- Position correction strategy (Baumgarte stabilization vs split impulses)
- Whether solver constants are configurable at runtime (per-world) or fixed module defaults
- Whether sleeping bodies are implemented (engine targets < 500 bodies, so sleeping is optional)
- Fixed timestep rate and max accumulated steps per frame
- Restitution cutoff velocity (below which bouncing is suppressed)
- Friction model details (Coulomb with tangent impulse clamping)
- Material mixing strategy (already started in Phase 2 manifold -- geometric mean friction, max restitution)
- Engine step API design (what world.step() looks like, gravity config)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SOLV-01 | Sequential impulses (iterative PGS) velocity solver with configurable iteration count | Core solver algorithm: ContactSolver with configurable iterations, effective mass pre-computation, velocity constraint solving per contact |
| SOLV-02 | Normal impulse resolution with restitution (bounciness) | Normal impulse formula with restitution bias: `bias = restitution * max(vn - restitutionSlop, 0)` plus Baumgarte correction |
| SOLV-03 | Tangential friction impulse with Coulomb friction model | Friction impulse clamped to `[-mu * normalImpulse, mu * normalImpulse]` using accumulated clamping |
| SOLV-04 | Position correction via Baumgarte stabilization to resolve penetration | Baumgarte bias term: `-(beta / dt) * max(depth - slop, 0)` added to velocity constraint bias |
| SOLV-05 | Accumulated impulse clamping (not per-iteration clamping) | Clamp total accumulated impulse, compute delta as difference: `newImpulse = max(old + delta, 0); applied = newImpulse - old` |
| SOLV-06 | Warm starting -- cache and reapply impulses from previous frame via contact persistence | ManifoldMap already transfers impulses by feature ID (Phase 2). Solver pre-step applies cached impulses before iteration. |
| BODY-06 | Fixed timestep simulation loop with accumulator pattern and interpolation | World.step(dt) with accumulator, fixed dt=1/60, max steps cap, alpha for render interpolation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| No external libraries | N/A | Pure TypeScript physics solver | Project constraint: "you built every line of it" |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^3.0.0 | Testing solver correctness | Already in project, test all solver behaviors |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Baumgarte stabilization | Split impulses (NGS/pseudo-velocities) | Split impulses avoid energy injection but require separate position solve pass. Baumgarte is simpler, sufficient for < 500 bodies, and Box2D-Lite uses it successfully. |
| PGS velocity solver | TGS (sub-stepping) | TGS trades iterations for sub-steps. Better for very stiff stacks but unnecessary for < 500 body target. |
| Body sleeping | Always simulate | Sleeping adds complexity (island detection, wake conditions). With < 500 bodies, always-simulate is acceptable. Defer to v2 (ADVP-01). |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── solver/
│   ├── ContactSolver.ts      # Sequential impulse solver
│   ├── SolverBody.ts          # Per-step cached body data (optional, for perf)
│   └── index.ts
├── engine/
│   ├── World.ts               # Engine loop, body management, step orchestration
│   ├── WorldSettings.ts       # Configurable constants (gravity, iterations, dt, etc.)
│   └── index.ts
```

### Pattern 1: Pre-Step / Iterate / Post-Step Solver Architecture
**What:** Split the solver into three phases per timestep:
1. **Pre-step**: Compute effective masses, bias velocities, apply warm-start impulses
2. **Iterate**: Run N iterations of velocity constraint solving (normal + friction per contact)
3. **Post-step**: Store accumulated impulses back into contact points for next frame's warm-start

**When to use:** Every physics step, after collision detection, before position integration correction.

**Implementation:**

```typescript
// Source: Erin Catto, Sequential Impulses GDC 2006; Allen Chou contact constraints blog
class ContactSolver {
  private contacts: ContactConstraint[] = [];

  preStep(manifolds: Manifold[], dt: number): void {
    // For each manifold, for each contact point:
    // 1. Compute rA = contact.point - bodyA.position
    // 2. Compute rB = contact.point - bodyB.position
    // 3. Compute effective mass:
    //    rnA = rA x normal, rnB = rB x normal
    //    normalMass = 1 / (invMassA + invMassB + invInertiaA*rnA*rnA + invInertiaB*rnB*rnB)
    // 4. Same for tangent direction -> tangentMass
    // 5. Compute bias = -(beta/dt) * max(depth - slop, 0) + restitution * max(vn - velSlop, 0)
    // 6. Apply warm-start: apply cached normalImpulse * normal + tangentImpulse * tangent
  }

  solve(): void {
    // For each contact constraint:
    // 1. Compute relative velocity at contact
    // 2. Solve normal constraint with accumulated clamping
    // 3. Solve friction constraint with Coulomb clamping
  }
}
```

### Pattern 2: Fixed-Timestep Accumulator with Interpolation Alpha
**What:** Decouple physics from rendering using a time accumulator.
**When to use:** Every call to `world.step(frameDeltaTime)`.

```typescript
// Source: Glenn Fiedler "Fix Your Timestep!" (gafferongames.com)
class World {
  private accumulator = 0;
  private readonly fixedDt = 1 / 60;
  private readonly maxSteps = 5;

  step(frameDt: number): number {
    // Clamp to prevent spiral of death
    frameDt = Math.min(frameDt, this.maxSteps * this.fixedDt);
    this.accumulator += frameDt;

    while (this.accumulator >= this.fixedDt) {
      this.fixedStep(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Return interpolation alpha for renderer
    return this.accumulator / this.fixedDt;
  }

  private fixedStep(dt: number): void {
    // 1. Apply gravity + integrate velocities
    // 2. Broadphase + narrowphase (CollisionSystem.detect)
    // 3. Solver pre-step (effective mass, warm start)
    // 4. Solver iterations
    // 5. Integrate positions
    // 6. (Optional) Position correction pass
  }
}
```

### Pattern 3: Accumulated Impulse Clamping (Critical for Stability)
**What:** Clamp the total accumulated impulse, not the per-iteration delta. This allows corrective negative impulses when the solver overshoots.
**When to use:** Every contact constraint solve, for both normal and friction.

```typescript
// Source: Erin Catto GDC 2006, erikonarheim.com constraint solver tutorial
// Normal impulse clamping:
const oldImpulse = contact.normalImpulse;
contact.normalImpulse = Math.max(oldImpulse + lambda, 0);
const applied = contact.normalImpulse - oldImpulse;

// Friction impulse clamping (Coulomb):
const maxFriction = manifold.friction * contact.normalImpulse;
const oldTangent = contact.tangentImpulse;
contact.tangentImpulse = clamp(oldTangent + lambdaT, -maxFriction, maxFriction);
const appliedT = contact.tangentImpulse - oldTangent;
```

### Anti-Patterns to Avoid
- **Per-iteration clamping instead of accumulated:** Causes jitter and instability in stacks. The solver cannot "undo" overshoot from previous iterations, leading to oscillation.
- **Applying warm-start after computing relative velocity for restitution:** The restitution bias must use the relative velocity BEFORE warm-starting. Compute `vn` first, store it, then apply warm-start impulses.
- **Position integration before velocity solving:** Semi-implicit Euler means velocity-first. The solver modifies velocities, then positions are updated from the corrected velocities.
- **Computing effective mass inside the iteration loop:** Effective mass depends only on geometry and mass properties, not on velocities. Pre-compute once per contact per step.
- **Unbounded accumulator:** Without a frame-time clamp, a single long frame (e.g., tab switch) floods the accumulator and triggers hundreds of physics steps, freezing the browser.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contact persistence / warm-start data transfer | Custom contact cache | ManifoldMap (already built, Phase 2) | Feature-ID matching, begin/end events already working |
| Material mixing | Custom per-pair logic | mixMaterials() (already built, Phase 2) | Geometric mean friction, max restitution already implemented |
| Collision pipeline | Custom broadphase+narrowphase | CollisionSystem.detect() (already built, Phase 2) | Returns Manifold[] with contacts ready for solver |
| Body integration | Custom integrator | Body.integrate() (already built, Phase 1) | Semi-implicit Euler with gravity scale, force clearing |

**Key insight:** Phases 1-2 already provide all the infrastructure the solver needs. The solver's job is purely: take manifolds, compute impulses, modify body velocities. Do not duplicate collision detection, material mixing, or integration logic.

## Common Pitfalls

### Pitfall 1: Warm-Starting Restitution Interaction
**What goes wrong:** Bouncing is incorrect -- balls either bounce too high or not at all.
**Why it happens:** The restitution bias term uses the relative velocity at the contact point. If warm-start impulses are applied before measuring this velocity, the velocity is already partially corrected, suppressing the bounce.
**How to avoid:** Compute `vn = relativeVelocity.dot(normal)` during pre-step BEFORE applying warm-start impulses. Store the restitution bias. Then apply warm-start.
**Warning signs:** A ball with restitution=1.0 on a static floor does not bounce back to its original height.

### Pitfall 2: Spiral of Death in Accumulator
**What goes wrong:** A single slow frame causes the simulation to run dozens of physics steps trying to catch up, which takes even longer, causing more steps next frame.
**Why it happens:** The accumulator grows unbounded when frameDt exceeds the time to execute the physics steps.
**How to avoid:** Clamp `frameDt` before adding to accumulator: `frameDt = Math.min(frameDt, maxSteps * fixedDt)`. This caps the maximum number of physics steps per frame.
**Warning signs:** FPS drops sharply when many bodies are added, and does not recover.

### Pitfall 3: Friction Direction Flipping
**What goes wrong:** Bodies vibrate or slide erratically on surfaces.
**Why it happens:** The tangent vector is recomputed each iteration from the normal. If the normal flips direction between frames (which the manifold system should prevent, but can happen with numerical noise), the tangent flips too, causing accumulated tangent impulse to fight itself.
**How to avoid:** Compute the tangent once during pre-step from the manifold normal: `tangent = Vec2(-normal.y, normal.x)`. Use consistently throughout all iterations.
**Warning signs:** A box on a tilted plane vibrates instead of sliding smoothly or sitting still.

### Pitfall 4: Baumgarte Over-Correction
**What goes wrong:** Resting bodies jitter or bounce slightly at contact.
**Why it happens:** The Baumgarte bias pushes bodies apart proportional to penetration depth. Without slop, even tiny floating-point penetrations trigger correction, injecting energy.
**How to avoid:** Use penetration slop (0.01 units typical): `bias = -(beta/dt) * max(depth - slop, 0)`. This creates a dead zone where small penetrations are tolerated.
**Warning signs:** A stack of boxes slowly drifts upward or individual boxes visibly vibrate.

### Pitfall 5: Integration Order in the Step
**What goes wrong:** Bodies pass through each other or collision response is delayed by one frame.
**Why it happens:** If positions are integrated before collision detection, bodies move into overlap. If collision is detected before velocity integration, gravity has not been applied yet.
**How to avoid:** Use the correct order: (1) integrate velocities (apply gravity/forces to velocities only), (2) detect collisions at current positions, (3) solve velocity constraints, (4) integrate positions from corrected velocities.
**Warning signs:** Objects tunneling through thin bodies, or gravity appearing to "lag" by one frame.

### Pitfall 6: Incorrect Effective Mass for Static Bodies
**What goes wrong:** Impulses applied to static-dynamic contacts produce wrong velocity changes.
**Why it happens:** Static bodies have invMass=0 and invInertia=0. If you accidentally skip them in the effective mass formula, the denominator is wrong.
**How to avoid:** The effective mass formula naturally handles this: `invMassA + invMassB + ...`. When bodyA is static, invMassA=0 and invInertiaA=0, so only bodyB's terms contribute. No special-casing needed.
**Warning signs:** Objects bouncing off walls with wrong speed, or static bodies moving.

## Code Examples

Verified patterns from official sources and reference implementations:

### Effective Mass Pre-Computation (Per Contact Point)
```typescript
// Source: Erin Catto GDC 2006; erikonarheim.com; Allen Chou blog
// During preStep, for each contact in each manifold:

const rA = Vec2.sub(contact.point, bodyA.position);
const rB = Vec2.sub(contact.point, bodyB.position);

// r x n (2D cross product = scalar)
const rnA = rA.cross(normal);
const rnB = rB.cross(normal);

// Effective mass for normal direction
const kNormal = bodyA.invMass + bodyB.invMass
  + bodyA.invInertia * rnA * rnA
  + bodyB.invInertia * rnB * rnB;
const normalMass = kNormal > 0 ? 1 / kNormal : 0;

// Tangent = perpendicular to normal
const tangent = new Vec2(-normal.y, normal.x);
const rtA = rA.cross(tangent);
const rtB = rB.cross(tangent);

const kTangent = bodyA.invMass + bodyB.invMass
  + bodyA.invInertia * rtA * rtA
  + bodyB.invInertia * rtB * rtB;
const tangentMass = kTangent > 0 ? 1 / kTangent : 0;
```

### Bias Velocity Computation
```typescript
// Source: Allen Chou game-physics-stability-slops; Box2D-Lite
const BAUMGARTE_FACTOR = 0.2;       // beta: 0.1-0.3 typical
const PENETRATION_SLOP = 0.01;      // Allow 1cm penetration before correction
const RESTITUTION_SLOP = 0.5;       // Velocity threshold (m/s) below which bounce is suppressed

// Relative velocity at contact BEFORE warm-starting
const dv = Vec2.sub(
  Vec2.add(bodyB.velocity, Vec2.crossScalarVec(bodyB.angularVelocity, rB)),
  Vec2.add(bodyA.velocity, Vec2.crossScalarVec(bodyA.angularVelocity, rA))
);
const vn = dv.dot(normal);

// Restitution bias (only when separating velocity is significant)
const restitutionBias = manifold.restitution * Math.max(-vn - RESTITUTION_SLOP, 0);

// Baumgarte position correction bias
const baumgarteBias = -(BAUMGARTE_FACTOR / dt) * Math.max(contact.depth - PENETRATION_SLOP, 0);

const bias = baumgarteBias + restitutionBias;
```

### Normal Impulse Solving with Accumulated Clamping
```typescript
// Source: Erin Catto GDC 2006; erikonarheim.com
// Inside solve(), for each contact:

// Relative velocity at contact point (CURRENT, after previous iterations)
const dv = Vec2.sub(
  Vec2.add(bodyB.velocity, Vec2.crossScalarVec(bodyB.angularVelocity, rB)),
  Vec2.add(bodyA.velocity, Vec2.crossScalarVec(bodyA.angularVelocity, rA))
);
const vn = dv.dot(normal);

// Compute impulse magnitude
const lambda = normalMass * (-(vn + bias));

// Accumulated clamping (NOT per-iteration clamping)
const oldImpulse = contact.normalImpulse;
contact.normalImpulse = Math.max(oldImpulse + lambda, 0);
const appliedLambda = contact.normalImpulse - oldImpulse;

// Apply impulse to bodies
const impulse = normal.clone().scale(appliedLambda);
bodyA.velocity.x -= impulse.x * bodyA.invMass;
bodyA.velocity.y -= impulse.y * bodyA.invMass;
bodyA.angularVelocity -= rA.cross(impulse) * bodyA.invInertia;
bodyB.velocity.x += impulse.x * bodyB.invMass;
bodyB.velocity.y += impulse.y * bodyB.invMass;
bodyB.angularVelocity += rB.cross(impulse) * bodyB.invInertia;
```

### Friction Impulse Solving with Coulomb Clamping
```typescript
// Source: Erin Catto GDC 2006
// Immediately after normal impulse, same contact:

const vt = dv.dot(tangent);  // recompute dv or use the updated one
const lambdaT = tangentMass * (-vt);

// Coulomb friction: clamp to mu * normalImpulse
const maxFriction = manifold.friction * contact.normalImpulse;
const oldTangent = contact.tangentImpulse;
contact.tangentImpulse = Math.max(-maxFriction, Math.min(oldTangent + lambdaT, maxFriction));
const appliedT = contact.tangentImpulse - oldTangent;

// Apply tangent impulse
const frictionImpulse = tangent.clone().scale(appliedT);
bodyA.velocity.x -= frictionImpulse.x * bodyA.invMass;
bodyA.velocity.y -= frictionImpulse.y * bodyA.invMass;
bodyA.angularVelocity -= rA.cross(frictionImpulse) * bodyA.invInertia;
bodyB.velocity.x += frictionImpulse.x * bodyB.invMass;
bodyB.velocity.y += frictionImpulse.y * bodyB.invMass;
bodyB.angularVelocity += rB.cross(frictionImpulse) * bodyB.invInertia;
```

### Warm-Starting Application (Pre-Step)
```typescript
// Source: Erin Catto GDC 2006; photonstorm/box2d-lite
// After computing effective masses, apply cached impulses:

for (const cc of this.contacts) {
  const P = new Vec2(
    cc.normal.x * cc.normalImpulse + cc.tangent.x * cc.tangentImpulse,
    cc.normal.y * cc.normalImpulse + cc.tangent.y * cc.tangentImpulse
  );

  bodyA.velocity.x -= P.x * bodyA.invMass;
  bodyA.velocity.y -= P.y * bodyA.invMass;
  bodyA.angularVelocity -= cc.rA.cross(P) * bodyA.invInertia;

  bodyB.velocity.x += P.x * bodyB.invMass;
  bodyB.velocity.y += P.y * bodyB.invMass;
  bodyB.angularVelocity += cc.rB.cross(P) * bodyB.invInertia;
}
```

### World Step with Fixed Timestep Accumulator
```typescript
// Source: Glenn Fiedler "Fix Your Timestep!" (gafferongames.com)
step(frameDt: number): number {
  // Prevent spiral of death
  const clampedDt = Math.min(frameDt, this.settings.maxSteps * this.settings.fixedDt);
  this.accumulator += clampedDt;

  while (this.accumulator >= this.settings.fixedDt) {
    this.singleStep(this.settings.fixedDt);
    this.accumulator -= this.settings.fixedDt;
  }

  // Alpha for render interpolation (0 = previous state, 1 = current state)
  return this.accumulator / this.settings.fixedDt;
}

private singleStep(dt: number): void {
  // 1. Apply gravity and external forces to velocities
  for (const body of this.bodies) {
    if (body.type === BodyType.Dynamic) {
      body.velocity.x += (body.force.x * body.invMass + this.gravity.x * body.gravityScale) * dt;
      body.velocity.y += (body.force.y * body.invMass + this.gravity.y * body.gravityScale) * dt;
      body.angularVelocity += body.torque * body.invInertia * dt;
    }
  }

  // 2. Collision detection
  const manifolds = this.collisionSystem.detect(this.bodies);

  // 3. Solve velocity constraints
  this.solver.preStep(manifolds, dt);
  for (let i = 0; i < this.settings.velocityIterations; i++) {
    this.solver.solve();
  }

  // 4. Integrate positions from corrected velocities
  for (const body of this.bodies) {
    if (body.type === BodyType.Static) continue;
    body.position.x += body.velocity.x * dt;
    body.position.y += body.velocity.y * dt;
    body.angle += body.angularVelocity * dt;
  }

  // 5. Clear force accumulators
  for (const body of this.bodies) {
    body.force.set(0, 0);
    body.torque = 0;
  }
}
```

### Helper: Cross Product Variants for 2D
```typescript
// These are needed throughout the solver and may be added as static Vec2 methods
// or as inline utilities in the solver module.

// scalar x Vec2 -> Vec2 (angular velocity x radius arm)
function crossScalarVec(s: number, v: Vec2): Vec2 {
  return new Vec2(-s * v.y, s * v.x);
}

// Vec2 x Vec2 -> scalar (already exists as Vec2.cross)
// Vec2 x scalar -> Vec2 (useful for impulse application)
function crossVecScalar(v: Vec2, s: number): Vec2 {
  return new Vec2(s * v.y, -s * v.x);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Baumgarte stabilization | NGS / Soft constraints (Box2D v3) | 2023-2024 | Box2D v3 moved to soft constraints. But Baumgarte remains standard for simple engines and Box2D-Lite-style implementations. Perfectly adequate for < 500 bodies. |
| PGS (iteration-based) | TGS (sub-step-based, PhysX) | 2019+ | TGS trades iterations for sub-steps. Better for large stiff systems. Overkill for this engine's scope. |
| Per-iteration clamping | Accumulated impulse clamping | 2006 (Catto) | Fundamental correctness improvement. Must use accumulated clamping. |

**Deprecated/outdated:**
- Per-iteration impulse clamping: replaced by accumulated clamping (Catto 2006). Never use per-iteration.
- Explicit Euler integration: replaced by semi-implicit Euler (already implemented in Phase 1).

## Discretion Recommendations

Based on research, these are the recommended choices for Claude's discretion areas:

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Velocity iterations | 8 | Box2D default. Good balance of stability and performance for < 500 bodies. |
| Position correction | Baumgarte stabilization | Simpler than split impulses, one-pass, well-understood. Sufficient for target scale. |
| Baumgarte beta | 0.2 | Standard value from Box2D-Lite and multiple references. |
| Penetration slop | 0.01 (world units) | Prevents jitter at resting contacts. |
| Restitution velocity slop | 0.5 (units/s) | Suppresses micro-bouncing so objects come to rest. |
| Solver constants | Configurable per-world via settings object | Allows tuning without recompiling. Small API cost. |
| Sleeping bodies | Do NOT implement (defer to v2, ADVP-01) | < 500 bodies makes sleeping unnecessary. Complexity not justified. |
| Fixed timestep | 1/60s (60 Hz) | Industry standard. Matches typical display refresh. |
| Max steps per frame | 5 | Prevents spiral of death while allowing brief lag recovery. |
| Friction model | Coulomb with tangent impulse clamping (accumulated) | Standard approach, matches requirement SOLV-03. |
| Material mixing | Already implemented in Phase 2 | Geometric mean friction, max restitution. No changes needed. |
| Engine step API | `world.step(dt): number` returning interpolation alpha | Clean API, renderer uses alpha for smooth display. |

## Open Questions

1. **Integration order: velocity-first vs position-first**
   - What we know: Semi-implicit Euler updates velocity before position. But the solver also modifies velocities. The standard Box2D order is: integrate velocities (gravity/forces) -> detect collisions -> solve constraints -> integrate positions.
   - What's unclear: Body.integrate() currently does both velocity and position in one call. The solver step needs to split this: velocity integration separate from position integration.
   - Recommendation: Either split Body.integrate() into integrateVelocity()/integratePosition(), or have World do the integration inline (bypassing Body.integrate()). The latter avoids modifying existing Phase 1 code. The planner should decide.

2. **Vec2 allocation in solver hot path**
   - What we know: The solver's inner loop runs (contacts * iterations) times per step. Creating new Vec2 instances (via Vec2.sub, clone, etc.) generates garbage.
   - What's unclear: Whether GC pressure matters at < 500 bodies with 8 iterations.
   - Recommendation: Use inline arithmetic (direct x/y manipulation) in the solver's hot loop. Pre-allocate scratch Vec2s if needed. Avoid Vec2.sub()/clone() inside solve(). The existing Vec2 mutable methods (add, sub, scale) mutate in-place which helps, but the static methods create new instances.

3. **Should World own the body list or receive it?**
   - What we know: The Out of Scope table says "No built-in game loop/runner -- users call world.step(dt)". This implies World is the main simulation container.
   - What's unclear: Whether World manages body add/remove, or just receives a body array.
   - Recommendation: World should own the body list with addBody/removeBody methods. This is the standard pattern (Box2D World owns bodies). The CollisionSystem.detect() already takes a body array, so World passes its internal list.

## Sources

### Primary (HIGH confidence)
- [Erin Catto - Sequential Impulses GDC 2006](https://box2d.org/files/ErinCatto_SequentialImpulses_GDC2006.pdf) - Core algorithm, accumulated clamping, warm starting
- [Erin Catto - Modeling and Solving Constraints GDC 2009](https://box2d.org/files/ErinCatto_ModelingAndSolvingConstraints_GDC2009.pdf) - Constraint formulation, Jacobian derivation
- [Glenn Fiedler - Fix Your Timestep!](https://www.gafferongames.com/post/fix_your_timestep/) - Fixed timestep accumulator pattern, spiral of death prevention, interpolation
- [Erin Catto - Solver2D (2024)](https://box2d.org/posts/2024/02/solver2d/) - Modern Box2D solver evolution, PGS vs TGS comparison

### Secondary (MEDIUM confidence)
- [Allen Chou - Game Physics: Contact Constraints](https://allenchou.net/2013/12/game-physics-resolution-contact-constraints/) - Effective mass formula, bias velocity derivation, friction clamping
- [Allen Chou - Game Physics: Stability Slops](https://allenchou.net/2014/01/game-physics-stability-slops/) - Penetration slop, restitution slop formulas
- [Erik Onarheim - Understanding Collision Constraint Solvers](https://erikonarheim.com/posts/understanding-collision-constraint-solvers/) - Implementation walkthrough with code
- [photonstorm/box2d-lite (TypeScript)](https://github.com/photonstorm/box2d-lite) - TypeScript reference implementation of Box2D-Lite solver
- [Box2D-Lite Walkthrough in JavaScript](https://cedarcantab.wordpress.com/2022/09/19/box2d-lite-walkthrough-in-javascript-solving-constraints/) - JavaScript solver implementation details

### Tertiary (LOW confidence)
- [Taming Time in Game Engines (2025)](https://andreleite.com/posts/2025/game-loop/fixed-timestep-game-loop/) - Recent fixed timestep walkthrough with interactive demos

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No external libraries needed, pure TypeScript implementation
- Architecture: HIGH - Sequential impulse solver is a 20-year-old well-documented algorithm with multiple reference implementations
- Pitfalls: HIGH - Well-catalogued in Catto's presentations and community forums
- Solver math: HIGH - Formulas verified across 4+ independent sources (Catto, Allen Chou, Erik Onarheim, Box2D-Lite source)
- Fixed timestep: HIGH - Glenn Fiedler's pattern is the industry standard, unchanged for 20+ years

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable domain, algorithms unchanged for decades)
