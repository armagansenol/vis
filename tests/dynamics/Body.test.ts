import { describe, it, expect } from 'vitest';
import { Body, BodyType } from '../../src/dynamics/index.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Polygon } from '../../src/shapes/Polygon.js';
import { Vec2 } from '../../src/math/Vec2.js';
import { approxEqual } from '../../src/math/utils.js';

describe('Body', () => {
  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  describe('construction', () => {
    it('should create a dynamic body with circle shape and correct mass', () => {
      const radius = 1;
      const density = 1;
      const circle = new Circle(radius, { density });
      const body = new Body({ shape: circle });

      // mass = density * pi * r^2 = 1 * pi * 1 = pi
      const expectedMass = Math.PI;
      expect(approxEqual(body.mass, expectedMass)).toBe(true);
      expect(approxEqual(body.invMass, 1 / expectedMass)).toBe(true);
      expect(body.type).toBe(BodyType.Dynamic);
    });

    it('should default to Dynamic type, zero position, zero velocity, gravityScale=1', () => {
      const circle = new Circle(1);
      const body = new Body({ shape: circle });

      expect(body.type).toBe(BodyType.Dynamic);
      expect(body.position.x).toBe(0);
      expect(body.position.y).toBe(0);
      expect(body.velocity.x).toBe(0);
      expect(body.velocity.y).toBe(0);
      expect(body.angle).toBe(0);
      expect(body.angularVelocity).toBe(0);
      expect(body.gravityScale).toBe(1);
    });

    it('should accept initial position, velocity, angle, and angular velocity', () => {
      const circle = new Circle(1);
      const body = new Body({
        shape: circle,
        position: new Vec2(10, 20),
        velocity: new Vec2(5, -3),
        angle: 0.5,
        angularVelocity: 1.2,
      });

      expect(body.position.x).toBe(10);
      expect(body.position.y).toBe(20);
      expect(body.velocity.x).toBe(5);
      expect(body.velocity.y).toBe(-3);
      expect(body.angle).toBe(0.5);
      expect(body.angularVelocity).toBe(1.2);
    });

    it('should clone position and velocity to prevent external mutation', () => {
      const pos = new Vec2(1, 2);
      const vel = new Vec2(3, 4);
      const body = new Body({ shape: new Circle(1), position: pos, velocity: vel });

      pos.set(99, 99);
      vel.set(99, 99);

      expect(body.position.x).toBe(1);
      expect(body.position.y).toBe(2);
      expect(body.velocity.x).toBe(3);
      expect(body.velocity.y).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Static body
  // ---------------------------------------------------------------------------

  describe('static body', () => {
    it('should have invMass=0 and invInertia=0', () => {
      const body = new Body({
        shape: new Circle(1),
        type: BodyType.Static,
      });

      expect(body.mass).toBe(0);
      expect(body.invMass).toBe(0);
      expect(body.inertia).toBe(0);
      expect(body.invInertia).toBe(0);
    });

    it('should not respond to forces', () => {
      const body = new Body({
        shape: new Circle(1),
        type: BodyType.Static,
      });

      body.applyForce(new Vec2(1000, 1000));
      body.integrate(new Vec2(0, -9.81), 1 / 60);

      expect(body.velocity.x).toBe(0);
      expect(body.velocity.y).toBe(0);
      expect(body.position.x).toBe(0);
      expect(body.position.y).toBe(0);
    });

    it('should not respond to gravity', () => {
      const body = new Body({
        shape: new Circle(1),
        type: BodyType.Static,
        position: new Vec2(0, 100),
      });

      for (let i = 0; i < 60; i++) {
        body.integrate(new Vec2(0, -9.81), 1 / 60);
      }

      expect(body.position.x).toBe(0);
      expect(body.position.y).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // Kinematic body
  // ---------------------------------------------------------------------------

  describe('kinematic body', () => {
    it('should have invMass=0 and invInertia=0', () => {
      const body = new Body({
        shape: new Circle(1),
        type: BodyType.Kinematic,
      });

      expect(body.mass).toBe(0);
      expect(body.invMass).toBe(0);
      expect(body.invInertia).toBe(0);
    });

    it('should integrate position from velocity', () => {
      const body = new Body({
        shape: new Circle(1),
        type: BodyType.Kinematic,
        velocity: new Vec2(10, 0),
      });

      body.integrate(new Vec2(0, -9.81), 0.1);

      expect(approxEqual(body.position.x, 1)).toBe(true);
      expect(approxEqual(body.position.y, 0)).toBe(true);
    });

    it('should not respond to applied forces', () => {
      const body = new Body({
        shape: new Circle(1),
        type: BodyType.Kinematic,
        velocity: new Vec2(10, 0),
      });

      body.applyForce(new Vec2(0, 1000));
      body.integrate(new Vec2(0, -9.81), 0.1);

      // Velocity should be unchanged (still 10, 0)
      expect(body.velocity.x).toBe(10);
      expect(body.velocity.y).toBe(0);
    });

    it('should not be affected by gravity', () => {
      const body = new Body({
        shape: new Circle(1),
        type: BodyType.Kinematic,
        velocity: new Vec2(0, 0),
      });

      body.integrate(new Vec2(0, -9.81), 1);

      expect(body.velocity.y).toBe(0);
      expect(body.position.y).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Dynamic body under gravity
  // ---------------------------------------------------------------------------

  describe('dynamic body under gravity', () => {
    it('should update velocity and position correctly after one step', () => {
      const body = new Body({
        shape: new Circle(1),
        position: new Vec2(0, 100),
      });

      const dt = 1 / 60;
      body.integrate(new Vec2(0, -9.81), dt);

      // velocity.y = 0 + (-9.81 * 1) * dt = -9.81 / 60
      const expectedVy = -9.81 * dt;
      expect(approxEqual(body.velocity.y, expectedVy)).toBe(true);

      // position.y = 100 + velocity.y * dt (semi-implicit: uses new velocity)
      const expectedPy = 100 + expectedVy * dt;
      expect(approxEqual(body.position.y, expectedPy)).toBe(true);
    });

    it('should handle gravity scale = 0 (no gravity)', () => {
      const body = new Body({
        shape: new Circle(1),
        position: new Vec2(0, 100),
        gravityScale: 0,
      });

      body.integrate(new Vec2(0, -9.81), 1 / 60);

      expect(body.velocity.y).toBe(0);
      expect(body.position.y).toBe(100);
    });

    it('should handle gravity scale = 2 (double gravity)', () => {
      const body = new Body({
        shape: new Circle(1),
        position: new Vec2(0, 100),
        gravityScale: 2,
      });

      const dt = 1 / 60;
      body.integrate(new Vec2(0, -9.81), dt);

      const expectedVy = -9.81 * 2 * dt;
      expect(approxEqual(body.velocity.y, expectedVy)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Force at off-center point
  // ---------------------------------------------------------------------------

  describe('force at off-center point', () => {
    it('should accumulate force and generate torque', () => {
      const body = new Body({
        shape: Polygon.box(2, 2),
        position: new Vec2(0, 0),
      });

      // Apply force (0, 10) at world point (1, 0)
      body.applyForce(new Vec2(0, 10), new Vec2(1, 0));

      expect(body.force.x).toBe(0);
      expect(body.force.y).toBe(10);
      // torque = rx * fy - ry * fx = 1*10 - 0*0 = 10
      expect(body.torque).toBe(10);
    });

    it('should not generate torque when force applied at center', () => {
      const body = new Body({
        shape: Polygon.box(2, 2),
        position: new Vec2(5, 5),
      });

      body.applyForce(new Vec2(10, 0), new Vec2(5, 5));

      expect(body.force.x).toBe(10);
      expect(body.torque).toBe(0);
    });

    it('should not generate torque with applyForceAtCenter', () => {
      const body = new Body({
        shape: Polygon.box(2, 2),
      });

      body.applyForceAtCenter(new Vec2(100, 200));

      expect(body.force.x).toBe(100);
      expect(body.force.y).toBe(200);
      expect(body.torque).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Impulse
  // ---------------------------------------------------------------------------

  describe('impulse', () => {
    it('should instantly change velocity proportional to inverse mass', () => {
      // Use a circle with density such that mass = 2
      // mass = density * pi * r^2
      // For mass = 2: density = 2 / (pi * r^2)
      const radius = 1;
      const density = 2 / (Math.PI * radius * radius);
      const circle = new Circle(radius, { density });
      const body = new Body({ shape: circle });

      expect(approxEqual(body.mass, 2)).toBe(true);

      body.applyImpulse(new Vec2(4, 0));

      // velocity.x = 4 * invMass = 4 * 0.5 = 2
      expect(approxEqual(body.velocity.x, 2)).toBe(true);
      expect(body.velocity.y).toBe(0);
    });

    it('should change angular velocity when applied at off-center point', () => {
      const body = new Body({
        shape: Polygon.box(2, 2),
      });

      const invI = body.invInertia;
      body.applyImpulse(new Vec2(0, 1), new Vec2(1, 0));

      // angVel += (rx * jy - ry * jx) * invInertia = (1*1 - 0*0) * invI = invI
      expect(approxEqual(body.angularVelocity, invI)).toBe(true);
    });

    it('should not change velocity of static body (invMass=0)', () => {
      const body = new Body({
        shape: new Circle(1),
        type: BodyType.Static,
      });

      body.applyImpulse(new Vec2(100, 100));

      expect(body.velocity.x).toBe(0);
      expect(body.velocity.y).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Force clearing after integration
  // ---------------------------------------------------------------------------

  describe('force clearing', () => {
    it('should zero force and torque after integrate', () => {
      const body = new Body({
        shape: new Circle(1),
      });

      body.applyForce(new Vec2(10, 20), new Vec2(1, 0));
      expect(body.force.x).toBe(10);
      expect(body.force.y).toBe(20);
      expect(body.torque).not.toBe(0);

      body.integrate(new Vec2(0, 0), 1 / 60);

      expect(body.force.x).toBe(0);
      expect(body.force.y).toBe(0);
      expect(body.torque).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Multi-step integration (1 second free fall)
  // ---------------------------------------------------------------------------

  describe('multi-step integration', () => {
    it('should approximate free fall after 1 second (60 steps)', () => {
      const y0 = 100;
      const body = new Body({
        shape: new Circle(1),
        position: new Vec2(0, y0),
      });

      const dt = 1 / 60;
      const g = new Vec2(0, -9.81);

      for (let i = 0; i < 60; i++) {
        body.integrate(g, dt);
      }

      // After 1 second of free fall:
      // Analytical: v = g*t = -9.81 m/s
      // Semi-implicit Euler approximation should be very close
      expect(approxEqual(body.velocity.y, -9.81, 0.01)).toBe(true);

      // Analytical: y = y0 + 0.5 * g * t^2 = 100 - 4.905 = 95.095
      // Semi-implicit Euler is slightly different but close
      const expectedDrop = 0.5 * 9.81 * 1 * 1; // ~4.905
      const actualDrop = y0 - body.position.y;
      // Allow some tolerance for discrete integration
      expect(Math.abs(actualDrop - expectedDrop)).toBeLessThan(0.2);
    });
  });

  // ---------------------------------------------------------------------------
  // Body type switching
  // ---------------------------------------------------------------------------

  describe('body type switching', () => {
    it('setStatic should zero mass and velocity', () => {
      const body = new Body({
        shape: new Circle(1),
        velocity: new Vec2(10, 20),
      });

      expect(body.mass).toBeGreaterThan(0);

      body.setStatic();

      expect(body.type).toBe(BodyType.Static);
      expect(body.mass).toBe(0);
      expect(body.invMass).toBe(0);
      expect(body.velocity.x).toBe(0);
      expect(body.velocity.y).toBe(0);
    });

    it('setDynamic should recompute mass from shape', () => {
      const circle = new Circle(1);
      const body = new Body({
        shape: circle,
        type: BodyType.Static,
      });

      expect(body.mass).toBe(0);

      body.setDynamic();

      expect(body.type).toBe(BodyType.Dynamic);
      expect(body.mass).toBeGreaterThan(0);
      expect(body.invMass).toBeGreaterThan(0);
    });

    it('setKinematic should zero mass but keep velocity', () => {
      const body = new Body({
        shape: new Circle(1),
        velocity: new Vec2(5, 10),
      });

      body.setKinematic();

      expect(body.type).toBe(BodyType.Kinematic);
      expect(body.mass).toBe(0);
      expect(body.invMass).toBe(0);
      // Velocity is preserved
      expect(body.velocity.x).toBe(5);
      expect(body.velocity.y).toBe(10);
    });
  });

  // ---------------------------------------------------------------------------
  // Import from barrel exports
  // ---------------------------------------------------------------------------

  describe('barrel exports', () => {
    it('should import Body and BodyType from dynamics index', async () => {
      const dynamics = await import('../../src/dynamics/index.js');
      expect(dynamics.Body).toBeDefined();
      expect(dynamics.BodyType).toBeDefined();
    });

    it('should import everything from main index', async () => {
      const vis = await import('../../src/index.js');
      expect(vis.Body).toBeDefined();
      expect(vis.BodyType).toBeDefined();
      expect(vis.Vec2).toBeDefined();
      expect(vis.Circle).toBeDefined();
      expect(vis.Polygon).toBeDefined();
    });
  });
});
