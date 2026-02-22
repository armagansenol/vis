# Phase 4: Constraints - Research

**Researched:** 2026-02-22
**Domain:** Constraint-based physics joints (sequential impulse solver integration)
**Confidence:** HIGH

## Summary

Phase 4 adds four constraint types (distance, spring, revolute, mouse) to the existing sequential impulse solver. The core challenge is integrating joint constraints alongside the existing contact constraints in the solver loop. The existing codebase already has the infrastructure for this: `World.singleStep()` has a clear pipeline (integrate velocities -> detect collisions -> solve constraints -> integrate positions), and `CollisionSystem` already supports pair exclusions for joints.

The standard approach from Box2D is to define a `Constraint` interface with `preStep(dt)` and `solveVelocity()` methods, then loop over all constraints (both contact and joint) during the solver phase. Soft constraints (spring, mouse) use Erin Catto's gamma/beta formulation to convert user-friendly frequency/dampingRatio parameters into solver terms. Rigid constraints (distance, revolute point-to-point) use Baumgarte stabilization matching the existing contact solver pattern.

**Primary recommendation:** Define a `Constraint` interface with `preStep(dt)` and `solveVelocity()` methods. Implement each constraint type as a class implementing this interface. Integrate into `World.singleStep()` by calling constraint preStep/solve alongside the existing `ContactSolver`. Use local-space anchor points for all constraints. Use frequency/dampingRatio (hertz model) for spring and mouse constraints.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No locked decisions — all implementation choices are at Claude's discretion.

### Claude's Discretion
- **Constraint API surface**: API style (standalone classes vs factory methods), anchor point specification (local-space vs world-space), parameter mutability, constraint architecture (common interface vs independent types)
- **Spring behavior**: Parameter model (frequency/damping ratio vs raw stiffness/damping), rest length defaults, max force capping, whether distance and spring are separate or unified
- **Revolute joint limits**: Motor support, limit feel (hard stops vs soft compliance), reference angle computation, runtime constraint removal
- **Mouse constraint feel**: Drag stiffness, max force capping, attach point (click point vs center), lifecycle (auto-destroy vs persist)

All implementation decisions should follow established conventions from Box2D, Matter.js, Planck.js.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONS-01 | Distance constraint — maintain fixed distance between two body anchor points | Rigid 1D constraint along separation axis with Baumgarte stabilization. Uses effective mass = 1/(invMassA + invMassB + angular terms). Accumulated impulse clamped >= 0 for pull-only, or unclamped for full distance. |
| CONS-02 | Spring constraint — elastic distance with configurable stiffness and damping | Soft constraint using Catto's gamma/beta formulation: omega=2*pi*hertz, gamma=1/(h*(d+h*k)), beta=h*k*gamma. Impulse includes softness feedback term. |
| CONS-03 | Revolute/pin joint — two bodies share a hinge point, free rotation, optional angle limits | 2D point-to-point constraint (2x2 effective mass matrix K). Angle limits use 1D angular constraint with accumulated clamping. Motor optional for Phase 6 ragdoll. |
| CONS-04 | Mouse/pointer constraint — spring from body point to mouse position for interactive dragging | Soft 2D constraint (2x2 mass matrix with gamma). Uses frequency/dampingRatio. Max force clamping prevents violent reactions. Only needs bodyB (bodyA is ground/world). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| No external libraries | N/A | All constraint math is hand-rolled | Project mandate: "every line of it". Constraints are core solver math, not utility code. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (existing) | Unit testing constraints | Test each constraint type in isolation and integration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Frequency/damping ratio model | Raw stiffness/damping coefficients | Frequency/damping is more intuitive (Box2D standard). Raw k/d requires users to understand mass-dependent tuning. Use frequency/damping. |
| Separate DistanceConstraint + SpringConstraint | Unified class with optional stiffness | Separate classes are clearer in intent. A distance constraint with stiffness=Infinity is confusing. Use separate classes. |
| 2x2 Mat2 for revolute/mouse mass | Inline 2x2 inversion | Existing Mat2 only does rotation. Inline 2x2 inverse is 4 lines of code and avoids allocations. Use inline. |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── constraints/           # NEW directory
│   ├── Constraint.ts      # Interface: preStep(dt), solveVelocity()
│   ├── DistanceConstraint.ts
│   ├── SpringConstraint.ts
│   ├── RevoluteConstraint.ts
│   ├── MouseConstraint.ts
│   └── index.ts
├── engine/
│   └── World.ts           # MODIFIED: add constraint storage + solver integration
└── ...existing...
```

### Pattern 1: Constraint Interface
**What:** A common interface that all constraint types implement, enabling uniform solver integration.
**When to use:** Always — this is how the World iterates over constraints.
**Example:**
```typescript
// Source: Box2D / Planck.js pattern
interface Constraint {
  /** Pre-compute Jacobians, effective masses, warm-start. Called once per step. */
  preStep(dt: number): void;
  /** Solve velocity constraint. Called N times per step for convergence. */
  solveVelocity(): void;
}
```

### Pattern 2: Local-Space Anchor Points
**What:** Store anchor points in body-local coordinates. Transform to world space each step using body position + angle.
**When to use:** Always — handles body rotation correctly across frames.
**Example:**
```typescript
// Transform local anchor to world space
// Source: Box2D convention
const cosA = Math.cos(body.angle);
const sinA = Math.sin(body.angle);
const worldAnchorX = body.position.x + cosA * localAnchor.x - sinA * localAnchor.y;
const worldAnchorY = body.position.y + sinA * localAnchor.x + cosA * localAnchor.y;
// Lever arm for torque computation
const rX = worldAnchorX - body.position.x;
const rY = worldAnchorY - body.position.y;
```

### Pattern 3: Soft Constraint (Catto's Gamma/Beta)
**What:** Convert frequency + damping ratio into solver-compatible gamma and bias terms for spring-like behavior.
**When to use:** Spring constraint and mouse constraint.
**Example:**
```typescript
// Source: Erin Catto GDC 2011 "Soft Constraints", Box2D source
const omega = 2 * Math.PI * hertz;
const d = 2 * mass * dampingRatio * omega;  // damping coefficient
const k = mass * omega * omega;             // spring stiffness
const h = dt;
const gamma = 1 / (h * (d + h * k));        // softness
const beta = h * k * gamma;                  // Baumgarte factor for spring

// In solve: impulse = -effectiveMass * (Cdot + bias + gamma * accumulatedImpulse)
// effectiveMass = 1 / (J * M^-1 * J^T + gamma)
```

### Pattern 4: Accumulated Impulse Clamping
**What:** Track total accumulated impulse across iterations and clamp the total, not the delta.
**When to use:** All constraints (matches existing ContactSolver pattern).
**Example:**
```typescript
// Source: Box2D sequential impulse pattern (already used in ContactSolver)
const oldImpulse = this.accumulatedImpulse;
this.accumulatedImpulse = Math.max(oldImpulse + lambda, 0); // or clamp to bounds
const appliedLambda = this.accumulatedImpulse - oldImpulse;
```

### Pattern 5: World Integration Point
**What:** World stores a constraints array and calls preStep/solveVelocity alongside the ContactSolver.
**When to use:** In `World.singleStep()`.
**Example:**
```typescript
// In World.singleStep():
// Phase 3: Solve constraints (contacts + joints together)
this.solver.preStep(manifolds, dt);
for (const c of this.constraints) c.preStep(dt);

for (let iter = 0; iter < velocityIterations; iter++) {
  for (const c of this.constraints) c.solveVelocity();
  this.solver.solve();
}
```

### Anti-Patterns to Avoid
- **World-space anchor storage:** Storing anchors in world space requires manual updates when bodies rotate. Always store in local space and transform each step.
- **Per-iteration impulse clamping:** Clamping each iteration's delta instead of the accumulated total causes jitter. Use accumulated clamping (already established in this codebase).
- **Allocating Vec2 in hot loops:** The existing codebase uses inline x/y arithmetic in solve() to avoid GC pressure. Constraints must follow this pattern.
- **Solving joints before contacts:** Box2D solves joints and contacts interleaved in the same iteration loop, not sequentially. This improves convergence for systems where joints and contacts interact (e.g., ragdoll on ground).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 2x2 matrix inverse | General Mat2 inverse | Inline 2x2 Cramer's rule (4 lines) | The existing Mat2 is for rotations only. A 2x2 symmetric inverse is: `det = a*d - b*c; invDet = 1/det; result = [d, -b, -c, a] * invDet`. Trivial to inline. |
| Frequency-to-solver conversion | Custom spring math | Catto's gamma/beta formulas (proven, standard) | These formulas are derived from second-order ODE discretization. Custom derivations will have stability issues. |
| Pair exclusion for joints | Custom collision filter modification | Existing `World.addPairExclusion()` | Already built in Phase 3 specifically for this purpose. |

**Key insight:** The constraint math itself IS the implementation — there are no libraries to use. But the formulas are well-established (Catto's papers, Box2D source). Follow them precisely rather than deriving from scratch.

## Common Pitfalls

### Pitfall 1: Forgetting to Exclude Joint Pairs from Collision
**What goes wrong:** Two bodies connected by a revolute joint constantly collide at the shared point, causing jitter and instability.
**Why it happens:** Joints bring bodies close together but the collision system doesn't know they're connected.
**How to avoid:** Call `world.addPairExclusion(bodyA.id, bodyB.id)` when creating distance, spring, and revolute constraints. Optionally make it configurable via `collideConnected` parameter (default: false).
**Warning signs:** Bodies at joints vibrate or explode apart.

### Pitfall 2: Using World-Space Anchors That Drift
**What goes wrong:** After a body rotates, the world-space anchor no longer corresponds to the original local point on the body.
**Why it happens:** Storing world-space coordinates instead of local-space.
**How to avoid:** Always store `localAnchorA` / `localAnchorB` in body-local space. Transform to world space in `preStep()` using `body.position + rotate(localAnchor, body.angle)`.
**Warning signs:** Constraints "slide" around the body surface after rotation.

### Pitfall 3: Soft Constraint Instability at High Frequency
**What goes wrong:** Spring/mouse constraints explode or oscillate violently when frequency is too high relative to timestep.
**Why it happens:** Nyquist limit — frequency must be less than half the simulation frequency (< 30Hz for 60Hz timestep).
**How to avoid:** Clamp hertz to `0.5 * (1/dt)` or document the limit. Box2D recommends frequency < half the timestep frequency.
**Warning signs:** Spring bodies oscillate with increasing amplitude instead of settling.

### Pitfall 4: Revolute Angle Limit Wraparound
**What goes wrong:** Joint angle wraps around at +/-pi, causing limits to flip between active and inactive.
**Why it happens:** `atan2` returns values in [-pi, pi] and the relative angle can cross this boundary.
**How to avoid:** Track relative angle incrementally or use `referenceAngle` (initial angle offset) and compute `currentAngle = bodyB.angle - bodyA.angle - referenceAngle`. Clamp limits to [-0.95*pi, 0.95*pi] as Box2D does to avoid the singularity.
**Warning signs:** Joint "snaps" when rotating past 180 degrees.

### Pitfall 5: Mouse Constraint with Zero Max Force
**What goes wrong:** Mouse constraint applies no force, body doesn't follow.
**Why it happens:** Default maxForce of 0. Box2D convention is to set maxForce = some_multiple * mass * gravity.
**How to avoid:** Compute a sensible default like `1000 * body.mass` or require explicit maxForce. Document that maxForce must be positive.
**Warning signs:** Body doesn't respond to mouse dragging.

### Pitfall 6: GC Pressure from Vec2 Allocations in Solve Loop
**What goes wrong:** Frame rate drops due to garbage collection in solve() called 8+ times per step.
**Why it happens:** Creating temporary Vec2 objects for intermediate calculations.
**How to avoid:** Use inline x/y arithmetic throughout `preStep()` and `solveVelocity()`, matching the existing ContactSolver pattern. No `new Vec2()` in hot paths.
**Warning signs:** Periodic frame hitches, increasing memory in profiler.

## Code Examples

### Distance Constraint preStep
```typescript
// Source: Box2D / Planck.js DistanceJoint pattern
preStep(dt: number): void {
  const bodyA = this.bodyA;
  const bodyB = this.bodyB;

  // Transform local anchors to world space
  const cosA = Math.cos(bodyA.angle);
  const sinA = Math.sin(bodyA.angle);
  this.rAx = cosA * this.localAnchorA.x - sinA * this.localAnchorA.y;
  this.rAy = sinA * this.localAnchorA.x + cosA * this.localAnchorA.y;

  const cosB = Math.cos(bodyB.angle);
  const sinB = Math.sin(bodyB.angle);
  this.rBx = cosB * this.localAnchorB.x - sinB * this.localAnchorB.y;
  this.rBy = sinB * this.localAnchorB.x + cosB * this.localAnchorB.y;

  // Separation vector (world space)
  const dx = bodyB.position.x + this.rBx - bodyA.position.x - this.rAx;
  const dy = bodyB.position.y + this.rBy - bodyA.position.y - this.rAy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Unit direction
  if (dist > 1e-6) {
    this.nx = dx / dist;
    this.ny = dy / dist;
  } else {
    this.nx = 0;
    this.ny = 0;
  }

  // Effective mass (1D along constraint axis)
  const rAxN = this.rAx * this.ny - this.rAy * this.nx;
  const rBxN = this.rBx * this.ny - this.rBy * this.nx;
  const invMassSum = bodyA.invMass + bodyB.invMass +
    bodyA.invInertia * rAxN * rAxN +
    bodyB.invInertia * rBxN * rBxN;
  this.mass = invMassSum > 0 ? 1 / invMassSum : 0;

  // Baumgarte bias (position correction)
  const C = dist - this.length;  // constraint error
  const beta = 0.2;  // matches existing solver constant
  this.bias = (beta / dt) * C;

  // Warm start
  const px = this.impulse * this.nx;
  const py = this.impulse * this.ny;
  bodyA.velocity.x -= px * bodyA.invMass;
  bodyA.velocity.y -= py * bodyA.invMass;
  bodyA.angularVelocity -= (this.rAx * py - this.rAy * px) * bodyA.invInertia;
  bodyB.velocity.x += px * bodyB.invMass;
  bodyB.velocity.y += py * bodyB.invMass;
  bodyB.angularVelocity += (this.rBx * py - this.rBy * px) * bodyB.invInertia;
}
```

### Spring Constraint solveVelocity (with soft constraint)
```typescript
// Source: Erin Catto "Soft Constraints" GDC 2011
solveVelocity(): void {
  const bodyA = this.bodyA;
  const bodyB = this.bodyB;

  // Relative velocity at constraint point projected onto axis
  const vpAx = bodyA.velocity.x + (-bodyA.angularVelocity * this.rAy);
  const vpAy = bodyA.velocity.y + (bodyA.angularVelocity * this.rAx);
  const vpBx = bodyB.velocity.x + (-bodyB.angularVelocity * this.rBy);
  const vpBy = bodyB.velocity.y + (bodyB.angularVelocity * this.rBx);

  const Cdot = (vpBx - vpAx) * this.nx + (vpBy - vpAy) * this.ny;

  // Soft constraint impulse (includes gamma feedback + bias)
  const lambda = -this.softMass * (Cdot + this.bias + this.gamma * this.impulse);
  this.impulse += lambda;

  // Apply impulse
  const px = lambda * this.nx;
  const py = lambda * this.ny;
  bodyA.velocity.x -= px * bodyA.invMass;
  bodyA.velocity.y -= py * bodyA.invMass;
  bodyA.angularVelocity -= (this.rAx * py - this.rAy * px) * bodyA.invInertia;
  bodyB.velocity.x += px * bodyB.invMass;
  bodyB.velocity.y += py * bodyB.invMass;
  bodyB.angularVelocity += (this.rBx * py - this.rBy * px) * bodyB.invInertia;
}
```

### Revolute Joint — 2x2 Point Constraint + Angular Limit
```typescript
// Source: Box2D / Planck.js RevoluteJoint
// Point constraint: anchor points must coincide (2 DOF removed)
// In preStep, build 2x2 K matrix:
const k11 = mA + mB + iA * rAy * rAy + iB * rBy * rBy;
const k12 = -iA * rAx * rAy - iB * rBx * rBy;
const k22 = mA + mB + iA * rAx * rAx + iB * rBx * rBx;
// Invert K using Cramer's rule
const det = k11 * k22 - k12 * k12;
const invDet = det !== 0 ? 1 / det : 0;
// effectiveMass = K^-1
const em11 = k22 * invDet;
const em12 = -k12 * invDet;
const em22 = k11 * invDet;

// Angle limit (1D angular constraint):
const angle = bodyB.angle - bodyA.angle - this.referenceAngle;
if (angle <= this.lowerAngle) {
  // at lower limit: clamp accumulated angular impulse >= 0
} else if (angle >= this.upperAngle) {
  // at upper limit: clamp accumulated angular impulse <= 0
}
```

### Mouse Constraint — 2D Soft Constraint
```typescript
// Source: Box2D MouseJoint
// In preStep:
const omega = 2 * Math.PI * this.hertz;
const d = 2 * mass * this.dampingRatio * omega;
const k = mass * omega * omega;
const h = dt;
this.gamma = h * (d + h * k);
this.gamma = this.gamma !== 0 ? 1 / this.gamma : 0;
this.beta = h * k * this.gamma;

// K matrix (2x2) — only bodyB contributes (bodyA is "world/ground")
const k11 = invMassB + invIB * rBy * rBy + this.gamma;
const k12 = -invIB * rBx * rBy;
const k22 = invMassB + invIB * rBx * rBx + this.gamma;
// Invert to get mass matrix

// In solveVelocity:
// Cdot = vB + wB x rB
// impulse = -mass * (Cdot + beta * C + gamma * accumulatedImpulse)
// Clamp: |accumulatedImpulse| <= dt * maxForce
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw stiffness/damping (k, d) | Frequency/damping ratio (hertz, zeta) | Box2D v2.x | Much more intuitive tuning; parameters are mass-independent |
| Position-level spring forces | Velocity-level soft constraints (gamma/beta) | Catto GDC 2011 | Integrates cleanly with sequential impulse solver; no separate spring force step |
| Separate spring force + rigid constraint | Unified soft constraint formulation | Box2D v2.x | Single code path handles both rigid and elastic constraints |
| Full Baumgarte for all constraints | Baumgarte for contacts, soft constraints for springs | Box2D convention | Better energy conservation for spring behavior |

**Deprecated/outdated:**
- Force-based springs (apply F=kx each frame): Unstable with sequential impulse solvers. Use velocity-level soft constraints instead.
- World-space anchor storage: All modern engines use local-space anchors.

## Open Questions

1. **Motor support for revolute joint**
   - What we know: Box2D revolute joints support motors (targetSpeed + maxTorque). Phase 6 ragdoll demo may benefit from motors.
   - What's unclear: Whether ragdoll requires motors or just angle limits.
   - Recommendation: Implement motor support — it's minimal additional code (1D angular constraint with speed target) and enables more interesting demos. If not needed, the cost is ~20 lines.

2. **Distance constraint: pull-only vs bilateral**
   - What we know: Box2D v3 distance joint supports min/max length. A "rope" is pull-only (no push). A "rod" is bilateral.
   - What's unclear: Which behavior CONS-01 expects.
   - Recommendation: Implement bilateral (maintains exact distance in both directions). This is simpler and matches "maintain fixed distance" requirement. No min/max range needed for v1.

3. **Should distance and spring share a base class?**
   - What we know: They share identical Jacobian computation and anchor handling. They differ only in whether gamma/beta are used.
   - What's unclear: Whether code reuse justifies a shared base.
   - Recommendation: Keep them separate classes — the code duplication is small (~30 lines of anchor transform + effective mass), and separate classes are clearer for users and debugging.

## Sources

### Primary (HIGH confidence)
- [Box2D Official Documentation — Distance Joint](https://box2d.org/documentation/group__distance__joint.html)
- [Box2D Official Documentation — Revolute Joint](https://box2d.org/documentation/group__revolute__joint.html)
- [Box2D Official Documentation — Mouse Joint](https://box2d.org/documentation/group__mouse__joint.html)
- [Box2D Official Documentation — Simulation](https://box2d.org/documentation/md_simulation.html)
- [Erin Catto "Soft Constraints" GDC 2011](https://box2d.org/files/ErinCatto_SoftConstraints_GDC2011.pdf)
- [Erin Catto "Sequential Impulses" GDC 2006](https://box2d.org/files/ErinCatto_SequentialImpulses_GDC2006.pdf)
- [Erin Catto "Modeling and Solving Constraints" GDC 2009](https://box2d.org/files/ErinCatto_ModelingAndSolvingConstraints_GDC2009.pdf)
- Planck.js source: [DistanceJoint.ts](https://github.com/piqnt/planck.js/blob/master/src/dynamics/joint/DistanceJoint.ts), [RevoluteJoint.ts](https://github.com/piqnt/planck.js/blob/master/src/dynamics/joint/RevoluteJoint.ts), [MouseJoint.ts](https://github.com/piqnt/planck.js/blob/master/src/dynamics/joint/MouseJoint.ts)

### Secondary (MEDIUM confidence)
- [Box2D-Lite Walkthrough: Softening Constraints](https://cedarcantab.wordpress.com/2022/09/21/box2d-lite-walkthrough-in-javascript-softening-constraints/) — Verified against Catto's papers
- [Box2D Solver2D blog post](https://box2d.org/posts/2024/02/solver2d/) — Solver architecture comparison
- [iforce2d: Revolute Joint Tutorial](https://www.iforce2d.net/b2dtut/joints-revolute)

### Tertiary (LOW confidence)
- [GameDev.net: Soft constraint oscillation](https://www.gamedev.net/forums/topic/711860-soft-constraint-with-sequential-impulse-solver-oscillation-issues/5445803/) — Community discussion, verified formulas match Catto's

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — This is hand-rolled physics math, no library choices needed. All formulas from Catto's published papers.
- Architecture: HIGH — Constraint interface pattern is universal across Box2D, Planck.js, Matter.js. Existing codebase has clear integration points (World.singleStep, pair exclusions).
- Pitfalls: HIGH — Well-documented in Box2D community. Anchor space, Nyquist limit, angle wraparound are classic issues.

**Research date:** 2026-02-22
**Valid until:** Indefinite — constraint solver math is mature/stable physics, not evolving library APIs.
