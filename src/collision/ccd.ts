import { type Body } from '../dynamics/Body.js';
import { ShapeType } from '../shapes/Shape.js';
import { type Circle } from '../shapes/Circle.js';
import { type Polygon } from '../shapes/Polygon.js';

/**
 * Result of a time-of-impact (TOI) query between two bodies.
 */
export interface TOIResult {
  /** Parametric fraction in [0, 1] where first contact occurs within the step. */
  toi: number;
  /** Whether a valid TOI was found. */
  hit: boolean;
}

/**
 * Maximum iterations for TOI bisection to prevent infinite loops.
 * 20 iterations gives ~1e-6 precision which is more than sufficient.
 */
const MAX_TOI_ITERATIONS = 20;

/**
 * Compute time of impact between two moving bodies within a single timestep.
 *
 * Uses conservative advancement: sweeps the bodies forward in time and finds
 * the earliest fraction t in [0, 1] where the distance between them reaches zero.
 *
 * Currently supports:
 * - Circle vs Circle (exact quadratic)
 * - Circle vs Polygon (bisection with distance bound)
 *
 * For unsupported shape pairs, returns { hit: false, toi: 1 }.
 *
 * @param bodyA First body
 * @param bodyB Second body
 * @param dt Timestep duration (used to compute displacement)
 * @returns TOI result with fraction and hit flag
 */
export function computeTOI(bodyA: Body, bodyB: Body, dt: number): TOIResult {
  const typeA = bodyA.shape.type;
  const typeB = bodyB.shape.type;

  if (typeA === ShapeType.Circle && typeB === ShapeType.Circle) {
    return toiCircleCircle(bodyA, bodyB, dt);
  }

  if (typeA === ShapeType.Circle && typeB === ShapeType.Polygon) {
    return toiCirclePolygon(bodyA, bodyB, dt);
  }

  if (typeA === ShapeType.Polygon && typeB === ShapeType.Circle) {
    return toiCirclePolygon(bodyB, bodyA, dt);
  }

  // Polygon-polygon TOI not yet implemented — fall back to discrete
  return { hit: false, toi: 1 };
}

// ---------------------------------------------------------------------------
// Circle vs Circle TOI — exact quadratic solution
// ---------------------------------------------------------------------------

/**
 * Exact TOI for two moving circles using quadratic formula on the
 * parametric distance equation.
 *
 * At time t, positions are:
 *   pA(t) = pA + vA * t * dt
 *   pB(t) = pB + vB * t * dt
 *
 * Contact when |pB(t) - pA(t)| = rA + rB
 * This gives a quadratic in t.
 */
function toiCircleCircle(bodyA: Body, bodyB: Body, dt: number): TOIResult {
  const circleA = bodyA.shape as Circle;
  const circleB = bodyB.shape as Circle;

  // Start positions (world-space centers with offset, ignoring rotation for speed)
  const cosA = Math.cos(bodyA.angle);
  const sinA = Math.sin(bodyA.angle);
  const oax = circleA.offset.x;
  const oay = circleA.offset.y;
  const pax = bodyA.position.x + (cosA * oax - sinA * oay);
  const pay = bodyA.position.y + (sinA * oax + cosA * oay);

  const cosB = Math.cos(bodyB.angle);
  const sinB = Math.sin(bodyB.angle);
  const obx = circleB.offset.x;
  const oby = circleB.offset.y;
  const pbx = bodyB.position.x + (cosB * obx - sinB * oby);
  const pby = bodyB.position.y + (sinB * obx + cosB * oby);

  // Relative position and velocity
  const rx = pbx - pax;
  const ry = pby - pay;
  const vax = bodyA.velocity.x * dt;
  const vay = bodyA.velocity.y * dt;
  const vbx = bodyB.velocity.x * dt;
  const vby = bodyB.velocity.y * dt;
  const dvx = vbx - vax;
  const dvy = vby - vay;

  const sumR = circleA.radius + circleB.radius;

  // Quadratic: |r + t*dv|^2 = sumR^2
  // a*t^2 + 2*b*t + c = 0
  const a = dvx * dvx + dvy * dvy;
  const b = rx * dvx + ry * dvy;
  const c = rx * rx + ry * ry - sumR * sumR;

  // Already overlapping at t=0
  if (c <= 0) {
    return { hit: true, toi: 0 };
  }

  // No relative motion
  if (a < 1e-12) {
    return { hit: false, toi: 1 };
  }

  const disc = b * b - a * c;
  if (disc < 0) {
    return { hit: false, toi: 1 };
  }

  const sqrtDisc = Math.sqrt(disc);
  let t = (-b - sqrtDisc) / a;

  if (t < 0) t = (-b + sqrtDisc) / a;
  if (t < 0 || t > 1) {
    return { hit: false, toi: 1 };
  }

  return { hit: true, toi: t };
}

// ---------------------------------------------------------------------------
// Circle vs Polygon TOI — bisection with distance check
// ---------------------------------------------------------------------------

/**
 * TOI for a moving circle against a (possibly moving) polygon.
 * Uses bisection on the time parameter, checking circle-polygon distance
 * at each sample. This is pragmatic rather than exact.
 *
 * The polygon is treated as stationary relative to its swept position.
 * Angular motion of the polygon is ignored for TOI (acceptable for CCD
 * as angular tunneling is rare for fast linear motion).
 */
function toiCirclePolygon(circleBody: Body, polyBody: Body, dt: number): TOIResult {
  const circle = circleBody.shape as Circle;
  const polygon = polyBody.shape as Polygon;
  const radius = circle.radius;

  // Check if already overlapping at t=0
  const d0 = circlePolygonDistance(circleBody, polyBody, circle, polygon, 0, dt);
  if (d0 <= 0) {
    return { hit: true, toi: 0 };
  }

  // Sample the distance at several points to find a bracket where distance
  // goes from positive to negative. This handles the pass-through case where
  // the bullet enters and exits the polygon within one step.
  const SAMPLES = 16;
  let lo = 0;
  let dLo = d0;

  for (let s = 1; s <= SAMPLES; s++) {
    const t = s / SAMPLES;
    const d = circlePolygonDistance(circleBody, polyBody, circle, polygon, t, dt);

    if (d <= 0) {
      // Found a bracket [lo, t] where distance goes from positive to negative
      let hi = t;

      for (let iter = 0; iter < MAX_TOI_ITERATIONS; iter++) {
        const mid = (lo + hi) * 0.5;
        const dist = circlePolygonDistance(circleBody, polyBody, circle, polygon, mid, dt);

        if (Math.abs(dist) < radius * 0.01) {
          return { hit: true, toi: mid };
        }

        if (dist > 0) {
          lo = mid;
        } else {
          hi = mid;
        }
      }

      return { hit: true, toi: lo };
    }

    lo = t;
    dLo = d;
  }

  // No crossing found in any sample interval
  return { hit: false, toi: 1 };
}

/**
 * Signed distance from circle to polygon at parametric time t in [0, 1].
 * Positive = separated, negative = overlapping.
 * Linearly interpolates positions by t * dt * velocity.
 */
function circlePolygonDistance(
  circleBody: Body,
  polyBody: Body,
  circle: Circle,
  polygon: Polygon,
  t: number,
  dt: number,
): number {
  // Circle center at time t
  const cosC = Math.cos(circleBody.angle);
  const sinC = Math.sin(circleBody.angle);
  const cox = circle.offset.x;
  const coy = circle.offset.y;
  const cx = circleBody.position.x + cosC * cox - sinC * coy + circleBody.velocity.x * t * dt;
  const cy = circleBody.position.y + sinC * cox + cosC * coy + circleBody.velocity.y * t * dt;

  // Polygon position at time t (linear interpolation, angular motion ignored for CCD)
  const ppx = polyBody.position.x + polyBody.velocity.x * t * dt;
  const ppy = polyBody.position.y + polyBody.velocity.y * t * dt;

  // Transform circle center to polygon local space
  const cosP = Math.cos(polyBody.angle);
  const sinP = Math.sin(polyBody.angle);
  const dpx = cx - ppx;
  const dpy = cy - ppy;
  const localX = cosP * dpx + sinP * dpy - polygon.offset.x;
  const localY = -sinP * dpx + cosP * dpy - polygon.offset.y;

  // Find minimum signed distance from circle center to polygon edges
  const verts = polygon.vertices;
  const normals = polygon.normals;
  let maxSep = -Infinity;

  for (let i = 0; i < normals.length; i++) {
    const sep = normals[i].x * (localX - verts[i].x) + normals[i].y * (localY - verts[i].y);
    if (sep > maxSep) maxSep = sep;
  }

  // Distance = separation from nearest edge minus radius
  return maxSep - circle.radius;
}
