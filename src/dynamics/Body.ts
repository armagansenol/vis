import { Vec2 } from '../math/Vec2.js';
import { Circle } from '../shapes/Circle.js';
import { Polygon } from '../shapes/Polygon.js';
import { BodyType } from './BodyType.js';

/**
 * Options for constructing a rigid body.
 */
export interface BodyOptions {
  /** Body type. Default: Dynamic. */
  type?: BodyType;
  /** Initial position in world space. Default: (0, 0). */
  position?: Vec2;
  /** Initial angle in radians. Default: 0. */
  angle?: number;
  /** Initial linear velocity. Default: (0, 0). */
  velocity?: Vec2;
  /** Initial angular velocity in radians/s. Default: 0. */
  angularVelocity?: number;
  /** Per-body gravity multiplier. Default: 1. */
  gravityScale?: number;
  /** The shape attached to this body. Required. */
  shape: Circle | Polygon;
}

/**
 * A rigid body in the physics simulation.
 *
 * Bodies own a shape from which mass and inertia are derived. They accumulate
 * forces and torques each frame, which are integrated using semi-implicit Euler
 * (see {@link integrate}).
 */
export class Body {
  type: BodyType;
  position: Vec2;
  angle: number;
  velocity: Vec2;
  angularVelocity: number;

  /** Force accumulator — zeroed after each integration step. */
  force: Vec2;
  /** Torque accumulator — zeroed after each integration step. */
  torque: number;

  mass: number;
  invMass: number;
  inertia: number;
  invInertia: number;

  /** Per-body gravity multiplier. 0 = no gravity, 1 = normal, 2 = double. */
  gravityScale: number;

  /** The shape attached to this body. */
  shape: Circle | Polygon;

  constructor(options: BodyOptions) {
    this.type = options.type ?? BodyType.Dynamic;
    this.position = options.position?.clone() ?? Vec2.zero();
    this.angle = options.angle ?? 0;
    this.velocity = options.velocity?.clone() ?? Vec2.zero();
    this.angularVelocity = options.angularVelocity ?? 0;
    this.gravityScale = options.gravityScale ?? 1;
    this.shape = options.shape;

    this.force = Vec2.zero();
    this.torque = 0;

    // Initialize mass properties
    this.mass = 0;
    this.invMass = 0;
    this.inertia = 0;
    this.invInertia = 0;

    this.computeMassFromShape();
  }

  // ---------------------------------------------------------------------------
  // Force / impulse application
  // ---------------------------------------------------------------------------

  /**
   * Apply a force (in Newtons) to this body.
   *
   * If a world-space point is provided, the force generates torque about the
   * body center. Without a point, the force is applied at the center of mass
   * (no torque).
   */
  applyForce(force: Vec2, worldPoint?: Vec2): void {
    this.force.x += force.x;
    this.force.y += force.y;

    if (worldPoint !== undefined) {
      const rx = worldPoint.x - this.position.x;
      const ry = worldPoint.y - this.position.y;
      this.torque += rx * force.y - ry * force.x;
    }
  }

  /**
   * Shorthand: apply force at center of mass (no torque).
   */
  applyForceAtCenter(force: Vec2): void {
    this.force.x += force.x;
    this.force.y += force.y;
  }

  /**
   * Apply an impulse (instant velocity change) to this body.
   *
   * If a world-space point is provided, angular velocity also changes.
   */
  applyImpulse(impulse: Vec2, worldPoint?: Vec2): void {
    this.velocity.x += impulse.x * this.invMass;
    this.velocity.y += impulse.y * this.invMass;

    if (worldPoint !== undefined) {
      const rx = worldPoint.x - this.position.x;
      const ry = worldPoint.y - this.position.y;
      this.angularVelocity +=
        (rx * impulse.y - ry * impulse.x) * this.invInertia;
    }
  }

  // ---------------------------------------------------------------------------
  // Body type switching
  // ---------------------------------------------------------------------------

  /**
   * Switch to Static type. Zeros out inverse mass, inverse inertia,
   * velocity, and angular velocity.
   */
  setStatic(): void {
    this.type = BodyType.Static;
    this.invMass = 0;
    this.invInertia = 0;
    this.mass = 0;
    this.inertia = 0;
    this.velocity.set(0, 0);
    this.angularVelocity = 0;
    this.force.set(0, 0);
    this.torque = 0;
  }

  /**
   * Switch to Dynamic type. Recomputes mass and inertia from the shape.
   */
  setDynamic(): void {
    this.type = BodyType.Dynamic;
    this.computeMassFromShape();
  }

  /**
   * Switch to Kinematic type. Zeros out inverse mass and inverse inertia
   * but keeps current velocity.
   */
  setKinematic(): void {
    this.type = BodyType.Kinematic;
    this.invMass = 0;
    this.invInertia = 0;
    this.mass = 0;
    this.inertia = 0;
    this.force.set(0, 0);
    this.torque = 0;
  }

  // ---------------------------------------------------------------------------
  // Integration
  // ---------------------------------------------------------------------------

  /**
   * Integrate body state using semi-implicit Euler.
   *
   * CRITICAL: velocity is updated BEFORE position. This is what makes it
   * semi-implicit (symplectic) Euler, which conserves energy much better
   * than explicit Euler.
   *
   * @param gravity World gravity acceleration (e.g. (0, -9.81)).
   * @param dt Time step in seconds.
   */
  integrate(gravity: Vec2, dt: number): void {
    // Static bodies do not move
    if (this.type === BodyType.Static) {
      return;
    }

    // Kinematic bodies: integrate position from velocity only, ignore forces/gravity
    if (this.type === BodyType.Kinematic) {
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      this.angle += this.angularVelocity * dt;
      return;
    }

    // Dynamic bodies: full integration
    // 1. Update velocity (semi-implicit: velocity BEFORE position)
    this.velocity.x += (this.force.x * this.invMass + gravity.x * this.gravityScale) * dt;
    this.velocity.y += (this.force.y * this.invMass + gravity.y * this.gravityScale) * dt;
    this.angularVelocity += this.torque * this.invInertia * dt;

    // 2. Update position using NEW velocity
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.angle += this.angularVelocity * dt;

    // 3. Clear force accumulators
    this.force.set(0, 0);
    this.torque = 0;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Derive mass and inertia from the attached shape.
   * For Dynamic bodies: compute from shape geometry.
   * For Static/Kinematic: set to zero (infinite mass).
   */
  private computeMassFromShape(): void {
    if (this.type === BodyType.Dynamic) {
      const massData = this.shape.computeMassData(this.shape.material.density);
      this.mass = massData.mass;
      this.invMass = massData.mass > 0 ? 1 / massData.mass : 0;
      this.inertia = massData.inertia;
      this.invInertia = massData.inertia > 0 ? 1 / massData.inertia : 0;
    } else {
      this.mass = 0;
      this.invMass = 0;
      this.inertia = 0;
      this.invInertia = 0;
    }
  }
}
