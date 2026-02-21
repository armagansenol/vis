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
