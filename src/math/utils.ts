/** Float comparison epsilon for the engine. */
export const EPSILON = 1e-6;

/** Clamp value to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Linear interpolation: a + (b - a) * t. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Approximate float equality within epsilon tolerance. */
export function approxEqual(
  a: number,
  b: number,
  epsilon: number = EPSILON,
): boolean {
  return Math.abs(a - b) < epsilon;
}

/** Convert degrees to radians. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees. */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Random float in [min, max). */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Shortest-path angular interpolation.
 * Handles wraparound so that interpolation always takes the short way
 * around the circle (e.g. from 350 deg to 10 deg goes through 0,
 * not backward through 180).
 */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // Wrap diff into [-PI, PI]
  diff = diff - Math.round(diff / (2 * Math.PI)) * 2 * Math.PI;
  return a + diff * t;
}
