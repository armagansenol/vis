import { Vec2, Body, BodyType, Circle, Polygon, type World } from '../../src/index.ts';

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

export function bouncingScene(): DemoScene {
  const timerIds: number[] = [];
  let disposed = false;
  let dropHeight = 8;

  return {
    name: 'Bouncing Balls',
    create(world: World) {
      disposed = false;
      dropHeight = 8;

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

      // Staggered ball drop
      const restitutions = [0.2, 0.4, 0.5, 0.7, 0.9];
      restitutions.forEach((r, i) => {
        const id = window.setTimeout(() => {
          if (disposed) return;
          const ball = new Body({
            shape: new Circle(0.4, { restitution: r, friction: 0.1 }),
            position: new Vec2(-3.2 + i * 1.6, dropHeight),
          });
          ball.prevPosition.x = ball.position.x;
          ball.prevPosition.y = ball.position.y;
          ball.prevAngle = ball.angle;
          world.addBody(ball);
        }, i * 600);
        timerIds.push(id);
      });
    },
    cleanup() {
      disposed = true;
      for (const id of timerIds) {
        window.clearTimeout(id);
      }
      timerIds.length = 0;
    },
    tweaks: [
      {
        label: 'Drop Height',
        min: 4,
        max: 12,
        step: 0.5,
        value: 8,
        onChange(v: number) {
          dropHeight = v;
        },
      },
    ],
  };
}
