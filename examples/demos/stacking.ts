import { Vec2, Body, BodyType, Polygon, type World } from '../../src/index.ts';

interface TweakDef {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}

interface DemoScene {
  name: string;
  create: (world: World) => void;
  cleanup?: () => void;
  tweaks: TweakDef[];
}

export function stackingScene(): DemoScene & { worldSettings?: Record<string, unknown> } {
  let currentWorld: World | null = null;

  return {
    name: 'Stacking Boxes',
    worldSettings: { velocityIterations: 16, positionIterations: 8 },
    create(world: World) {
      currentWorld = world;

      // Static ground
      const ground = new Body({
        shape: Polygon.box(16, 0.5),
        type: BodyType.Static,
        position: new Vec2(0, -0.25),
      });
      world.addBody(ground);

      // Static left wall
      const leftWall = new Body({
        shape: Polygon.box(0.5, 12),
        type: BodyType.Static,
        position: new Vec2(-8, 5.75),
      });
      world.addBody(leftWall);

      // Static right wall
      const rightWall = new Body({
        shape: Polygon.box(0.5, 12),
        type: BodyType.Static,
        position: new Vec2(8, 5.75),
      });
      world.addBody(rightWall);

      // 10 stacked boxes — placed in near-contact for stable settling
      for (let i = 0; i < 10; i++) {
        const xOffset = (Math.random() - 0.5) * 0.02;
        const box = new Body({
          shape: Polygon.box(0.9, 0.9, { friction: 0.6, restitution: 0.0 }),
          position: new Vec2(xOffset, 0.45 + 0.91 * i),
        });
        box.prevPosition.x = box.position.x;
        box.prevPosition.y = box.position.y;
        box.prevAngle = box.angle;
        world.addBody(box);
      }
    },
    tweaks: [
      {
        label: 'Gravity',
        min: 0,
        max: 30,
        step: 0.5,
        value: 9.81,
        onChange(v: number) {
          if (currentWorld) {
            currentWorld.gravity.y = -v;
          }
        },
      },
    ],
  };
}
