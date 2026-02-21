---
phase: 03-solver-and-engine-loop
verified: 2026-02-21T18:09:30Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 3: Solver and Engine Loop Verification Report

**Phase Goal:** Colliding bodies respond physically correct -- they bounce, slide with friction, and stack stably under the fixed-timestep simulation loop
**Verified:** 2026-02-21T18:09:30Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

#### Plan 03-01: ContactSolver (SOLV-01 through SOLV-06)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Solver computes correct normal impulse that prevents bodies from interpenetrating | VERIFIED | `ContactSolver.solve()` computes `lambda = normalMass * (-vn + bias)`, applies to both bodies; test "swap velocities for two equal-mass dynamic bodies" passes |
| 2 | Restitution coefficient controls bounce height proportionally | VERIFIED | `bias += restitution * (-vn)` in `preStep`; test "bounce ball back to original velocity magnitude off static floor (e=1)" passes (ball.velocity.y > 9 after e=1 collision) |
| 3 | Coulomb friction clamps tangent impulse to mu * normalImpulse | VERIFIED | Lines 222-228 of ContactSolver.ts: `maxFriction = friction * normalImpulse`, accumulated `newTangentImpulse` clamped to `[-maxFriction, maxFriction]`; friction tests pass |
| 4 | Accumulated impulse clamping allows corrective negative deltas across iterations | VERIFIED | `newNormalImpulse = Math.max(oldNormalImpulse + lambda, 0); lambda = newNormalImpulse - oldNormalImpulse`; test "normalImpulse >= 0 across multiple solve iterations" passes |
| 5 | Warm-starting applies cached impulses from previous frame before iterating | VERIFIED | `preStep` applies `contact.normalImpulse` and `contact.tangentImpulse` to body velocities before solve loop begins; test "apply cached impulses before iteration, modifying body velocity" passes |
| 6 | Baumgarte position correction pushes overlapping bodies apart with slop dead-zone | VERIFIED | `if (penetration > 0) bias += (beta * invDt) * penetration` where `penetration = contact.depth - slop`; test "produce positive bias for penetrating contact" passes (ball.velocity.y > 0) |

#### Plan 03-02: World Engine Loop (BODY-06)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | World.step(frameDt) runs a deterministic number of fixed-timestep physics steps regardless of frameDt | VERIFIED | Accumulator pattern in `World.step()`; determinism test (step at 1/60 x60 vs 1/30 x30 yields identical positions) passes |
| 8 | World.step() returns interpolation alpha (0-1) for smooth rendering between physics states | VERIFIED | `return this.accumulator / fixedDt`; three interpolation alpha tests pass (returns ~0, ~0.5, and positive fractional values) |
| 9 | Large frameDt values are clamped to prevent spiral of death (max 5 steps) | VERIFIED | `const clamped = Math.min(frameDt, maxSteps * fixedDt)`; spiral of death test (step(1.0) matches 5 fixed steps) passes |
| 10 | Each fixed step executes in correct order: integrate velocities -> detect collisions -> solve constraints -> integrate positions -> clear forces | VERIFIED | `singleStep()` lines 119-154: Phase 1 velocity integration, Phase 2 `collisionSystem.detect(bodies)`, Phase 3 `solver.preStep` + `solver.solve()` x N, Phase 4 position integration, Phase 5 `force.set(0,0)` |
| 11 | Bodies added to World participate in simulation; removed bodies do not | VERIFIED | `addBody()`/`removeBody()` via splice; tests "added body participates" and "removed body no longer participates" both pass |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/solver/ContactSolver.ts` | Sequential impulse constraint solver | VERIFIED | 244 lines; exports `ContactSolver`; full `preStep`/`solve` lifecycle with inline x/y arithmetic |
| `src/solver/SolverConstants.ts` | Configurable solver tuning parameters | VERIFIED | 20 lines; exports `SolverConstants` interface and `DEFAULT_SOLVER_CONSTANTS` constant |
| `src/solver/index.ts` | Barrel exports for solver module | VERIFIED | Exports `ContactSolver`, `DEFAULT_SOLVER_CONSTANTS`, `SolverConstants` |
| `tests/solver/ContactSolver.test.ts` | Solver correctness tests (min 100 lines) | VERIFIED | 299 lines; 10 tests covering normal, friction, warm-start, clamping, Baumgarte, static body |
| `src/engine/World.ts` | Fixed-timestep simulation loop and body management | VERIFIED | 184 lines; exports `World`; full step pipeline, addBody/removeBody, event forwarding, pair exclusion |
| `src/engine/WorldSettings.ts` | Configurable world settings | VERIFIED | 37 lines; exports `WorldSettings` interface and `DEFAULT_WORLD_SETTINGS` constant |
| `src/engine/index.ts` | Barrel exports for engine module | VERIFIED | Exports `World`, `DEFAULT_WORLD_SETTINGS`, `WorldSettings` |
| `tests/engine/World.test.ts` | Engine loop correctness tests (min 80 lines) | VERIFIED | 313 lines; 14 tests covering determinism, alpha, spiral of death, gravity, collision, body lifecycle, force clearing, events |

---

### Key Link Verification

#### Plan 03-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/solver/ContactSolver.ts` | `src/collision/Manifold.ts` | `preStep` takes `Manifold[]` input | WIRED | Line 56: `preStep(manifolds: Manifold[], dt: number)` and `manifold.contacts`, `manifold.normal`, etc. accessed throughout |
| `src/solver/ContactSolver.ts` | `src/dynamics/Body.ts` | modifies `body.velocity` and `body.angularVelocity` | WIRED | Lines 156-163 (warm-start), 204-210, 235-241 (solve): `bodyA.velocity.x -=`, `bodyB.angularVelocity +=` directly |
| `src/solver/ContactSolver.ts` | `src/collision/Manifold.ts` | reads/writes `contact.normalImpulse` and `contact.tangentImpulse` | WIRED | `contact.normalImpulse` read/written at lines 195-198; `contact.tangentImpulse` read/written at lines 224-229 |

#### Plan 03-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/engine/World.ts` | `src/solver/ContactSolver.ts` | creates solver, calls `preStep` + N * `solve` each fixed step | WIRED | Line 44: `new ContactSolver(...)`, Line 135: `this.solver.preStep(manifolds, dt)`, Lines 136-138: `for (...) this.solver.solve()` |
| `src/engine/World.ts` | `src/collision/CollisionSystem.ts` | calls `detect(bodies)` each fixed step | WIRED | Line 132: `const manifolds = this.collisionSystem.detect(bodies)` |
| `src/engine/World.ts` | `src/dynamics/Body.ts` | iterates bodies for velocity/position integration | WIRED | Lines 120-129 (velocity), 141-147 (position), 150-154 (force clear): inline body mutation |
| `src/index.ts` | `src/engine/index.ts` | barrel re-export | WIRED | Line 7: `export * from './engine/index.js'` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SOLV-01 | 03-01 | Sequential impulses (iterative PGS) velocity solver with configurable iteration count | SATISFIED | `ContactSolver` class with `solve()` called `velocityIterations` times in `World.singleStep`; `SolverConstants.velocityIterations=8` |
| SOLV-02 | 03-01 | Normal impulse resolution with restitution (bounciness) | SATISFIED | `bias += restitution * (-vn)` in preStep; elastic and inelastic test cases pass |
| SOLV-03 | 03-01 | Tangential friction impulse with Coulomb friction model | SATISFIED | Friction solve block lines 212-241; Coulomb cone clamped to `friction * normalImpulse`; friction tests pass |
| SOLV-04 | 03-01 | Position correction via Baumgarte stabilization to resolve penetration | SATISFIED | `bias += (beta * invDt) * penetration` with slop dead-zone; Baumgarte test passes |
| SOLV-05 | 03-01 | Accumulated impulse clamping (not per-iteration clamping) | SATISFIED | Running total on `contact.normalImpulse`, delta computed per iteration; clamping invariant test passes |
| SOLV-06 | 03-01 | Warm starting — cache and reapply impulses from previous frame via contact persistence | SATISFIED | `preStep` reads `contact.normalImpulse`/`contact.tangentImpulse` cached from prior frame and applies before iteration; warm-start test passes |
| BODY-06 | 03-02 | Fixed timestep simulation loop with accumulator pattern and interpolation | SATISFIED | `World.step()` accumulator clamp -> loop singleStep -> return alpha; determinism and alpha tests pass |

**Orphaned requirements:** None. All 7 requirement IDs declared in plan frontmatter are accounted for. REQUIREMENTS.md traceability table maps exactly SOLV-01 through SOLV-06 and BODY-06 to Phase 3 — all marked Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODOs, FIXMEs, placeholder returns, empty handlers, or console.log stubs found in any phase-3 files.

---

### Human Verification Required

None. All phase goal truths are directly observable through unit and integration tests, which pass. No visual rendering, real-time behavior, or external service integration is involved in this phase.

---

### Summary

All 11 must-have truths are verified. The phase goal — "Colliding bodies respond physically correct: they bounce, slide with friction, and stack stably under the fixed-timestep simulation loop" — is fully achieved.

**ContactSolver (Plan 03-01):**
- Sequential impulse solver with correct Box2D-style formula (`lambda = normalMass * (-vn + bias)`)
- Restitution controls bounce velocity proportionally (e=0 inelastic through e=1 fully elastic)
- Coulomb friction correctly clamps tangent impulse to the friction cone
- Accumulated clamping stores running total on `ContactPoint`, computes delta per iteration — normal impulse invariant `>= 0` holds across all iterations
- Warm-starting reads cached `normalImpulse`/`tangentImpulse` from `ContactPoint` and applies them in `preStep` before the solve loop
- Baumgarte stabilization adds position-correcting bias with penetration slop dead-zone

**World (Plan 03-02):**
- Fixed-timestep accumulator with spiral-of-death cap (`maxSteps = 5`)
- Correct split-integration pipeline: velocity integration occurs before collision detection; position integration occurs after constraint solving
- Returns interpolation alpha for renderer consumption
- All 14 engine integration tests pass including end-to-end collision response (two circles bounce)

**Test results:** 24/24 tests pass (10 solver + 14 engine). Build is clean with no TypeScript errors.

---

_Verified: 2026-02-21T18:09:30Z_
_Verifier: Claude (gsd-verifier)_
