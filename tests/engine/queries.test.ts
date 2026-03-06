import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/engine/World.js';
import { Body } from '../../src/dynamics/Body.js';
import { BodyType } from '../../src/dynamics/BodyType.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Vec2 } from '../../src/math/Vec2.js';
import { AABB } from '../../src/math/AABB.js';

beforeEach(() => Body.resetIdCounter());

/** Step once to populate broadphase */
function populate(world: World) {
  world.step(1 / 60);
}

describe('Query API', () => {
  describe('queryPoint', () => {
    it('finds circle body at point', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const body = new Body({
        position: new Vec2(5, 5),
        shape: new Circle(1),
      });
      world.addBody(body);
      populate(world);

      const hits = world.queryPoint(new Vec2(5.5, 5));
      expect(hits.length).toBe(1);
      expect(hits[0].body).toBe(body);
    });

    it('misses circle body outside radius', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const body = new Body({
        position: new Vec2(5, 5),
        shape: new Circle(1),
      });
      world.addBody(body);
      populate(world);

      const hits = world.queryPoint(new Vec2(7, 5));
      expect(hits.length).toBe(0);
    });

    it('finds polygon body at point', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const body = new Body({
        position: new Vec2(0, 0),
        shape: Polygon.box(2, 2),
      });
      world.addBody(body);
      populate(world);

      const hits = world.queryPoint(new Vec2(0.5, 0.5));
      expect(hits.length).toBe(1);
      expect(hits[0].body).toBe(body);
    });

    it('misses polygon body outside', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const body = new Body({
        position: new Vec2(0, 0),
        shape: Polygon.box(2, 2),
      });
      world.addBody(body);
      populate(world);

      const hits = world.queryPoint(new Vec2(5, 5));
      expect(hits.length).toBe(0);
    });
  });

  describe('queryAABB', () => {
    it('finds bodies overlapping the query region', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const b1 = new Body({ position: new Vec2(0, 0), shape: new Circle(1) });
      const b2 = new Body({ position: new Vec2(10, 10), shape: new Circle(1) });
      world.addBody(b1);
      world.addBody(b2);
      populate(world);

      const hits = world.queryAABB(new AABB(new Vec2(-2, -2), new Vec2(2, 2)));
      expect(hits.length).toBe(1);
      expect(hits[0]).toBe(b1);
    });
  });

  describe('raycast', () => {
    it('hits a circle', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const body = new Body({
        position: new Vec2(5, 0),
        shape: new Circle(1),
      });
      world.addBody(body);
      populate(world);

      const hits = world.raycast(new Vec2(0, 0), new Vec2(1, 0), 100);
      expect(hits.length).toBe(1);
      expect(hits[0].body).toBe(body);
      expect(hits[0].point.x).toBeCloseTo(4, 0);
      expect(hits[0].fraction).toBeGreaterThan(0);
      expect(hits[0].fraction).toBeLessThan(1);
    });

    it('hits a polygon', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const body = new Body({
        position: new Vec2(5, 0),
        shape: Polygon.box(2, 2),
      });
      world.addBody(body);
      populate(world);

      const hits = world.raycast(new Vec2(0, 0), new Vec2(1, 0), 100);
      expect(hits.length).toBe(1);
      expect(hits[0].body).toBe(body);
      expect(hits[0].point.x).toBeCloseTo(4, 0);
    });

    it('returns empty for miss', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const body = new Body({
        position: new Vec2(5, 5),
        shape: new Circle(1),
      });
      world.addBody(body);
      populate(world);

      const hits = world.raycast(new Vec2(0, 0), new Vec2(1, 0), 100);
      expect(hits.length).toBe(0);
    });

    it('sorts by fraction (nearest first)', () => {
      const world = new World({ gravity: new Vec2(0, 0) });
      const far = new Body({ position: new Vec2(10, 0), shape: new Circle(1) });
      const near = new Body({ position: new Vec2(5, 0), shape: new Circle(1) });
      world.addBody(far);
      world.addBody(near);
      populate(world);

      const hits = world.raycast(new Vec2(0, 0), new Vec2(1, 0), 100);
      expect(hits.length).toBe(2);
      expect(hits[0].body).toBe(near);
      expect(hits[1].body).toBe(far);
    });
  });
});
