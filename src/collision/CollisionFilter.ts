import { Body } from '../dynamics/Body.js';
import { BodyType } from '../dynamics/BodyType.js';

/**
 * Determine whether two bodies should collide based on their category/mask
 * bitmasks and body types.
 *
 * Returns false if:
 * - Both bodies are static (static-static pairs never collide).
 * - The category/mask bitmask check fails in either direction.
 */
export function shouldCollide(a: Body, b: Body): boolean {
  // Static-static pairs never collide
  if (a.type === BodyType.Static && b.type === BodyType.Static) {
    return false;
  }

  // Bitmask filter: both directions must pass
  return (
    (a.categoryBits & b.maskBits) !== 0 &&
    (b.categoryBits & a.maskBits) !== 0
  );
}
