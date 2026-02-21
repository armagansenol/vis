import { Vec2 } from '../math/Vec2.js';
import { Mat2 } from '../math/Mat2.js';
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
 */
export function circleVsCircle(bodyA: Body, bodyB: Body): Manifold | null {
  const circleA = bodyA.shape as Circle;
  const circleB = bodyB.shape as Circle;

  // Compute world-space centers accounting for shape offset rotated by body angle
  const rotA = Mat2.fromAngle(bodyA.angle);
  const rotB = Mat2.fromAngle(bodyB.angle);
  const centerA = Vec2.add(bodyA.position, rotA.mulVec2(circleA.offset));
  const centerB = Vec2.add(bodyB.position, rotB.mulVec2(circleB.offset));

  const sumRadii = circleA.radius + circleB.radius;
  const distSq = Vec2.distanceSquared(centerA, centerB);

  // No overlap if distance >= sum of radii (touching = no penetration)
  if (distSq >= sumRadii * sumRadii) {
    return null;
  }

  const dist = Math.sqrt(distSq);

  // Normal from A toward B
  let normal: Vec2;
  if (dist < 1e-10) {
    // Coincident centers — fallback normal
    normal = new Vec2(1, 0);
  } else {
    normal = Vec2.sub(centerB, centerA).scale(1 / dist);
  }

  const depth = sumRadii - dist;

  // Contact point on surface of A toward B
  const contactPoint = Vec2.add(centerA, normal.clone().scale(circleA.radius));

  const materials = mixMaterials(bodyA.shape, bodyB.shape);

  return {
    bodyA,
    bodyB,
    normal,
    contacts: [{ point: contactPoint, depth, id: 0, normalImpulse: 0, tangentImpulse: 0 }],
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
 */
export function circleVsPolygon(
  circleBody: Body,
  polyBody: Body,
): Manifold | null {
  const circle = circleBody.shape as Circle;
  const polygon = polyBody.shape as Polygon;

  // Compute world-space circle center
  const rotCircle = Mat2.fromAngle(circleBody.angle);
  const circleCenter = Vec2.add(
    circleBody.position,
    rotCircle.mulVec2(circle.offset),
  );

  // Transform circle center into polygon's local space
  const rotPoly = Mat2.fromAngle(polyBody.angle);
  const rotPolyInv = Mat2.fromAngle(polyBody.angle);
  rotPolyInv.transpose(); // Transpose = inverse for rotation matrices

  const localCenter = rotPolyInv.mulVec2(
    Vec2.sub(circleCenter, polyBody.position),
  );
  // Account for polygon offset
  const localCenterRel = Vec2.sub(localCenter, polygon.offset);

  const verts = polygon.vertices;
  const normals = polygon.normals;
  const n = verts.length;
  const radius = circle.radius;

  // Find the edge with minimum separation to circle center
  let bestSep = -Infinity;
  let bestEdge = 0;

  for (let i = 0; i < n; i++) {
    // Signed distance from circle center to edge plane
    const sep = normals[i].dot(Vec2.sub(localCenterRel, verts[i]));
    if (sep > radius) {
      // Circle is fully outside this edge
      return null;
    }
    if (sep > bestSep) {
      bestSep = sep;
      bestEdge = i;
    }
  }

  // Get the two vertices of the best edge
  const v1 = verts[bestEdge];
  const v2 = verts[(bestEdge + 1) % n];

  // Check if center is inside polygon (all separations are negative)
  if (bestSep < 1e-10) {
    // Center is inside polygon — push out along best edge normal
    const localNormal = normals[bestEdge];
    const depth = radius - bestSep;

    // Contact point: circle center projected onto edge
    const localContact = Vec2.add(
      localCenterRel,
      localNormal.clone().scale(-bestSep),
    );

    // Transform back to world space
    const worldContact = Vec2.add(
      polyBody.position,
      rotPoly.mulVec2(Vec2.add(localContact, polygon.offset)),
    );
    const worldNormal = rotPoly.mulVec2(localNormal.clone());

    // Normal should point from circleBody toward polyBody
    // In this case the polygon's outward normal points away from the polygon
    // We want normal from circle toward polygon, so negate the polygon's outward normal
    worldNormal.negate();

    const materials = mixMaterials(circleBody.shape, polyBody.shape);

    return {
      bodyA: circleBody,
      bodyB: polyBody,
      normal: worldNormal,
      contacts: [{ point: worldContact, depth, id: bestEdge, normalImpulse: 0, tangentImpulse: 0 }],
      friction: materials.friction,
      restitution: materials.restitution,
      isSensor: circleBody.isSensor || polyBody.isSensor,
    };
  }

  // Determine Voronoi region: vertex1, vertex2, or edge interior
  const edge = Vec2.sub(v2, v1);
  const d1 = Vec2.sub(localCenterRel, v1);
  const u = edge.dot(d1);
  const edgeLenSq = edge.lengthSquared();

  let localNormal: Vec2;
  let localContact: Vec2;
  let depth: number;
  let featureId: number;

  if (u <= 0) {
    // Voronoi region of vertex 1
    const distSq = Vec2.distanceSquared(localCenterRel, v1);
    if (distSq > radius * radius) {
      return null;
    }
    const dist = Math.sqrt(distSq);
    localNormal =
      dist > 1e-10
        ? Vec2.sub(localCenterRel, v1).scale(1 / dist)
        : new Vec2(1, 0);
    depth = radius - dist;
    localContact = v1.clone();
    featureId = bestEdge; // vertex index
  } else if (u >= edgeLenSq) {
    // Voronoi region of vertex 2
    const distSq = Vec2.distanceSquared(localCenterRel, v2);
    if (distSq > radius * radius) {
      return null;
    }
    const dist = Math.sqrt(distSq);
    localNormal =
      dist > 1e-10
        ? Vec2.sub(localCenterRel, v2).scale(1 / dist)
        : new Vec2(1, 0);
    depth = radius - dist;
    localContact = v2.clone();
    featureId = (bestEdge + 1) % n; // vertex index
  } else {
    // Edge interior region
    localNormal = normals[bestEdge].clone();
    depth = radius - bestSep;
    // Project circle center onto edge
    const t = u / edgeLenSq;
    localContact = Vec2.add(v1.clone(), edge.clone().scale(t));
    featureId = bestEdge;
  }

  // Transform back to world space
  const worldContact = Vec2.add(
    polyBody.position,
    rotPoly.mulVec2(Vec2.add(localContact, polygon.offset)),
  );
  // The local normal points outward from polygon; we want normal from circle toward polygon
  const worldNormal = rotPoly.mulVec2(localNormal).negate();

  const materials = mixMaterials(circleBody.shape, polyBody.shape);

  return {
    bodyA: circleBody,
    bodyB: polyBody,
    normal: worldNormal,
    contacts: [{ point: worldContact, depth, id: featureId, normalImpulse: 0, tangentImpulse: 0 }],
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
