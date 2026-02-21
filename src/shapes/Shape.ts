import { Vec2 } from '../math/Vec2.js';
import { AABB } from '../math/AABB.js';

/**
 * Discriminant for shape type. Used in collision dispatch.
 */
export enum ShapeType {
  Circle = 0,
  Polygon = 1,
}

/**
 * Physical material properties attached to a shape.
 */
export interface Material {
  density: number;
  friction: number;
  restitution: number;
}

/** Default density (kg per unit area). */
export const DEFAULT_DENSITY = 1;
/** Default friction coefficient. */
export const DEFAULT_FRICTION = 0.3;
/** Default coefficient of restitution (bounciness). */
export const DEFAULT_RESTITUTION = 0.2;

/**
 * Mass properties derived from a shape's geometry and density.
 */
export interface MassData {
  mass: number;
  inertia: number;
  centroid: Vec2;
}

/**
 * Base interface for all shapes.
 *
 * A shape defines geometry in **local space** relative to the owning body's
 * center. The `offset` field allows the shape to be displaced from the body
 * center (supporting future compound bodies and the parallel-axis theorem).
 */
export interface Shape {
  /** Discriminant tag for type-safe dispatch. */
  readonly type: ShapeType;
  /** Physical material (density, friction, restitution). */
  material: Material;
  /** Local offset from the body center. */
  offset: Vec2;
  /** Compute mass, inertia, and centroid for a given density. */
  computeMassData(density: number): MassData;
  /** Compute the world-space AABB given a body position and angle. */
  computeAABB(position: Vec2, angle: number): AABB;
}
