import { Vec2 } from '../math/Vec2.js';
import { Mat2 } from '../math/Mat2.js';
import { AABB } from '../math/AABB.js';
import {
  ShapeType,
  DEFAULT_DENSITY,
  DEFAULT_FRICTION,
  DEFAULT_RESTITUTION,
  type Material,
  type MassData,
  type Shape,
} from './Shape.js';

export interface CircleOptions {
  offset?: Vec2;
  density?: number;
  friction?: number;
  restitution?: number;
}

/**
 * Circle shape defined by a radius and local offset.
 *
 * Mass properties:
 *   area    = pi * r^2
 *   mass    = density * area
 *   inertia = 0.5 * mass * r^2   (about own center)
 *           += mass * |offset|^2  (parallel axis theorem)
 */
export class Circle implements Shape {
  readonly type = ShapeType.Circle;
  readonly radius: number;
  material: Material;
  offset: Vec2;

  constructor(radius: number, options?: CircleOptions) {
    if (radius <= 0) {
      throw new Error(`Circle radius must be positive, got ${radius}`);
    }
    this.radius = radius;
    this.offset = options?.offset?.clone() ?? Vec2.zero();
    this.material = {
      density: options?.density ?? DEFAULT_DENSITY,
      friction: options?.friction ?? DEFAULT_FRICTION,
      restitution: options?.restitution ?? DEFAULT_RESTITUTION,
    };
  }

  computeMassData(density: number): MassData {
    const r = this.radius;
    const area = Math.PI * r * r;
    const mass = density * area;
    // Moment of inertia about circle center: I = 0.5 * m * r^2
    let inertia = 0.5 * mass * r * r;
    // Parallel axis theorem for offset from body center
    inertia += mass * this.offset.lengthSquared();
    return {
      mass,
      inertia,
      centroid: this.offset.clone(),
    };
  }

  computeAABB(position: Vec2, angle: number): AABB {
    // World-space center = position + rotate(offset, angle)
    const rot = Mat2.fromAngle(angle);
    const worldCenter = rot.mulVec2(this.offset).add(position);
    const r = this.radius;
    return new AABB(
      new Vec2(worldCenter.x - r, worldCenter.y - r),
      new Vec2(worldCenter.x + r, worldCenter.y + r),
    );
  }
}
