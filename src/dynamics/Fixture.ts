import { Vec2 } from '../math/Vec2.js';
import { type AABB } from '../math/AABB.js';
import { type Shape, type Material } from '../shapes/Shape.js';
import { type Body } from './Body.js';

/**
 * Options for constructing a fixture.
 */
export interface FixtureOptions {
  /** The shape geometry for this fixture. Required. */
  shape: Shape;
  /** If true, this fixture detects overlaps but does not resolve collisions. Default: false. */
  isSensor?: boolean;
  /** Collision category bitmask. Default: 0x0001. */
  categoryBits?: number;
  /** Collision mask — which categories this fixture collides with. Default: 0xFFFF. */
  maskBits?: number;
  /** Override material density. Default: uses shape's material density. */
  density?: number;
  /** Override material friction. Default: uses shape's material friction. */
  friction?: number;
  /** Override material restitution. Default: uses shape's material restitution. */
  restitution?: number;
}

/**
 * A fixture attaches a shape to a body with per-shape collision filtering
 * and material overrides.
 *
 * This is groundwork for compound bodies (multiple shapes per body). Currently
 * each Body has a single shape, but the fixture abstraction enables:
 *
 * 1. Per-shape material properties (different friction/restitution per shape)
 * 2. Per-shape collision filters (sensors + physics on the same body)
 * 3. Mass aggregation from multiple shapes
 * 4. Broadphase entries per fixture rather than per body
 *
 * Future: Body will own a Fixture[] instead of a single Shape. The collision
 * system will iterate fixtures rather than bodies for narrowphase.
 */
export class Fixture {
  private static nextId = 0;

  /** Unique auto-incrementing ID for this fixture. */
  readonly id: number;
  /** The body this fixture is attached to. */
  body: Body | null = null;
  /** The shape geometry. */
  readonly shape: Shape;
  /** Whether this is a sensor (overlap detection only). */
  isSensor: boolean;
  /** Collision category bitmask. */
  categoryBits: number;
  /** Collision mask bitmask. */
  maskBits: number;
  /** Material properties (may override shape defaults). */
  readonly material: Material;

  constructor(options: FixtureOptions) {
    this.id = Fixture.nextId++;
    this.shape = options.shape;
    this.isSensor = options.isSensor ?? false;
    this.categoryBits = options.categoryBits ?? 0x0001;
    this.maskBits = options.maskBits ?? 0xFFFF;
    this.material = {
      density: options.density ?? options.shape.material.density,
      friction: options.friction ?? options.shape.material.friction,
      restitution: options.restitution ?? options.shape.material.restitution,
    };
  }

  /** Compute the world-space AABB for this fixture given the body's transform. */
  computeAABB(position: Vec2, angle: number): AABB {
    return this.shape.computeAABB(position, angle);
  }

  /** Compute mass data for this fixture at its material density. */
  computeMassData(): { mass: number; inertia: number; centroid: Vec2 } {
    return this.shape.computeMassData(this.material.density);
  }

  /** Reset the auto-incrementing ID counter. Use in tests for deterministic IDs. */
  static resetIdCounter(): void {
    Fixture.nextId = 0;
  }
}
