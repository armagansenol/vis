# Phase 6: Demo Scenes - Research

**Researched:** 2026-02-22
**Domain:** Physics engine demo application (HTML/Canvas/TypeScript)
**Confidence:** HIGH

## Summary

Phase 6 builds four canonical demos that validate the full `vis` physics engine and serve as a polished showcase. No new engine features are needed -- all required APIs (World, Body, Renderer, DistanceConstraint, RevoluteConstraint, MouseConstraint, DebugRenderer) are implemented and tested in Phases 1-5. The work is purely application-level: composing engine primitives into scenes, building a tabbed demo page with dark-themed controls, and wiring up mouse interaction via the existing MouseConstraint.

The existing `examples/test-renderer.html` demonstrates the pattern: a single HTML file importing from `../src/index.ts` via Vite's dev server, creating bodies, and starting the Renderer loop. The demo page will follow the same approach but with a more polished UI, tab switching, control panels, and mouse drag support.

**Primary recommendation:** Build a single `examples/index.html` demo page with inline TypeScript modules. Each demo is a factory function that creates a World + scene bodies. Tab switching destroys the current scene and builds the next. Mouse interaction uses canvas event listeners that convert screen coordinates to world space, then create/update/remove a MouseConstraint.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single HTML page with tab/selector to switch between demos -- only one demo active at a time
- Fixed-size canvas (e.g., 800x600) centered on page with margins
- Minimal title + clean UI -- project name as header, clean tab bar
- Dark theme -- dark background, light text, bodies pop against dark canvas
- Stacking boxes: exactly 10 boxes stacked on static ground
- Bouncing balls: staggered drop -- balls drop one at a time with short delays to observe individual restitution differences
- Newton's cradle: 5 balls (classic configuration)
- Ragdoll: 2-3 ragdolls in the scene, showing constraint system under load
- Click directly on a body to grab it -- must click on the shape, no radius search
- Visual feedback: both a line from grab point to cursor AND body highlight during drag
- No cursor change when hovering over grabbable bodies
- Each demo has: Reset scene button, Debug toggle button, Pause/Play button
- Minimal per-demo tweakable parameters (e.g., gravity slider for stacking, restitution for bouncing balls)
- Controls positioned in a sidebar panel to the right of the canvas
- Controls styled to match the dark theme -- custom-styled buttons and sliders, polished look

### Claude's Discretion
- Exact canvas dimensions and scale (pixels per meter)
- Tab/selector UI implementation details
- Which specific parameters are tweakable per demo
- Whether static bodies can be dragged
- Ragdoll body segment layout and proportions
- Newton's cradle pendulum length and spacing
- Stacking box sizes and arrangement

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEMO-01 | Stacking boxes demo -- boxes stacked on a static ground, testing solver stability | 10 boxes on static ground, use Polygon.box() with varied sizes; World with gravity (0, -9.81); success = stable pile without jitter or collapse |
| DEMO-02 | Bouncing balls demo -- circles with varied restitution falling and bouncing | Circle shapes with restitution 0.2-0.9; staggered drop via setTimeout/accumulator delay; success = visibly different bounce heights |
| DEMO-03 | Newton's cradle demo -- pendulum balls using distance constraints | 5 Circle bodies suspended by DistanceConstraint pairs from static anchor points; release leftmost ball; success = momentum transfer through chain |
| DEMO-04 | Ragdoll demo -- linked body segments using revolute joints | Body segments (head, torso, limbs) connected by RevoluteConstraint with angle limits; 2-3 ragdolls; success = natural swinging under gravity |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vis (this project) | 0.0.1 | Physics engine | The entire point -- demos validate this engine |
| Vite | ^6.1.0 | Dev server + module resolution | Already configured; serves `examples/` HTML importing `../src/index.ts` directly |
| TypeScript | ^5.7.0 | Type-safe demo code | Already configured in project |

### Supporting
No additional libraries needed. Everything is vanilla HTML/CSS/Canvas + the `vis` engine. The demo page is a single HTML file with inline `<script type="module">` and `<style>` blocks.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single HTML page | Separate files per demo | Single page is simpler, matches user decision; no routing needed |
| Inline styles | CSS framework | Overkill for a demo page; inline keeps it self-contained |
| Custom sliders | dat.gui / lil-gui | External dependency for a demo page is unnecessary; custom sliders match dark theme better |

**Installation:**
No new packages needed. `npm run dev` (Vite) already serves HTML from the project root.

## Architecture Patterns

### Recommended Project Structure
```
examples/
  index.html          # Main demo page (single file, all demos)
```

Or, if splitting is preferred for maintainability:
```
examples/
  index.html          # Demo shell (layout, tabs, controls, mouse handling)
  demos/
    stacking.ts        # createStackingScene(world): void
    bouncing.ts        # createBouncingScene(world): void
    cradle.ts          # createCradleScene(world): void
    ragdoll.ts         # createRagdollScene(world): void
```

The split approach is recommended -- each demo factory function is independent and testable.

### Pattern 1: Scene Factory Functions
**What:** Each demo is a pure function that receives a World and populates it with bodies/constraints.
**When to use:** Always -- this is the core organizational pattern.
**Example:**
```typescript
function createStackingScene(world: World): void {
  // Static ground
  const ground = new Body({
    shape: Polygon.box(16, 0.5),
    type: BodyType.Static,
    position: new Vec2(0, 0.25),
  });
  world.addBody(ground);

  // 10 stacked boxes
  for (let i = 0; i < 10; i++) {
    const box = new Body({
      shape: Polygon.box(1, 1),
      position: new Vec2(0, 1 + i * 1.05),
    });
    world.addBody(box);
  }
}
```

### Pattern 2: Screen-to-World Coordinate Conversion
**What:** Convert mouse/pointer screen coordinates to physics world coordinates for MouseConstraint.
**When to use:** All mouse interaction.
**Example:**
```typescript
// The Renderer uses: ctx.setTransform(scale, 0, 0, -scale, offsetX, height - offsetY)
// So: screenX = worldX * scale + offsetX
//     screenY = (height - offsetY) - worldY * scale
// Inverse:
function screenToWorld(screenX: number, screenY: number): Vec2 {
  const worldX = (screenX - offsetX) / scale;
  const worldY = (canvasHeight - offsetY - screenY) / scale;
  return new Vec2(worldX, worldY);
}
```

### Pattern 3: Point-in-Shape Hit Testing
**What:** Determine which body (if any) the user clicked on. Must click ON the shape, not just near it.
**When to use:** Mouse grab interaction.
**Example:**
```typescript
function bodyAtPoint(world: World, point: Vec2): Body | null {
  for (const body of world.getBodies()) {
    if (body.type === BodyType.Static) continue; // or include, per discretion
    const shape = body.shape;
    if (shape.type === ShapeType.Circle) {
      const circle = shape as Circle;
      // Transform point to local body space
      const cos = Math.cos(-body.angle);
      const sin = Math.sin(-body.angle);
      const dx = point.x - body.position.x;
      const dy = point.y - body.position.y;
      const localX = cos * dx - sin * dy;
      const localY = sin * dx + cos * dy;
      const cx = localX - circle.offset.x;
      const cy = localY - circle.offset.y;
      if (cx * cx + cy * cy <= circle.radius * circle.radius) return body;
    } else {
      // Polygon: point-in-convex-polygon test using cross products
      // Transform point to local, check all edge normals
    }
  }
  return null;
}
```

### Pattern 4: MouseConstraint Lifecycle
**What:** Create on mousedown, update target on mousemove, remove on mouseup.
**When to use:** Interactive drag.
**Example:**
```typescript
let activeConstraint: MouseConstraint | null = null;

canvas.addEventListener('pointerdown', (e) => {
  const worldPoint = screenToWorld(e.offsetX, e.offsetY);
  const body = bodyAtPoint(world, worldPoint);
  if (!body) return;

  // Compute local anchor (world point in body's local space)
  const cos = Math.cos(-body.angle);
  const sin = Math.sin(-body.angle);
  const dx = worldPoint.x - body.position.x;
  const dy = worldPoint.y - body.position.y;
  const localAnchor = { x: cos * dx - sin * dy, y: sin * dx + cos * dy };

  activeConstraint = new MouseConstraint(body, localAnchor, worldPoint);
  world.addConstraint(activeConstraint);
});

canvas.addEventListener('pointermove', (e) => {
  if (!activeConstraint) return;
  activeConstraint.setTarget(screenToWorld(e.offsetX, e.offsetY));
});

canvas.addEventListener('pointerup', () => {
  if (activeConstraint) {
    world.removeConstraint(activeConstraint);
    activeConstraint = null;
  }
});
```

### Pattern 5: Staggered Ball Drop (Bouncing Demo)
**What:** Drop balls one at a time with delays to observe individual bouncing.
**When to use:** DEMO-02 bouncing balls.
**Example:**
```typescript
const restitutions = [0.2, 0.4, 0.5, 0.7, 0.9];
const spacing = 2; // meters apart horizontally

function createBouncingScene(world: World): void {
  // Ground
  world.addBody(new Body({
    shape: Polygon.box(16, 0.5),
    type: BodyType.Static,
    position: new Vec2(0, 0.25),
  }));

  // Staggered drop: add balls with delay
  restitutions.forEach((r, i) => {
    setTimeout(() => {
      const ball = new Body({
        shape: new Circle(0.4, { restitution: r }),
        position: new Vec2(-4 + i * spacing, 8),
      });
      world.addBody(ball);
    }, i * 500); // 500ms between each drop
  });
}
```

### Pattern 6: Newton's Cradle Construction
**What:** 5 balls suspended by distance constraints from fixed anchor points.
**When to use:** DEMO-03.
**Example:**
```typescript
function createCradleScene(world: World): void {
  const numBalls = 5;
  const ballRadius = 0.5;
  const pendulumLength = 4;
  const spacing = ballRadius * 2; // touching when at rest

  // Static anchor body (ceiling)
  const anchor = new Body({
    shape: Polygon.box(0.1, 0.1),
    type: BodyType.Static,
    position: new Vec2(0, pendulumLength + ballRadius),
  });
  world.addBody(anchor);

  for (let i = 0; i < numBalls; i++) {
    const x = (i - (numBalls - 1) / 2) * spacing;
    const ball = new Body({
      shape: new Circle(ballRadius, { restitution: 1.0, friction: 0 }),
      position: new Vec2(x, ballRadius), // hanging at rest
    });
    world.addBody(ball);

    // Distance constraint from anchor point above to ball center
    const anchorPoint = new Vec2(x, pendulumLength + ballRadius);
    // Use a second static anchor per ball for clean constraint setup
    const topAnchor = new Body({
      shape: new Circle(0.05),
      type: BodyType.Static,
      position: anchorPoint,
    });
    world.addBody(topAnchor);

    const dc = new DistanceConstraint(
      topAnchor, ball,
      new Vec2(0, 0), new Vec2(0, 0),
      { length: pendulumLength }
    );
    world.addConstraint(dc);
  }

  // Pull first ball to the side for release
  const firstBall = world.getBodies()[2]; // skip anchor bodies
  firstBall.position.set(firstBall.position.x - 2, firstBall.position.y + 1);
}
```

### Pattern 7: Ragdoll Construction
**What:** Body segments connected by revolute joints with angle limits.
**When to use:** DEMO-04.
**Example:**
```typescript
function createRagdoll(world: World, x: number, y: number): void {
  // Torso
  const torso = new Body({
    shape: Polygon.box(0.6, 1.2),
    position: new Vec2(x, y),
  });
  world.addBody(torso);

  // Head
  const head = new Body({
    shape: new Circle(0.3),
    position: new Vec2(x, y + 0.9),
  });
  world.addBody(head);

  // Neck joint
  const neck = new RevoluteConstraint(torso, head, { x, y: y + 0.6 }, {
    enableLimit: true,
    lowerAngle: -Math.PI / 6,
    upperAngle: Math.PI / 6,
  });
  world.addConstraint(neck);

  // Upper arms, lower arms, upper legs, lower legs...
  // Each segment: Body + RevoluteConstraint with appropriate angle limits
}
```

### Anti-Patterns to Avoid
- **Creating bodies before World exists:** Always create World first, then add bodies. Body IDs auto-increment globally.
- **Forgetting to call Body.resetIdCounter():** When switching demos, call `Body.resetIdCounter()` to keep IDs small and palette cycling predictable.
- **Modifying body.position after construction without updating prevPosition:** For initial positioning (like pulling cradle ball), set both `position` and `prevPosition` to avoid interpolation teleportation.
- **Using setTimeout in paused state:** If the simulation is paused and you use setTimeout for staggered drops, balls will accumulate. Guard against this by checking pause state or using scene-level time tracking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mouse drag physics | Custom force application | MouseConstraint | Already implements Catto's soft constraint formulation with proper damping |
| Render loop | Manual rAF + step timing | Renderer.start() / .stop() | Handles frame timing, interpolation alpha, spiral-of-death clamping |
| Debug visualization | Custom shape outlines | DebugRenderer (via Renderer.setDebug()) | Already draws AABBs, contacts, normals, constraints |
| Coordinate transform | Manual matrix math | Match Renderer's setTransform parameters | The Renderer's Y-up transform is already defined; just use the inverse for mouse |

**Key insight:** The entire engine is already built. This phase is pure composition -- every physics and rendering primitive exists. The challenge is scene design and UI polish, not engine work.

## Common Pitfalls

### Pitfall 1: Incorrect Screen-to-World Transform
**What goes wrong:** Mouse clicks map to wrong physics positions; dragging feels offset.
**Why it happens:** The Renderer uses a Y-up transform: `setTransform(scale, 0, 0, -scale, offsetX, height - offsetY)`. Forgetting the Y-flip or offset produces wrong coordinates.
**How to avoid:** Derive the inverse transform directly from the Renderer's parameters. Test by clicking a body at a known position and verifying the world coordinate matches.
**Warning signs:** Body snaps to wrong position on grab; drag direction feels inverted vertically.

### Pitfall 2: Newton's Cradle Energy Loss
**What goes wrong:** The last ball doesn't swing out fully; cradle winds down in seconds.
**Why it happens:** Default restitution is 0.2 and default friction is 0.3. Solver iterations may also be too low for the constraint chain.
**How to avoid:** Set ball restitution to 1.0 (perfectly elastic), friction to 0. Increase velocity iterations (12-16) for the cradle scene. Accept some energy loss as physically realistic -- perfect Newton's cradle behavior requires special-case handling beyond basic sequential impulses.
**Warning signs:** Balls barely move after first collision; gradual height reduction over swings.

### Pitfall 3: Stacking Instability
**What goes wrong:** Boxes jitter, slide sideways, or collapse after initial stacking.
**Why it happens:** Insufficient solver iterations, high restitution causing micro-bounces, or boxes perfectly aligned (zero friction scenario).
**How to avoid:** Use enough solver iterations (8-12), low restitution (0.0-0.2), reasonable friction (0.3-0.5). Slightly vary box sizes or add tiny position offsets to avoid perfect symmetry.
**Warning signs:** Top boxes shimmer or drift; stack collapses after appearing stable.

### Pitfall 4: Ragdoll Explosion on Spawn
**What goes wrong:** Ragdoll body parts fly apart on first frame.
**Why it happens:** Bodies overlap at spawn, generating huge penetration impulses. Joint anchors don't match body positions.
**How to avoid:** Position body segments so they just touch at joint points. Verify that RevoluteConstraint worldAnchor matches the shared edge between segments. Start with gravity disabled temporarily if needed for debugging.
**Warning signs:** Bodies explode outward on first frame; joints stretch to extreme lengths.

### Pitfall 5: Staggered Drop Timer Persists After Scene Reset
**What goes wrong:** Resetting the bouncing balls demo causes extra balls to appear from the previous scene's timers.
**Why it happens:** setTimeout callbacks fire even after the scene is reset.
**How to avoid:** Track timer IDs and clear them on scene teardown. Or use a scene-level frame counter instead of setTimeout.
**Warning signs:** Extra balls appear after reset; ball count exceeds expected number.

### Pitfall 6: Mouse Constraint Not Removed on Scene Switch
**What goes wrong:** Switching tabs while dragging leaves an orphaned MouseConstraint in the old World.
**Why it happens:** Tab switch creates a new World but the pointerup handler references the old constraint.
**How to avoid:** On scene teardown, force-remove any active MouseConstraint and null the reference. Stop the Renderer before creating the new scene.
**Warning signs:** Console errors referencing destroyed bodies; ghost drag behavior.

## Code Examples

### Complete Screen-to-World Transform
```typescript
// Match Renderer's constructor parameters
const canvasWidth = 800;
const canvasHeight = 600;
const scale = 50; // pixels per meter
const offsetX = canvasWidth / 2; // origin at center horizontally
const offsetY = 50; // origin 50px from bottom

function screenToWorld(sx: number, sy: number): Vec2 {
  const wx = (sx - offsetX) / scale;
  const wy = (canvasHeight - offsetY - sy) / scale;
  return new Vec2(wx, wy);
}
```

### Point-in-Circle Test (Body Local Space)
```typescript
function pointInCircleBody(body: Body, worldPoint: Vec2): boolean {
  const circle = body.shape as Circle;
  const cos = Math.cos(-body.angle);
  const sin = Math.sin(-body.angle);
  const dx = worldPoint.x - body.position.x;
  const dy = worldPoint.y - body.position.y;
  const localX = cos * dx - sin * dy - circle.offset.x;
  const localY = sin * dx + cos * dy - circle.offset.y;
  return localX * localX + localY * localY <= circle.radius * circle.radius;
}
```

### Point-in-Convex-Polygon Test (Body Local Space)
```typescript
function pointInPolygonBody(body: Body, worldPoint: Vec2): boolean {
  const poly = body.shape as Polygon;
  const cos = Math.cos(-body.angle);
  const sin = Math.sin(-body.angle);
  const dx = worldPoint.x - body.position.x;
  const dy = worldPoint.y - body.position.y;
  const localX = cos * dx - sin * dy - poly.offset.x;
  const localY = sin * dx + cos * dy - poly.offset.y;

  const verts = poly.vertices;
  for (let i = 0; i < verts.length; i++) {
    const next = (i + 1) % verts.length;
    const ex = verts[next].x - verts[i].x;
    const ey = verts[next].y - verts[i].y;
    const px = localX - verts[i].x;
    const py = localY - verts[i].y;
    // Cross product: if negative, point is outside this edge
    if (ex * py - ey * px < 0) return false;
  }
  return true;
}
```

### Drag Visual Feedback (Line + Highlight)
```typescript
// In the render loop, after Renderer.draw():
function drawDragFeedback(
  ctx: CanvasRenderingContext2D,
  constraint: MouseConstraint | null,
  grabbedBody: Body | null,
  scale: number,
): void {
  if (!constraint || !grabbedBody) return;

  const anchorWorld = constraint.getWorldAnchorA();
  const target = constraint.getWorldAnchorB();

  // Line from grab point to cursor
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.5 / scale;
  ctx.beginPath();
  ctx.moveTo(anchorWorld.x, anchorWorld.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();

  // Body highlight glow
  ctx.strokeStyle = 'rgba(255, 255, 100, 0.8)';
  ctx.lineWidth = 2 / scale;
  // Re-draw body outline with highlight color...
}
```

### Scene Lifecycle Manager
```typescript
interface DemoScene {
  name: string;
  create: (world: World) => void;
  tweaks?: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }[];
}

let currentWorld: World;
let renderer: Renderer;
let mouseConstraint: MouseConstraint | null = null;
let timers: number[] = [];

function switchScene(scene: DemoScene): void {
  // 1. Teardown
  if (mouseConstraint) {
    currentWorld.removeConstraint(mouseConstraint);
    mouseConstraint = null;
  }
  renderer.stop();
  timers.forEach(clearTimeout);
  timers = [];
  Body.resetIdCounter();

  // 2. Setup
  currentWorld = new World({ gravity: new Vec2(0, -9.81) });
  scene.create(currentWorld);
  renderer = new Renderer(canvas, currentWorld, renderOptions);
  renderer.start();

  // 3. Build controls
  buildControlPanel(scene);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate HTML per demo | Single-page tabbed app | Current phase decision | Simpler deployment, single URL |
| dat.gui for controls | Custom dark-themed controls | Current phase decision | No external dependency, matches theme |

**Deprecated/outdated:**
- None. The engine APIs are stable from Phases 1-5.

## Open Questions

1. **Renderer.draw() access for custom overlays**
   - What we know: Renderer.draw(alpha) is public, but the rAF loop calls it internally. Custom drag feedback (line + highlight) needs to be drawn AFTER the standard draw call.
   - What's unclear: Whether to extend Renderer with a callback hook, or have the demo page manage its own rAF loop and call draw() manually.
   - Recommendation: Have the demo page run its own rAF loop, calling `world.step(dt)` and `renderer.draw(alpha)` manually instead of using `renderer.start()`. This gives full control over drawing order (bodies, then debug, then drag feedback). The Renderer.draw() method is already public for this purpose.

2. **Newton's cradle accuracy**
   - What we know: Sequential impulse solvers with finite iterations don't perfectly simulate Newton's cradle. The momentum transfer through a chain of resting contacts requires many iterations.
   - What's unclear: How many iterations are needed for visually acceptable behavior with 5 balls.
   - Recommendation: Use 16+ velocity iterations for the cradle scene specifically. Accept that behavior will be approximately correct rather than textbook-perfect. This is a known limitation of iterative PGS solvers.

3. **Pause/Play with accumulator state**
   - What we know: World uses an accumulator pattern. Pausing means not calling world.step().
   - What's unclear: Whether accumulated time should be reset on unpause to avoid a time spike.
   - Recommendation: On unpause, reset the `lastTime` tracker in the render loop to `performance.now()` so the first frame after unpause has a near-zero dt. The Renderer already handles this (lastTime = 0 causes a skip frame).

## Sources

### Primary (HIGH confidence)
- Project source code: `src/engine/World.ts`, `src/render/Renderer.ts`, `src/constraints/MouseConstraint.ts`, `src/constraints/DistanceConstraint.ts`, `src/constraints/RevoluteConstraint.ts`, `src/dynamics/Body.ts`, `src/shapes/Circle.ts`, `src/shapes/Polygon.ts`, `src/render/RenderOptions.ts`, `src/render/DebugRenderer.ts`
- Existing example: `examples/test-renderer.html` -- working pattern for HTML + Vite dev import
- Project config: `package.json`, `vite.config.ts`, `tsconfig.json`

### Secondary (MEDIUM confidence)
- Newton's cradle iterative solver limitations: well-documented in physics engine literature (Catto GDC talks, Box2D documentation)
- Ragdoll joint angle limit ranges: common knowledge from game physics implementations

### Tertiary (LOW confidence)
- None. All findings are based on direct source code inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, entire engine is inspected
- Architecture: HIGH -- patterns derived directly from existing code and API surface
- Pitfalls: HIGH -- pitfalls identified from engine internals (coordinate transforms, solver behavior, timer management)

**Research date:** 2026-02-22
**Valid until:** Indefinite (no external dependencies to go stale)
