import { Vec2 } from '../math/Vec2.js';
import { Body } from '../dynamics/Body.js';
import { ShapeType } from '../shapes/Shape.js';
import { Circle } from '../shapes/Circle.js';
import { Polygon } from '../shapes/Polygon.js';
import { type Manifold, mixMaterials } from './Manifold.js';
import { polygonVsPolygon } from './sat.js';

// ---------------------------------------------------------------------------
// Circle vs Circle
// ---------------------------------------------------------------------------

/**
 * Detect collision between two circle-shaped bodies.
 *
 * Returns a manifold with a single contact point, or null if separated.
 * Normal points from bodyA toward bodyB.
 *
 * Hot-path optimized: uses inline rotation math instead of Mat2 allocations.
 */
export function circleVsCircle(bodyA: Body, bodyB: Body): Manifold | null {
  const circleA = bodyA.shape as Circle;
  const circleB = bodyB.shape as Circle;

  // Compute world-space centers with inline rotation (avoids Mat2 + Vec2 allocs)
  const cosA = Math.cos(bodyA.angle);
  const sinA = Math.sin(bodyA.angle);
  const oax = circleA.offset.x;
  const oay = circleA.offset.y;
  const cax = bodyA.position.x + (cosA * oax - sinA * oay);
  const cay = bodyA.position.y + (sinA * oax + cosA * oay);

  const cosB = Math.cos(bodyB.angle);
  const sinB = Math.sin(bodyB.angle);
  const obx = circleB.offset.x;
  const oby = circleB.offset.y;
  const cbx = bodyB.position.x + (cosB * obx - sinB * oby);
  const cby = bodyB.position.y + (sinB * obx + cosB * oby);

  const sumRadii = circleA.radius + circleB.radius;
  const dx = cbx - cax;
  const dy = cby - cay;
  const distSq = dx * dx + dy * dy;

  if (distSq >= sumRadii * sumRadii) {
    return null;
  }

  const dist = Math.sqrt(distSq);

  // Normal from A toward B
  let nx: number;
  let ny: number;
  if (dist < 1e-10) {
    nx = 1;
    ny = 0;
  } else {
    const invDist = 1 / dist;
    nx = dx * invDist;
    ny = dy * invDist;
  }

  const depth = sumRadii - dist;

  // Contact point on surface of A toward B
  const cpx = cax + nx * circleA.radius;
  const cpy = cay + ny * circleA.radius;

  const materials = mixMaterials(bodyA.shape, bodyB.shape);

  return {
    bodyA,
    bodyB,
    normal: new Vec2(nx, ny),
    contacts: [{ point: new Vec2(cpx, cpy), depth, id: 0, normalImpulse: 0, tangentImpulse: 0 }],
    friction: materials.friction,
    restitution: materials.restitution,
    isSensor: bodyA.isSensor || bodyB.isSensor,
  };
}

// ---------------------------------------------------------------------------
// Circle vs Polygon (Voronoi region approach)
// ---------------------------------------------------------------------------

/**
 * Detect collision between a circle body and a polygon body.
 *
 * Uses Voronoi region approach:
 * 1. Transform circle center to polygon local space
 * 2. Find closest feature (vertex or edge)
 * 3. Determine if circle overlaps
 *
 * Normal points from circleBody toward polyBody.
 *
 * Hot-path optimized: uses inline rotation, scalar math for transforms.
 */
export function circleVsPolygon(
  circleBody: Body,
  polyBody: Body,
): Manifold | null {
  const circle = circleBody.shape as Circle;
  const polygon = polyBody.shape as Polygon;

  // Compute world-space circle center (inline rotation)
  const cosC = Math.cos(circleBody.angle);
  const sinC = Math.sin(circleBody.angle);
  const cox = circle.offset.x;
  const coy = circle.offset.y;
  const circleCx = circleBody.position.x + (cosC * cox - sinC * coy);
  const circleCy = circleBody.position.y + (sinC * cox + cosC * coy);

  // Polygon rotation (and inverse = transpose)
  const cosP = Math.cos(polyBody.angle);
  const sinP = Math.sin(polyBody.angle);

  // Transform circle center into polygon's local space
  // Inverse rotation (transpose): [cos, sin; -sin, cos] * (circleCenter - polyPos)
  const dpx = circleCx - polyBody.position.x;
  const dpy = circleCy - polyBody.position.y;
  const localCx = cosP * dpx + sinP * dpy;
  const localCy = -sinP * dpx + cosP * dpy;

  // Account for polygon offset
  const pox = polygon.offset.x;
  const poy = polygon.offset.y;
  const localRelX = localCx - pox;
  const localRelY = localCy - poy;

  const verts = polygon.vertices;
  const normals = polygon.normals;
  const n = verts.length;
  const radius = circle.radius;

  // Find the edge with minimum separation to circle center
  let bestSep = -Infinity;
  let bestEdge = 0;

  for (let i = 0; i < n; i++) {
    const sep = normals[i].x * (localRelX - verts[i].x) + normals[i].y * (localRelY - verts[i].y);
    if (sep > radius) {
      return null;
    }
    if (sep > bestSep) {
      bestSep = sep;
      bestEdge = i;
    }
  }

  const v1 = verts[bestEdge];
  const v2 = verts[(bestEdge + 1) % n];

  // Check if center is inside polygon (all separations are negative)
  if (bestSep < 1e-10) {
    const lnx = normals[bestEdge].x;
    const lny = normals[bestEdge].y;
    const depth = radius - bestSep;

    // Contact point: circle center projected onto edge
    const lcx = localRelX - lnx * bestSep;
    const lcy = localRelY - lny * bestSep;

    // Transform back to world space
    const wcx = polyBody.position.x + (cosP * (lcx + pox) - sinP * (lcy + poy));
    const wcy = polyBody.position.y + (sinP * (lcx + pox) + cosP * (lcy + poy));

    // Normal from circle toward polygon: negate polygon's outward normal
    const wnx = -(cosP * lnx - sinP * lny);
    const wny = -(sinP * lnx + cosP * lny);

    const materials = mixMaterials(circleBody.shape, polyBody.shape);

    return {
      bodyA: circleBody,
      bodyB: polyBody,
      normal: new Vec2(wnx, wny),
      contacts: [{ point: new Vec2(wcx, wcy), depth, id: bestEdge, normalImpulse: 0, tangentImpulse: 0 }],
      friction: materials.friction,
      restitution: materials.restitution,
      isSensor: circleBody.isSensor || polyBody.isSensor,
    };
  }

  // Determine Voronoi region: vertex1, vertex2, or edge interior
  const edgeX = v2.x - v1.x;
  const edgeY = v2.y - v1.y;
  const d1x = localRelX - v1.x;
  const d1y = localRelY - v1.y;
  const u = edgeX * d1x + edgeY * d1y;
  const edgeLenSq = edgeX * edgeX + edgeY * edgeY;

  let lnx: number;
  let lny: number;
  let lcx: number;
  let lcy: number;
  let depth: number;
  let featureId: number;

  if (u <= 0) {
    // Voronoi region of vertex 1
    const distSq = (localRelX - v1.x) * (localRelX - v1.x) + (localRelY - v1.y) * (localRelY - v1.y);
    if (distSq > radius * radius) return null;
    const dist = Math.sqrt(distSq);
    if (dist > 1e-10) {
      const invDist = 1 / dist;
      lnx = (localRelX - v1.x) * invDist;
      lny = (localRelY - v1.y) * invDist;
    } else {
      lnx = 1;
      lny = 0;
    }
    depth = radius - dist;
    lcx = v1.x;
    lcy = v1.y;
    featureId = bestEdge;
  } else if (u >= edgeLenSq) {
    // Voronoi region of vertex 2
    const distSq = (localRelX - v2.x) * (localRelX - v2.x) + (localRelY - v2.y) * (localRelY - v2.y);
    if (distSq > radius * radius) return null;
    const dist = Math.sqrt(distSq);
    if (dist > 1e-10) {
      const invDist = 1 / dist;
      lnx = (localRelX - v2.x) * invDist;
      lny = (localRelY - v2.y) * invDist;
    } else {
      lnx = 1;
      lny = 0;
    }
    depth = radius - dist;
    lcx = v2.x;
    lcy = v2.y;
    featureId = (bestEdge + 1) % n;
  } else {
    // Edge interior region
    lnx = normals[bestEdge].x;
    lny = normals[bestEdge].y;
    depth = radius - bestSep;
    const t = u / edgeLenSq;
    lcx = v1.x + edgeX * t;
    lcy = v1.y + edgeY * t;
    featureId = bestEdge;
  }

  // Transform back to world space
  const wcx = polyBody.position.x + (cosP * (lcx + pox) - sinP * (lcy + poy));
  const wcy = polyBody.position.y + (sinP * (lcx + pox) + cosP * (lcy + poy));
  // Normal from circle toward polygon: negate polygon's local outward normal
  const wnx = -(cosP * lnx - sinP * lny);
  const wny = -(sinP * lnx + cosP * lny);

  const materials = mixMaterials(circleBody.shape, polyBody.shape);

  return {
    bodyA: circleBody,
    bodyB: polyBody,
    normal: new Vec2(wnx, wny),
    contacts: [{ point: new Vec2(wcx, wcy), depth, id: featureId, normalImpulse: 0, tangentImpulse: 0 }],
    friction: materials.friction,
    restitution: materials.restitution,
    isSensor: circleBody.isSensor || polyBody.isSensor,
  };
}

// ---------------------------------------------------------------------------
// Narrowphase dispatch
// ---------------------------------------------------------------------------

/**
 * Detect collision between two bodies, dispatching to the appropriate
 * algorithm based on shape types.
 *
 * Returns a manifold with normal pointing from bodyA toward bodyB, or null
 * if no collision.
 */
export function detectNarrowphase(
  bodyA: Body,
  bodyB: Body,
): Manifold | null {
  const typeA = bodyA.shape.type;
  const typeB = bodyB.shape.type;

  // Circle + Circle
  if (typeA === ShapeType.Circle && typeB === ShapeType.Circle) {
    return circleVsCircle(bodyA, bodyB);
  }

  // Circle + Polygon
  if (typeA === ShapeType.Circle && typeB === ShapeType.Polygon) {
    return circleVsPolygon(bodyA, bodyB);
  }

  // Polygon + Circle -> swap and flip normal
  if (typeA === ShapeType.Polygon && typeB === ShapeType.Circle) {
    const manifold = circleVsPolygon(bodyB, bodyA);
    if (manifold === null) return null;
    // Flip: swap bodies and negate normal so it points from bodyA toward bodyB
    manifold.bodyA = bodyA;
    manifold.bodyB = bodyB;
    manifold.normal.negate();
    return manifold;
  }

  // Polygon + Polygon
  if (typeA === ShapeType.Polygon && typeB === ShapeType.Polygon) {
    return polygonVsPolygon(bodyA, bodyB);
  }

  return null;
}
