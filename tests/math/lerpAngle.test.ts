import { describe, it, expect } from 'vitest';
import { lerpAngle } from '../../src/math/utils.js';

describe('lerpAngle', () => {
  it('interpolates normally for small differences', () => {
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it('takes the short path across 0/2PI boundary', () => {
    const a = -0.1; // just below 0
    const b = 0.1;  // just above 0
    expect(lerpAngle(a, b, 0.5)).toBeCloseTo(0);
  });

  it('wraps around PI boundary correctly', () => {
    const a = Math.PI - 0.1;
    const b = -Math.PI + 0.1;
    // Should go through PI, not backward through 0
    const mid = lerpAngle(a, b, 0.5);
    expect(Math.abs(mid)).toBeCloseTo(Math.PI, 0);
  });

  it('returns a at t=0', () => {
    expect(lerpAngle(1, 5, 0)).toBeCloseTo(1);
  });

  it('returns angle equivalent to b at t=1', () => {
    // lerpAngle wraps through the shortest path, so the result is
    // congruent to b (mod 2PI) but may not be numerically identical
    const result = lerpAngle(1, 5, 1);
    const diff = Math.abs(result - 5) % (2 * Math.PI);
    expect(Math.min(diff, 2 * Math.PI - diff)).toBeCloseTo(0);
  });

  it('handles large angle differences by wrapping', () => {
    // 350 degrees to 10 degrees (in radians) should go forward 20 deg, not backward 340
    const a = (350 * Math.PI) / 180;
    const b = (10 * Math.PI) / 180;
    const mid = lerpAngle(a, b, 0.5);
    // Should be close to 0 (or 360) degrees
    const midDeg = ((mid * 180) / Math.PI + 360) % 360;
    expect(midDeg).toBeCloseTo(0, 0);
  });
});
