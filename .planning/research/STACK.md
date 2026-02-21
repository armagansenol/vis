# Stack Research

**Domain:** 2D Physics Engine (TypeScript library, zero runtime dependencies)
**Researched:** 2026-02-21
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.9.3 | Language | Latest stable release (Aug 2025). Full type safety, `.d.ts` generation for consumers. TS 6.0 is a bridge release — stay on 5.9 until 6.x stabilizes. **Confidence: HIGH** |
| Node.js | >= 22.x | Runtime (dev only) | LTS with native TypeScript strip-types support. Required by tsdown (>= 20.19). 22.x is the current LTS line. **Confidence: HIGH** |
| tsdown | 0.20.x | Library bundler | Replaces tsup as the standard library bundler. Built on Rolldown (Rust), dramatically faster builds, superior `.d.ts` generation via rolldown-plugin-dts. Produces ESM + CJS dual output with zero config. From the void(0) team (same as Vite/Vitest). tsup (8.5.1) still works but is no longer actively maintained — tsdown is the forward path. **Confidence: MEDIUM** (v0.x but actively developed, 89+ dependents) |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vitest | 4.0.x | Testing | The standard testing framework for modern JS/TS (17M+ weekly downloads). Native TypeScript support, fast watch mode, built-in coverage via `@vitest/coverage-v8`. No JSDOM needed — this is a pure math/logic library. **Confidence: HIGH** |
| Biome | 2.3.x | Linting + Formatting | Single tool replaces ESLint + Prettier. 10-100x faster. Zero config for TypeScript. For a zero-dependency math library, Biome's rule coverage is more than sufficient. Type-aware linting covers ~85% of cases without tsc overhead. **Confidence: HIGH** |
| TypeScript compiler | 5.9.3 | Type checking (CI) | Run `tsc --noEmit` in CI for full type checking. Biome handles day-to-day linting; tsc catches what Biome's type synthesizer misses. **Confidence: HIGH** |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitest/coverage-v8` | 4.0.x | Code coverage | Use from the start. Physics engines need high test coverage — math bugs are subtle. |
| `@biomejs/biome` | 2.3.x | CLI for linting/formatting | Install as devDep. Single binary, no transitive dependencies. |
| `vite` | 7.x | Dev server for demos | Only for the demo/playground pages. Provides HMR for Canvas demos during development. Not used for library builds. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| gl-matrix / any math library | PROJECT.md mandates zero runtime dependencies. You are building the math from scratch. Vec2, Mat2x2, etc. are part of the engine. | Write your own `Vec2`, `Mat2` classes. This is the whole point — full understanding and control. |
| tsup | No longer actively maintained. Slower `.d.ts` generation. tsdown is its spiritual successor from the same ecosystem. | tsdown |
| Webpack | Massive overkill for a library. Complex config. Designed for applications, not libraries. | tsdown |
| Rollup (raw) | Requires extensive plugin configuration for TypeScript. tsdown wraps Rolldown and handles this automatically. | tsdown |
| Jest | Slower than Vitest, requires ts-jest or SWC transform config. Vitest runs TypeScript natively. | Vitest |
| ESLint + Prettier | Two tools, complex config, hundreds of transitive dependencies. For a greenfield library in 2026, Biome is the simpler and faster choice. | Biome |
| Babel | Not needed. TypeScript handles all transpilation. tsdown/Rolldown handles bundling. | tsdown |
| JSDOM / happy-dom | This is a headless math library. Canvas rendering tests should use unit tests against the drawing call sequence, not a simulated DOM. | Mock `CanvasRenderingContext2D` in Vitest |
| ECS frameworks (bitecs, etc.) | Out of scope per PROJECT.md. Adds architectural complexity without matching the learning goal. | Direct object/class composition |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| tsdown | tsup 8.5.x | If tsdown's v0.x status causes issues (breaking changes). tsup is the stable fallback — same API shape, just slower. |
| tsdown | Vite library mode | If you later add a component library or Storybook-style playground. For pure TS library output, tsdown is simpler. |
| Biome | ESLint 10 + typescript-eslint 8.56 | If you need specific ESLint plugins (security, accessibility). Not relevant for a physics engine library. |
| Vitest | Node.js built-in test runner | If you want zero dev dependencies for testing. But Vitest's watch mode, coverage, and snapshot testing are worth the dependency. |
| Custom Vec2 | gl-matrix vec2 | Never for this project. Zero-dependency constraint is absolute. |

## Canvas Rendering Patterns

Since the project includes a built-in Canvas 2D renderer, here are the standard patterns:

### Fixed Timestep Game Loop (the standard)

```typescript
const TIMESTEP = 1000 / 60; // 16.67ms fixed physics step
let lastTime = 0;
let accumulator = 0;

function loop(currentTime: number): void {
  const elapsed = currentTime - lastTime;
  lastTime = currentTime;
  accumulator += elapsed;

  // Fixed-step physics updates (deterministic)
  while (accumulator >= TIMESTEP) {
    world.step(TIMESTEP / 1000); // pass seconds
    accumulator -= TIMESTEP;
  }

  // Render once per frame with interpolation
  const alpha = accumulator / TIMESTEP;
  renderer.render(world, alpha);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

**Why:** Decouples physics from frame rate. Physics runs at a fixed 60Hz regardless of monitor refresh rate (60Hz, 120Hz, 144Hz). The `alpha` interpolation factor smooths rendering between physics steps. This is the Glenn Fiedler "Fix Your Timestep" pattern — the gold standard for game physics.

### Canvas Context Pattern

```typescript
class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
  }

  render(world: World, alpha: number): void {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    for (const body of world.bodies) {
      this.ctx.save();
      // Interpolate position for smooth rendering
      const x = body.prevPosition.x + (body.position.x - body.prevPosition.x) * alpha;
      const y = body.prevPosition.y + (body.position.y - body.prevPosition.y) * alpha;
      this.ctx.translate(x, y);
      this.ctx.rotate(body.angle);
      body.shape.draw(this.ctx);
      this.ctx.restore();
    }
  }
}
```

### Testing Canvas Calls (without DOM)

```typescript
// In Vitest — mock CanvasRenderingContext2D
function createMockContext(): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    // ... only what you use
  } as unknown as CanvasRenderingContext2D;
}
```

## Installation

```bash
# Core dev dependencies
npm install -D typescript@5.9.3 tsdown @biomejs/biome vitest @vitest/coverage-v8

# Demo server (optional — for visual demos)
npm install -D vite
```

## Project Structure (Recommended)

```
vis/
  src/
    math/          # Vec2, Mat2, math utilities
    core/          # Body, Shape, World
    collision/     # AABB, SAT, broadphase, narrowphase
    dynamics/      # Solver, forces, impulses
    constraints/   # Joints, springs
    renderer/      # CanvasRenderer (ships with library)
    index.ts       # Public API exports
  tests/           # Mirror src/ structure
  demos/           # HTML + Canvas demo scenes (uses Vite)
  dist/            # tsdown output (ESM + CJS + .d.ts)
  tsconfig.json
  tsdown.config.ts
  biome.json
  vitest.config.ts
  package.json
```

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| tsdown 0.20.x | Node.js >= 20.19 | Requires modern Node.js |
| Vitest 4.0.x | TypeScript >= 5.0 | Native TS support, no transform config needed |
| Biome 2.3.x | TypeScript (any) | Parses TS natively in Rust, no TS dependency |
| typescript-eslint 8.56.x | ESLint 9.x / 10.x, TS < 6.0 | Only if you switch from Biome to ESLint |

## Stack Patterns by Variant

**If tsdown v0.x proves unstable:**
- Fall back to tsup 8.5.1
- Same CLI interface, same config shape
- Swap `tsdown` for `tsup` in package.json scripts

**If you need type-aware lint rules (e.g., no-floating-promises):**
- Keep Biome for formatting + basic linting
- Add `tsc --noEmit` to CI
- Or add ESLint 9 + typescript-eslint with `projectService` for targeted type-checked rules

**If demos need a framework later (React/Svelte):**
- Vite 7.x handles this naturally
- Physics engine remains framework-agnostic (it is a library)

## Sources

- [TypeScript 5.9 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html) -- HIGH confidence
- [tsdown npm](https://www.npmjs.com/package/tsdown) / [tsdown docs](https://tsdown.dev/guide/) -- MEDIUM confidence (v0.x, actively developed)
- [Vitest 4.0 Announcement](https://vitest.dev/blog/vitest-4) -- HIGH confidence
- [Biome 2.0 Blog](https://biomejs.dev/blog/biome-v2/) / [Biome Roadmap 2026](https://biomejs.dev/blog/roadmap-2026/) -- HIGH confidence
- [ESLint v10 Release](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/) -- HIGH confidence (alternative path)
- [typescript-eslint Getting Started](https://typescript-eslint.io/getting-started/) -- HIGH confidence (alternative path)
- [State of JavaScript 2025: Build Tools](https://2025.stateofjs.com/en-US/libraries/build-tools/) -- MEDIUM confidence
- [Glenn Fiedler "Fix Your Timestep"](https://gafferongames.com/post/fix-your-timestep/) -- HIGH confidence (canonical reference)
- [MDN Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_animations) -- HIGH confidence
- [tsup vs Vite/Rollup Comparison](https://dropanote.de/en/blog/20250914-tsup-vs-vite-rollup-when-simple-beats-complex/) -- MEDIUM confidence

---
*Stack research for: vis (2D Physics Engine in TypeScript)*
*Researched: 2026-02-21*
