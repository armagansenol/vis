import { Vec2 } from '../math/Vec2.js';
import { Body } from '../dynamics/Body.js';
import { type Shape } from '../shapes/Shape.js';

/**
 * A single contact point in a collision manifold.
 */
export interface ContactPoint {
  /** World-space contact position. */
  point: Vec2;
  /** Penetration depth (positive = overlapping). */
  depth: number;
  /**
   * Feature ID for warm-starting persistence.
   * Encodes edge/vertex indices so the solver can reuse cached impulses
   * across frames when the same geometric features are in contact.
   */
  id: number;
}

/**
 * Collision manifold describing the contact between two bodies.
 *
 * Normal convention: ALWAYS points from bodyA toward bodyB.
 */
export interface Manifold {
  bodyA: Body;
  bodyB: Body;
  /** Collision normal — always points from bodyA toward bodyB. */
  normal: Vec2;
  /** 1-2 contact points. */
  contacts: ContactPoint[];
  /** Combined friction (geometric mean of shape frictions). */
  friction: number;
  /** Combined restitution (max of shape restitutions). */
  restitution: number;
  /** True if either body is a sensor. */
  isSensor: boolean;
}

/**
 * Mix material properties from two shapes.
 *
 * Friction: geometric mean (sqrt(a * b)) — balances ice-on-rubber scenarios.
 * Restitution: max — the bouncier surface dominates.
 */
export function mixMaterials(
  a: Shape,
  b: Shape,
): { friction: number; restitution: number } {
  return {
    friction: Math.sqrt(a.material.friction * b.material.friction),
    restitution: Math.max(a.material.restitution, b.material.restitution),
  };
}

/**
 * Create a canonical pair key from two body IDs.
 * Always returns `${min}:${max}` for consistent deduplication.
 */
export function pairKey(idA: number, idB: number): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}
