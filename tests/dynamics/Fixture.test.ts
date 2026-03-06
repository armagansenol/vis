import { describe, it, expect, beforeEach } from 'vitest';
import { Fixture } from '../../src/dynamics/Fixture.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { Vec2 } from '../../src/math/Vec2.js';

describe('Fixture', () => {
  beforeEach(() => {
    Fixture.resetIdCounter();
  });

  it('creates a fixture with default options', () => {
    const shape = new Circle(1);
    const fixture = new Fixture({ shape });

    expect(fixture.shape).toBe(shape);
    expect(fixture.isSensor).toBe(false);
    expect(fixture.categoryBits).toBe(0x0001);
    expect(fixture.maskBits).toBe(0xFFFF);
    expect(fixture.body).toBeNull();
  });

  it('assigns auto-incrementing IDs', () => {
    const f1 = new Fixture({ shape: new Circle(1) });
    const f2 = new Fixture({ shape: new Circle(1) });
    expect(f1.id).toBe(0);
    expect(f2.id).toBe(1);
  });

  it('uses shape material by default', () => {
    const shape = new Circle(1, { density: 5, friction: 0.8, restitution: 0.9 });
    const fixture = new Fixture({ shape });

    expect(fixture.material.density).toBe(5);
    expect(fixture.material.friction).toBe(0.8);
    expect(fixture.material.restitution).toBe(0.9);
  });

  it('allows material overrides', () => {
    const shape = new Circle(1, { density: 1, friction: 0.3, restitution: 0.2 });
    const fixture = new Fixture({
      shape,
      density: 10,
      friction: 0.5,
      restitution: 0.8,
    });

    expect(fixture.material.density).toBe(10);
    expect(fixture.material.friction).toBe(0.5);
    expect(fixture.material.restitution).toBe(0.8);
  });

  it('computes AABB from shape', () => {
    const shape = new Circle(2);
    const fixture = new Fixture({ shape });

    const aabb = fixture.computeAABB(new Vec2(5, 5), 0);
    expect(aabb.min.x).toBeCloseTo(3);
    expect(aabb.min.y).toBeCloseTo(3);
    expect(aabb.max.x).toBeCloseTo(7);
    expect(aabb.max.y).toBeCloseTo(7);
  });

  it('computes mass data from fixture material density', () => {
    const shape = new Circle(1, { density: 2 });
    const fixture = new Fixture({ shape, density: 5 });

    const massData = fixture.computeMassData();
    // Uses fixture density (5), not shape density (2)
    const expectedMass = 5 * Math.PI * 1 * 1;
    expect(massData.mass).toBeCloseTo(expectedMass);
  });

  it('supports sensor fixtures', () => {
    const fixture = new Fixture({
      shape: Polygon.box(2, 2),
      isSensor: true,
      categoryBits: 0x0002,
      maskBits: 0x0004,
    });

    expect(fixture.isSensor).toBe(true);
    expect(fixture.categoryBits).toBe(0x0002);
    expect(fixture.maskBits).toBe(0x0004);
  });
});
