import {
  Vec2,
  Body,
  BodyType,
  Circle,
  DistanceConstraint,
  type World,
} from '../../src/index.ts';

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
  worldSettings?: Record<string, unknown>;
}

export function cradleScene(): DemoScene {
  let pullDistance = 2.5;

  return {
    name: "Newton's Cradle",
    worldSettings: { velocityIterations: 16 },
    create(world: World) {
      const ballCount = 5;
      const ballRadius = 0.5;
      const pendulumLength = 5;
      const spacing = ballRadius * 2; // balls touching at rest

      const balls: Body[] = [];

      for (let i = 0; i < ballCount; i++) {
        const x = (i - 2) * spacing; // centered around x=0

        // Ball body
        const ball = new Body({
          shape: new Circle(ballRadius, { restitution: 1.0, friction: 0 }),
          position: new Vec2(x, ballRadius),
          type: BodyType.Dynamic,
        });
        ball.prevPosition.x = ball.position.x;
        ball.prevPosition.y = ball.position.y;
        ball.prevAngle = ball.angle;
        world.addBody(ball);
        balls.push(ball);

        // Static anchor (tiny circle above ball)
        const anchor = new Body({
          shape: new Circle(0.05),
          position: new Vec2(x, ballRadius + pendulumLength),
          type: BodyType.Static,
        });
        world.addBody(anchor);

        // Distance constraint connecting anchor to ball
        const constraint = new DistanceConstraint(
          anchor,
          ball,
          new Vec2(0, 0),
          new Vec2(0, 0),
        );
        world.addConstraint(constraint);
      }

      // Release first ball: pull it to the left and slightly up (pendulum arc)
      balls[0].position.x = balls[0].position.x - pullDistance;
      balls[0].position.y = balls[0].position.y + 0.6;
      balls[0].prevPosition.x = balls[0].position.x;
      balls[0].prevPosition.y = balls[0].position.y;
    },
    tweaks: [
      {
        label: 'Pull Distance',
        min: 1,
        max: 4,
        step: 0.5,
        value: 2.5,
        onChange(v: number) {
          pullDistance = v;
        },
      },
    ],
  };
}
