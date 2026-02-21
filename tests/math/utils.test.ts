import { describe, it, expect } from 'vitest';
import {
  EPSILON,
  clamp,
  lerp,
  approxEqual,
  degToRad,
  radToDeg,
  randomRange,
} from '../../src/math/utils.js';

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns min when below range', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('returns max when above range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns boundary values exactly', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('lerp', () => {
  it('returns a at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('extrapolates beyond [0,1]', () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });
});

describe('approxEqual', () => {
  it('considers equal values as equal', () => {
    expect(approxEqual(1, 1)).toBe(true);
  });

  it('considers values within epsilon as equal', () => {
    expect(approxEqual(1, 1 + EPSILON * 0.5)).toBe(true);
  });

  it('considers values beyond epsilon as not equal', () => {
    expect(approxEqual(1, 1 + EPSILON * 2)).toBe(false);
  });

  it('respects custom epsilon', () => {
    expect(approxEqual(1, 1.05, 0.1)).toBe(true);
    expect(approxEqual(1, 1.2, 0.1)).toBe(false);
  });
});

describe('degToRad / radToDeg', () => {
  it('converts 180 degrees to pi', () => {
    expect(approxEqual(degToRad(180), Math.PI)).toBe(true);
  });

  it('converts 90 degrees to pi/2', () => {
    expect(approxEqual(degToRad(90), Math.PI / 2)).toBe(true);
  });

  it('converts pi to 180 degrees', () => {
    expect(approxEqual(radToDeg(Math.PI), 180)).toBe(true);
  });

  it('round-trips correctly', () => {
    const deg = 45;
    expect(approxEqual(radToDeg(degToRad(deg)), deg)).toBe(true);
  });
});

describe('randomRange', () => {
  it('returns values within [min, max)', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomRange(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThan(10);
    }
  });
});
