# Phase 5: Renderer - Research

**Researched:** 2026-02-22
**Domain:** Canvas 2D rendering for rigid body physics visualization
**Confidence:** HIGH

## Summary

The renderer needs to draw all physics body shapes (circles, boxes, convex polygons) at their correct world positions and rotations on an HTML5 Canvas 2D context, provide toggleable debug overlays (AABBs, contact points, contact normals, constraint connections), and interpolate between physics steps for smooth visuals at any monitor refresh rate.

The codebase has a clean architecture with `World.step(frameDt)` already returning an interpolation alpha. However, three gaps must be addressed: (1) the World does not currently store previous body positions needed for render interpolation, (2) active manifolds are not exposed for debug contact rendering, and (3) constraint anchor positions are private and need accessor methods for debug constraint visualization.

The physics uses Y-up convention (gravity is `(0, -9.81)`) while Canvas 2D is Y-down. The renderer must apply a Y-axis flip coordinate transform. This is the standard approach used by Box2D testbed, Planck.js testbed, and Matter.js Render.

**Primary recommendation:** Build a standalone `Renderer` class that accepts a canvas element and a World reference, owns the `requestAnimationFrame` loop, reads body/constraint/manifold data each frame, applies interpolation, and draws with Canvas 2D. Add minimal public accessors to World, Body, and constraints to expose the data the renderer needs. Keep the renderer in `src/render/` following the existing directory convention.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No locked decisions -- all implementation choices are at Claude's discretion.

### Claude's Discretion
- Visual style: default body rendering (fill + outline, wireframe, or solid), color assignment (palette cycling vs single default), static vs dynamic body visual distinction, rotation indicators
- Debug overlay content: toggle granularity, extra debug info beyond required four, debug color scheme, constraint visualization style
- Canvas setup and sizing: canvas ownership, coordinate system, camera/viewport support, background style
- Interpolation and timing: render loop ownership, simulation coupling, pause/resume API, previous-state storage for interpolation
- All decisions should follow established patterns from physics engine renderers (Box2D debug draw, Matter.js Render, Planck.js testbed) and optimize for Phase 6 demo usability

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RNDR-01 | Canvas 2D renderer that draws bodies as their shape (circles, polygons) | Core Renderer class with shape dispatch (Circle vs Polygon), Canvas 2D drawing with fill+stroke, coordinate transform for Y-up physics to Y-down canvas |
| RNDR-02 | Debug drawing mode showing AABBs, contact points, contact normals, constraint connections | Debug overlay system with per-layer toggles, requires World to expose active manifolds, requires constraints to expose world-space anchor positions |
| RNDR-03 | Render interpolation between physics steps for smooth visuals at any frame rate | Previous-state storage on Body (prevPosition, prevAngle), saved before each physics step in World, lerp with alpha from World.step() |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Built-in | All rendering | Native browser API, zero dependencies, sufficient for thousands of bodies, used by Matter.js and Box2D testbed |

### Supporting
No external libraries needed. Canvas 2D API is fully sufficient for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D | WebGL/PixiJS | Better perf at 10K+ bodies, but massive complexity increase; explicitly out of scope per REQUIREMENTS.md |
| Custom renderer | Three.js 2D mode | 3D explicitly excluded; Canvas 2D sufficient for demo scenes |

**Installation:**
No new dependencies required.

## Architecture Patterns

### Recommended Project Structure
```
src/render/
├── Renderer.ts          # Main renderer class (body drawing, rAF loop, coordinate transforms)
├── DebugRenderer.ts     # Debug overlay drawing (AABBs, contacts, normals, constraints)
├── RenderOptions.ts     # Configuration types and defaults
└── index.ts             # Public exports
```

### Pattern 1: Renderer Owns the Loop
**What:** The Renderer class owns the `requestAnimationFrame` loop. Each frame it calls `world.step(frameDt)` to get alpha, then draws all bodies with interpolated positions.
**When to use:** Always -- this is the standard pattern from Matter.js Render and Planck.js testbed.
**Rationale:** The renderer is the natural owner of the frame loop because rendering drives the timing. The physics world provides `step(frameDt)` which handles the fixed-timestep accumulator internally.

```typescript
class Renderer {
  private running = false;
  private lastTime = 0;

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    const alpha = this.world.step(frameDt);
    this.draw(alpha);

    requestAnimationFrame(this.loop);
  };
}
```

### Pattern 2: Y-Up Coordinate Transform
**What:** Apply a canvas transform to flip Y-axis so physics Y-up matches canvas rendering.
**When to use:** Always -- physics uses Y-up (gravity = (0, -9.81)), canvas is Y-down.
**Rationale:** Standard approach from Box2D testbed and Planck.js testbed. Apply once per frame via `ctx.setTransform()`.

```typescript
// Set up coordinate system: origin at bottom-left, Y-up, scaled to pixels-per-meter
ctx.setTransform(
  scale,  0,
  0,     -scale,    // negative Y scale flips the axis
  offsetX, canvas.height - offsetY
);
```

### Pattern 3: Render Interpolation with Previous State
**What:** Store previous position/angle before each physics step, then lerp between previous and current using alpha for smooth rendering.
**When to use:** RNDR-03 requirement -- smooth visuals at any frame rate.
**Rationale:** This is the standard fixed-timestep interpolation technique from Glenn Fiedler's "Fix Your Timestep!" article, used by all serious physics engines.

```typescript
// In World.singleStep(), before integration:
for (const body of bodies) {
  body.prevPosition.x = body.position.x;
  body.prevPosition.y = body.position.y;
  body.prevAngle = body.angle;
}

// In Renderer.draw(alpha):
const renderX = lerp(body.prevPosition.x, body.position.x, alpha);
const renderY = lerp(body.prevPosition.y, body.position.y, alpha);
const renderAngle = lerp(body.prevAngle, body.angle, alpha);
```

### Pattern 4: Shape Type Dispatch for Drawing
**What:** Use the `ShapeType` discriminant enum to dispatch to circle or polygon drawing.
**When to use:** Every body draw call.
**Rationale:** The codebase already uses `ShapeType.Circle` and `ShapeType.Polygon` for collision dispatch. The renderer follows the same pattern.

```typescript
switch (body.shape.type) {
  case ShapeType.Circle:
    this.drawCircle(ctx, body.shape as Circle, renderX, renderY, renderAngle);
    break;
  case ShapeType.Polygon:
    this.drawPolygon(ctx, body.shape as Polygon, renderX, renderY, renderAngle);
    break;
}
```

### Pattern 5: Debug Overlay as Separate Pass
**What:** Draw debug overlays (AABBs, contacts, normals, constraints) as a separate pass after body rendering.
**When to use:** When debug mode is enabled.
**Rationale:** Keeps debug drawing decoupled from body rendering. Can be toggled independently. Follows Box2D's separate `b2DebugDraw` pattern.

### Anti-Patterns to Avoid
- **Modifying physics state in the renderer:** The renderer is read-only. Never write to body positions, velocities, or forces from render code.
- **Creating Vec2 objects per frame:** Use inline `x, y` arithmetic in the render loop to avoid GC pressure. The codebase already follows this pattern in the solver.
- **Coupling renderer to specific body/constraint implementations:** Read through the public interface (Body, Constraint), not private fields.
- **Interpolating static bodies:** Static bodies never move; skip interpolation for them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frame timing | Custom timer | `requestAnimationFrame` + `performance.now()` | Browser-optimized, VSync-aware, handles tab visibility |
| Canvas transforms | Manual matrix math | `ctx.setTransform()` / `ctx.save()`/`ctx.restore()` | Built-in, hardware-accelerated, correct |
| Color palette | Random color generation | Static palette array with index cycling | Deterministic, visually distinct, debuggable |

**Key insight:** Canvas 2D is well-optimized and provides all needed transforms natively. The complexity is in the data plumbing (exposing physics state for rendering), not in the drawing itself.

## Common Pitfalls

### Pitfall 1: Forgetting to Save Previous State Before Physics Step
**What goes wrong:** Interpolation renders current-frame positions (no smoothing) or garbage data from uninitialized previous state.
**Why it happens:** The previous state save must happen at the very start of `singleStep()`, before velocity integration. Easy to place it in the wrong spot.
**How to avoid:** Initialize `prevPosition` and `prevAngle` in the Body constructor (copy from initial position/angle). Save at the top of `World.singleStep()` before any integration.
**Warning signs:** Bodies visibly "jumping" between positions instead of smoothly transitioning.

### Pitfall 2: Incorrect Y-Axis Flip
**What goes wrong:** Bodies render upside down, or gravity appears to go up, or text/debug labels are mirrored.
**Why it happens:** Flipping Y with a negative scale in `setTransform` also mirrors text and arc directions.
**How to avoid:** For text and debug labels, temporarily save context, reset transform, draw in screen space, then restore. For `ctx.arc()`, the winding direction reverses in a flipped Y context -- use consistent winding.
**Warning signs:** Text appearing backwards, circles drawing incorrectly.

### Pitfall 3: Not Clamping frameDt on First Frame
**What goes wrong:** First frame has enormous frameDt (since `lastTime` starts at 0 or page load time), causing physics to take max steps and bodies to teleport.
**Why it happens:** `performance.now()` returns milliseconds since page load, not since last frame.
**How to avoid:** Initialize `lastTime` in `start()` using the first rAF callback's timestamp, or clamp frameDt to a reasonable max (e.g., 0.1s). The World already clamps via `maxSteps`, but large initial frameDt still wastes CPU on multiple steps.
**Warning signs:** Bodies visibly jumping on simulation start.

### Pitfall 4: Accessing Private Constraint Anchor Data
**What goes wrong:** Cannot draw constraint connections because `localAnchorA`, `localAnchorB` are private fields.
**Why it happens:** Constraints were designed for the solver, not for rendering. The Constraint interface has no anchor accessors.
**How to avoid:** Add public `getWorldAnchorA()` and `getWorldAnchorB()` methods to each constraint class, or add them to the Constraint interface. These compute world-space anchors from the current body state.
**Warning signs:** Build errors when trying to access constraint anchor data from the renderer.

### Pitfall 5: Manifold Data Not Accessible from World
**What goes wrong:** Cannot draw contact points and normals because manifolds are local variables in `World.singleStep()`.
**Why it happens:** Manifolds are computed fresh each step and passed directly to the solver. No reference is stored.
**How to avoid:** Store the latest manifolds array as a field on World (or CollisionSystem) and expose via a getter. This is a common pattern -- Matter.js stores `engine.pairs.list`, Planck.js exposes contacts via `world.getContactList()`.
**Warning signs:** No way to access contact data for debug rendering.

### Pitfall 6: Angle Interpolation Wrapping
**What goes wrong:** When a body rotates past 2*PI, lerp between prevAngle and angle can take the "long way around."
**Why it happens:** Linear interpolation doesn't account for angular wrapping.
**How to avoid:** For the demo scenes (Phase 6), this is unlikely to be an issue since bodies rarely spin fast enough. If needed, normalize the angle difference before lerping. However, the simple `lerp(prevAngle, angle, alpha)` is sufficient for v1 since angles are continuous (not wrapped to [0, 2*PI]) in this engine.
**Warning signs:** Bodies appearing to spin backwards briefly.

## Code Examples

### Drawing a Circle Body
```typescript
private drawCircle(
  ctx: CanvasRenderingContext2D,
  circle: Circle,
  x: number,
  y: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Apply shape offset
  const ox = circle.offset.x;
  const oy = circle.offset.y;

  ctx.beginPath();
  ctx.arc(ox, oy, circle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rotation indicator line (from center to edge)
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + circle.radius, oy);
  ctx.stroke();

  ctx.restore();
}
```

### Drawing a Polygon Body
```typescript
private drawPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: Polygon,
  x: number,
  y: number,
  angle: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const verts = polygon.vertices;
  const ox = polygon.offset.x;
  const oy = polygon.offset.y;

  ctx.beginPath();
  ctx.moveTo(verts[0].x + ox, verts[0].y + oy);
  for (let i = 1; i < verts.length; i++) {
    ctx.lineTo(verts[i].x + ox, verts[i].y + oy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}
```

### Drawing Debug AABBs
```typescript
private drawAABBs(ctx: CanvasRenderingContext2D, bodies: readonly Body[]): void {
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 1 / this.scale; // 1px regardless of zoom
  for (const body of bodies) {
    const aabb = body.shape.computeAABB(body.position, body.angle);
    ctx.strokeRect(
      aabb.min.x,
      aabb.min.y,
      aabb.width,
      aabb.height,
    );
  }
}
```

### Drawing Debug Contact Points and Normals
```typescript
private drawContacts(ctx: CanvasRenderingContext2D, manifolds: readonly Manifold[]): void {
  for (const m of manifolds) {
    for (const c of m.contacts) {
      // Contact point (red dot)
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(c.point.x, c.point.y, 3 / this.scale, 0, Math.PI * 2);
      ctx.fill();

      // Contact normal (blue line from contact point)
      const len = 0.5; // meters
      ctx.strokeStyle = '#0088ff';
      ctx.beginPath();
      ctx.moveTo(c.point.x, c.point.y);
      ctx.lineTo(c.point.x + m.normal.x * len, c.point.y + m.normal.y * len);
      ctx.stroke();
    }
  }
}
```

### Constraint World-Anchor Accessor Pattern
```typescript
// Add to each constraint class:
getWorldAnchorA(): { x: number; y: number } {
  const cos = Math.cos(this.bodyA.angle);
  const sin = Math.sin(this.bodyA.angle);
  return {
    x: this.bodyA.position.x + cos * this.localAnchorA.x - sin * this.localAnchorA.y,
    y: this.bodyA.position.y + sin * this.localAnchorA.x + cos * this.localAnchorA.y,
  };
}
```

## Codebase Integration Points

### Changes Required to Existing Code

These are the minimal changes needed in existing files to support rendering:

1. **Body.ts** -- Add `prevPosition: Vec2` and `prevAngle: number` fields (initialized from initial state in constructor)
2. **World.ts** -- Save previous state at top of `singleStep()`, store latest manifolds, expose via `getManifolds(): readonly Manifold[]`
3. **Constraint.ts** -- Add `getWorldAnchorA()` and `getWorldAnchorB()` to the interface (returns `{ x: number; y: number }`)
4. **DistanceConstraint.ts, SpringConstraint.ts, RevoluteConstraint.ts, MouseConstraint.ts** -- Implement the anchor accessor methods
5. **src/index.ts** -- Add `export * from './render/index.js'`

### Data Flow
```
requestAnimationFrame
  -> Renderer.loop(timestamp)
    -> world.step(frameDt)      // returns alpha
    -> world.getBodies()        // get body list
    -> world.getManifolds()     // get contacts (debug)
    -> world.getConstraints()   // get constraints (debug)
    -> for each body:
      -> lerp(prevPos, pos, alpha)  // interpolated render position
      -> dispatch on shape.type     // draw circle or polygon
    -> if debug:
      -> draw AABBs, contacts, normals, constraints
```

## Design Recommendations

### Visual Style
- **Fill + outline** for bodies: filled with a semi-transparent color, 1px outline for clarity. This matches Matter.js and Planck.js testbed conventions.
- **Palette cycling** for color assignment: cycle through 6-8 visually distinct colors based on body index. Deterministic and easy to debug.
- **Static bodies** rendered in a distinct gray with darker outline to visually separate from dynamic bodies.
- **Rotation indicators**: line from center to edge on circles only. Polygons show rotation via their shape already.

### Debug Overlay
- **Single `debug` boolean** for simplicity (toggle all debug layers at once). Per-layer toggles add API complexity without proportional value for v1.
- **Required four overlays**: AABBs (green), contact points (red dots), contact normals (blue lines), constraint connections (yellow lines between anchor points).
- **Extra debug info**: Body IDs as text labels (useful for debugging specific bodies). Velocity vectors are optional but easy to add.
- **Distinct colors per layer**: green=AABBs, red=contacts, blue=normals, yellow=constraints. Standard conventions from physics engine testbeds.

### Canvas Setup
- **Accept user's canvas element**: `new Renderer(canvas, world, options?)`. Don't create canvases -- the user controls DOM.
- **Y-up coordinate system**: flip Y via canvas transform. Expose `metersToPixels` scale factor (default 50px/m is reasonable for demo scenes).
- **Fixed scale, no pan/zoom**: keeps the renderer simple. If demos need it, a simple `camera` offset can be added, but pan/zoom interaction is Phase 6 demo territory.
- **Dark background**: `#1a1a2e` or similar dark color. Physics demos are easier to see on dark backgrounds. Clear each frame.

### Interpolation and Timing
- **Renderer owns rAF**: calls `world.step(frameDt)` each frame. Provides `start()`, `stop()` methods.
- **Bundled sim+render**: the renderer drives the simulation. This is the simplest pattern and matches the demo use case.
- **No separate pause/resume API**: just `stop()` the renderer. When started again, the accumulated time should be reset to prevent a large frameDt.
- **Previous state on Body fields**: `prevPosition: Vec2` and `prevAngle: number` stored directly on Body. Simpler than an external Map, zero lookup cost, and the Body class already has many public fields.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual rAF timestamp delta | `performance.now()` + rAF timestamp parameter | Widely adopted | More accurate timing, no Date.now() drift |
| Separate render/physics clocks | Fixed timestep + interpolation (Fiedler pattern) | Standard for 10+ years | Already implemented in World.step() |
| drawImage sprite sheets | Canvas 2D path drawing | N/A for physics debug | Simpler, no asset loading needed |

**Deprecated/outdated:**
- `Date.now()` for frame timing: replaced by `performance.now()` and rAF timestamp parameter
- `setInterval` render loops: replaced by `requestAnimationFrame` universally

## Open Questions

1. **Angle interpolation edge case**
   - What we know: Simple `lerp(prevAngle, angle, alpha)` works when angles are continuous (not wrapped)
   - What's unclear: Whether any body in the demo scenes will spin fast enough for this to matter
   - Recommendation: Use simple lerp for v1. The engine doesn't wrap angles, so they're continuous. Add angle-wrapping interpolation only if visual artifacts appear in demos.

2. **Canvas resize handling**
   - What we know: Canvas needs pixel dimensions set for crisp rendering
   - What's unclear: Whether demos will need responsive canvas sizing
   - Recommendation: Set canvas `width`/`height` from the element's `clientWidth`/`clientHeight` in the renderer constructor. Don't add resize observers for v1 -- demo scenes have fixed layouts.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/engine/World.ts`, `src/dynamics/Body.ts`, `src/shapes/*.ts`, `src/constraints/*.ts`, `src/collision/Manifold.ts`
- Canvas 2D API: MDN Web Docs (built-in browser API, stable for 15+ years)
- Glenn Fiedler "Fix Your Timestep!" -- the interpolation pattern already used by World.step()

### Secondary (MEDIUM confidence)
- Matter.js Render module pattern (fill+stroke body rendering, debug overlays, palette cycling)
- Planck.js testbed pattern (Y-flip coordinate transform, constraint debug rendering)
- Box2D b2DebugDraw interface (separate debug draw pass, per-shape dispatch)

### Tertiary (LOW confidence)
- None. All findings verified against codebase and established physics engine patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Canvas 2D is the only option given project constraints (no WebGL per REQUIREMENTS.md)
- Architecture: HIGH -- patterns directly derived from reading existing codebase + established physics engine renderers
- Pitfalls: HIGH -- all identified from concrete codebase analysis (private fields, missing accessors, Y-flip issues)

**Research date:** 2026-02-22
**Valid until:** indefinite (Canvas 2D API is stable, codebase architecture is fixed)
