import {
  Vec2,
  Body,
  BodyType,
  Circle,
  Polygon,
  RevoluteConstraint,
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
}

function createRagdoll(world: World, x: number, y: number): void {
  const mat = { density: 1, friction: 0.3, restitution: 0.05 };

  // --- Torso ---
  const torso = new Body({
    shape: Polygon.box(0.5, 1.0, { ...mat }),
    position: new Vec2(x, y),
    type: BodyType.Dynamic,
  });
  world.addBody(torso);

  // --- Head ---
  const head = new Body({
    shape: new Circle(0.22, { ...mat }),
    position: new Vec2(x, y + 0.72),
    type: BodyType.Dynamic,
  });
  world.addBody(head);

  // --- Upper arms ---
  const leftUpperArm = new Body({
    shape: Polygon.box(0.5, 0.18, { ...mat }),
    position: new Vec2(x - 0.75, y + 0.35),
    type: BodyType.Dynamic,
  });
  world.addBody(leftUpperArm);

  const rightUpperArm = new Body({
    shape: Polygon.box(0.5, 0.18, { ...mat }),
    position: new Vec2(x + 0.75, y + 0.35),
    type: BodyType.Dynamic,
  });
  world.addBody(rightUpperArm);

  // --- Lower arms ---
  const leftLowerArm = new Body({
    shape: Polygon.box(0.45, 0.15, { ...mat }),
    position: new Vec2(x - 1.35, y + 0.35),
    type: BodyType.Dynamic,
  });
  world.addBody(leftLowerArm);

  const rightLowerArm = new Body({
    shape: Polygon.box(0.45, 0.15, { ...mat }),
    position: new Vec2(x + 1.35, y + 0.35),
    type: BodyType.Dynamic,
  });
  world.addBody(rightLowerArm);

  // --- Upper legs ---
  const leftUpperLeg = new Body({
    shape: Polygon.box(0.18, 0.5, { ...mat }),
    position: new Vec2(x - 0.15, y - 0.75),
    type: BodyType.Dynamic,
  });
  world.addBody(leftUpperLeg);

  const rightUpperLeg = new Body({
    shape: Polygon.box(0.18, 0.5, { ...mat }),
    position: new Vec2(x + 0.15, y - 0.75),
    type: BodyType.Dynamic,
  });
  world.addBody(rightUpperLeg);

  // --- Lower legs ---
  const leftLowerLeg = new Body({
    shape: Polygon.box(0.15, 0.45, { ...mat }),
    position: new Vec2(x - 0.15, y - 1.35),
    type: BodyType.Dynamic,
  });
  world.addBody(leftLowerLeg);

  const rightLowerLeg = new Body({
    shape: Polygon.box(0.15, 0.45, { ...mat }),
    position: new Vec2(x + 0.15, y - 1.35),
    type: BodyType.Dynamic,
  });
  world.addBody(rightLowerLeg);

  // Set prevPosition/prevAngle for all parts to avoid interpolation jump
  const allParts = [
    torso, head,
    leftUpperArm, rightUpperArm, leftLowerArm, rightLowerArm,
    leftUpperLeg, rightUpperLeg, leftLowerLeg, rightLowerLeg,
  ];
  for (const part of allParts) {
    part.prevPosition.x = part.position.x;
    part.prevPosition.y = part.position.y;
    part.prevAngle = part.angle;
  }

  // --- Joints (RevoluteConstraint with angle limits) ---

  // Neck: torso <-> head
  world.addConstraint(new RevoluteConstraint(torso, head,
    { x, y: y + 0.5 },
    { enableLimit: true, lowerAngle: -Math.PI / 6, upperAngle: Math.PI / 6 },
  ));

  // Left shoulder: torso <-> leftUpperArm
  world.addConstraint(new RevoluteConstraint(torso, leftUpperArm,
    { x: x - 0.25, y: y + 0.35 },
    { enableLimit: true, lowerAngle: -Math.PI / 2, upperAngle: Math.PI / 3 },
  ));

  // Right shoulder: torso <-> rightUpperArm
  world.addConstraint(new RevoluteConstraint(torso, rightUpperArm,
    { x: x + 0.25, y: y + 0.35 },
    { enableLimit: true, lowerAngle: -Math.PI / 3, upperAngle: Math.PI / 2 },
  ));

  // Left elbow: leftUpperArm <-> leftLowerArm
  world.addConstraint(new RevoluteConstraint(leftUpperArm, leftLowerArm,
    { x: x - 1.0, y: y + 0.35 },
    { enableLimit: true, lowerAngle: 0, upperAngle: Math.PI * 0.75 },
  ));

  // Right elbow: rightUpperArm <-> rightLowerArm
  world.addConstraint(new RevoluteConstraint(rightUpperArm, rightLowerArm,
    { x: x + 1.0, y: y + 0.35 },
    { enableLimit: true, lowerAngle: -Math.PI * 0.75, upperAngle: 0 },
  ));

  // Left hip: torso <-> leftUpperLeg
  world.addConstraint(new RevoluteConstraint(torso, leftUpperLeg,
    { x: x - 0.15, y: y - 0.5 },
    { enableLimit: true, lowerAngle: -Math.PI / 6, upperAngle: Math.PI / 3 },
  ));

  // Right hip: torso <-> rightUpperLeg
  world.addConstraint(new RevoluteConstraint(torso, rightUpperLeg,
    { x: x + 0.15, y: y - 0.5 },
    { enableLimit: true, lowerAngle: -Math.PI / 3, upperAngle: Math.PI / 6 },
  ));

  // Left knee: leftUpperLeg <-> leftLowerLeg
  world.addConstraint(new RevoluteConstraint(leftUpperLeg, leftLowerLeg,
    { x: x - 0.15, y: y - 1.0 },
    { enableLimit: true, lowerAngle: -Math.PI * 0.6, upperAngle: 0 },
  ));

  // Right knee: rightUpperLeg <-> rightLowerLeg
  world.addConstraint(new RevoluteConstraint(rightUpperLeg, rightLowerLeg,
    { x: x + 0.15, y: y - 1.0 },
    { enableLimit: true, lowerAngle: 0, upperAngle: Math.PI * 0.6 },
  ));
}

export function ragdollScene(): DemoScene {
  let currentWorld: World | null = null;

  return {
    name: 'Ragdoll',
    create(world: World) {
      currentWorld = world;

      // Static ground
      const ground = new Body({
        shape: Polygon.box(16, 0.5),
        type: BodyType.Static,
        position: new Vec2(0, -0.25),
      });
      world.addBody(ground);

      // Create 3 ragdolls at different positions and heights
      createRagdoll(world, -2, 6);
      createRagdoll(world, 2, 7);
      createRagdoll(world, 0, 9);
    },
    tweaks: [
      {
        label: 'Gravity',
        min: 0,
        max: 20,
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
