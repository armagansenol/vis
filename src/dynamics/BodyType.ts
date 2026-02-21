/**
 * Rigid body type determines how physics simulation affects the body.
 *
 * - **Static**: invMass=0, invInertia=0, does not move. Used for ground, walls.
 * - **Kinematic**: invMass=0, invInertia=0, user sets velocity, integrates position.
 *   Not affected by forces or gravity. Used for moving platforms.
 * - **Dynamic**: Full physics simulation. Responds to forces, impulses, gravity, collisions.
 */
export enum BodyType {
  /** Infinite mass, does not move. */
  Static = 0,
  /** User-controlled velocity, integrates position only. */
  Kinematic = 1,
  /** Full physics simulation. */
  Dynamic = 2,
}
