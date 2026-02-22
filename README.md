# vis

A 2D rigid-body physics engine written in TypeScript. Zero dependencies.

## Features

- Circle and convex polygon shapes
- Spatial hash broadphase + SAT narrowphase collision detection
- Iterative impulse-based contact solver with warm starting
- Distance, spring, revolute, and mouse constraints
- Static, dynamic, and kinematic body types
- Collision filtering (categories & masks)
- Canvas renderer with debug overlays
- Deterministic fixed-timestep simulation

## Install

```bash
npm install vis
```

## Quick start

```ts
import { World, Body, Circle, Polygon, Vec2, DebugRenderer } from 'vis'

const world = new World({ gravity: new Vec2(0, 9.81) })

// Static ground
const ground = new Body({ type: 'static', position: new Vec2(0, 5) })
ground.addShape(Polygon.createBox(20, 0.5))
world.addBody(ground)

// Dynamic ball
const ball = new Body({ position: new Vec2(0, -2) })
ball.addShape(new Circle(0.5))
world.addBody(ball)

// Render loop
const canvas = document.querySelector('canvas')!
const renderer = new DebugRenderer(canvas)

function loop() {
  world.step(1 / 60)
  renderer.render(world)
  requestAnimationFrame(loop)
}
loop()
```

## Modules

| Module | Description |
|--------|-------------|
| `vis` | Full re-export of everything below |
| `vis/math` | Vec2, Mat2, AABB, utilities |
| `vis/shapes` | Circle, Polygon, Shape base class |
| `vis/dynamics` | Body, BodyType |

## Development

```bash
bun install
bun run dev       # Vite dev server with demos
bun run build     # TypeScript + Vite library build
bun run test      # Vitest
```

## License

MIT
