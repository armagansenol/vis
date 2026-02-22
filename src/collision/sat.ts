import { Vec2 } from '../math/Vec2.js';
import { Mat2 } from '../math/Mat2.js';
import { Body } from '../dynamics/Body.js';
import { Polygon } from '../shapes/Polygon.js';
import { type Manifold, type ContactPoint, mixMaterials } from './Manifold.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Transform polygon vertices to world space, accounting for body position,
 * angle, and polygon offset.
 */
function getWorldVertices(body: Body, polygon: Polygon): Vec2[] {
  const rot = Mat2.fromAngle(body.angle);
  const verts: Vec2[] = [];
  for (const v of polygon.vertices) {
    const local = Vec2.add(v, polygon.offset);
    verts.push(Vec2.add(body.position, rot.mulVec2(local)));
  }
  return verts;
}

/**
 * Rotate polygon normals to world space.
 */
function getWorldNormals(body: Body, polygon: Polygon): Vec2[] {
  const rot = Mat2.fromAngle(body.angle);
  const normals: Vec2[] = [];
  for (const n of polygon.normals) {
    normals.push(rot.mulVec2(n));
  }
  return normals;
}

/**
 * Project a set of vertices onto an axis, returning [min, max].
 */
function projectOnAxis(vertices: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of vertices) {
    const d = v.dot(axis);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/**
 * Find the edge on the polygon most aligned with the given normal.
 * Returns the index of that edge's first vertex.
 */
function findBestEdge(normals: Vec2[], normal: Vec2): number {
  let bestDot = -Infinity;
  let bestIdx = 0;
  for (let i = 0; i < normals.length; i++) {
    const d = normals[i].dot(normal);
    if (d > bestDot) {
      bestDot = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Find the edge on the polygon most anti-aligned with the given normal.
 * Returns the index of that edge's first vertex.
 */
function findIncidentEdge(normals: Vec2[], normal: Vec2): number {
  let bestDot = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < normals.length; i++) {
    const d = normals[i].dot(normal);
    if (d < bestDot) {
      bestDot = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Clip a polygon (array of points) against a half-plane defined by:
 *   normal . point >= offset
 *
 * Returns the clipped polygon.
 */
function clipByPlane(
  points: Vec2[],
  planeNormal: Vec2,
  planeOffset: number,
): Vec2[] {
  const out: Vec2[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const da = a.dot(planeNormal) - planeOffset;
    const db = b.dot(planeNormal) - planeOffset;

    if (da >= 0) {
      out.push(a);
    }

    // If edge crosses the plane, add intersection
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      out.push(
        new Vec2(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// SAT Polygon vs Polygon
// ---------------------------------------------------------------------------

/**
 * SAT polygon-polygon collision detection with Sutherland-Hodgman clipping
 * for contact point generation.
 *
 * Normal points from bodyA toward bodyB.
 */
export function polygonVsPolygon(
  bodyA: Body,
  bodyB: Body,
): Manifold | null {
  const polyA = bodyA.shape as Polygon;
  const polyB = bodyB.shape as Polygon;

  const vertsA = getWorldVertices(bodyA, polyA);
  const vertsB = getWorldVertices(bodyB, polyB);
  const normalsA = getWorldNormals(bodyA, polyA);
  const normalsB = getWorldNormals(bodyB, polyB);

  // Track minimum overlap (MTV)
  let minOverlap = Infinity;
  let mtvAxis = new Vec2(1, 0);
  let referenceIsA = true; // Which body owns the axis with smallest overlap

  // Test all axes from polygon A
  for (let i = 0; i < normalsA.length; i++) {
    const axis = normalsA[i];
    const [minA, maxA] = projectOnAxis(vertsA, axis);
    const [minB, maxB] = projectOnAxis(vertsB, axis);

    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) {
      return null; // Separating axis found
    }

    if (overlap < minOverlap) {
      minOverlap = overlap;
      mtvAxis = axis.clone();
      referenceIsA = true;
    }
  }

  // Test all axes from polygon B
  for (let i = 0; i < normalsB.length; i++) {
    const axis = normalsB[i];
    const [minA, maxA] = projectOnAxis(vertsA, axis);
    const [minB, maxB] = projectOnAxis(vertsB, axis);

    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) {
      return null; // Separating axis found
    }

    if (overlap < minOverlap) {
      minOverlap = overlap;
      mtvAxis = axis.clone();
      referenceIsA = false;
    }
  }

  // Ensure normal points from A toward B
  const centerA = computeCenter(vertsA);
  const centerB = computeCenter(vertsB);
  const d = Vec2.sub(centerB, centerA);
  if (d.dot(mtvAxis) < 0) {
    mtvAxis.negate();
    referenceIsA = !referenceIsA;
  }

  // ---------------------------------------------------------------------------
  // Contact clipping (Sutherland-Hodgman)
  // ---------------------------------------------------------------------------

  // Reference body: owns the edge most aligned with the collision normal
  // Incident body: owns the edge most anti-aligned
  const refVerts = referenceIsA ? vertsA : vertsB;
  const refNormals = referenceIsA ? normalsA : normalsB;
  const incVerts = referenceIsA ? vertsB : vertsA;
  const incNormals = referenceIsA ? normalsB : normalsA;

  // The reference normal is the MTV axis, but we need it pointing outward from the reference body
  const refNormal = referenceIsA ? mtvAxis.clone() : mtvAxis.clone().negate();

  // Find reference edge (most aligned with refNormal)
  const refEdgeIdx = findBestEdge(refNormals, refNormal);
  const refV1 = refVerts[refEdgeIdx];
  const refV2 = refVerts[(refEdgeIdx + 1) % refVerts.length];

  // Find incident edge (most anti-aligned with refNormal)
  const incEdgeIdx = findIncidentEdge(incNormals, refNormal);
  const incV1 = incVerts[incEdgeIdx];
  const incV2 = incVerts[(incEdgeIdx + 1) % incVerts.length];

  // Reference edge direction (tangent)
  const refEdge = Vec2.sub(refV2, refV1);
  const refEdgeLen = refEdge.length();
  const refTangent = refEdge.clone().scale(1 / refEdgeLen);

  // Clip incident edge against the two side planes of the reference edge
  // Side plane 1: keep points past refV1 along tangent direction
  //   tangent.dot(point) >= tangent.dot(refV1)
  // Side plane 2: keep points before refV2 along tangent direction
  //   (-tangent).dot(point) >= (-tangent).dot(refV2)
  const sidePlane1Normal = refTangent.clone();
  const sidePlane1Offset = sidePlane1Normal.dot(refV1);
  const sidePlane2Normal = refTangent.clone().negate();
  const sidePlane2Offset = sidePlane2Normal.dot(refV2);

  let clipped: Vec2[] = [incV1.clone(), incV2.clone()];

  clipped = clipByPlane(clipped, sidePlane1Normal, sidePlane1Offset);
  if (clipped.length < 1) {
    return null;
  }

  clipped = clipByPlane(clipped, sidePlane2Normal, sidePlane2Offset);
  if (clipped.length < 1) {
    return null;
  }

  // Deduplicate clipped points — Sutherland-Hodgman can produce duplicates
  // when the input is a 2-vertex "polygon" (line segment treated as a loop).
  const EPS_SQ = 1e-8;
  const unique: Vec2[] = [];
  for (const p of clipped) {
    let isDup = false;
    for (const u of unique) {
      const dx = p.x - u.x;
      const dy = p.y - u.y;
      if (dx * dx + dy * dy < EPS_SQ) {
        isDup = true;
        break;
      }
    }
    if (!isDup) unique.push(p);
  }

  // Keep only points behind the reference face plane
  const refFaceOffset = refNormal.dot(refV1);
  const contacts: ContactPoint[] = [];

  for (let i = 0; i < unique.length; i++) {
    const depth = refNormal.dot(unique[i]) - refFaceOffset;
    // depth < 0 means behind the reference face (penetrating)
    // We negate because our convention is positive depth = overlap
    if (depth <= 0) {
      const incVertIdx = incEdgeIdx + (i % 2);
      contacts.push({
        point: unique[i],
        depth: -depth,
        id: (refEdgeIdx << 8) | (incVertIdx % incVerts.length),
        normalImpulse: 0,
        tangentImpulse: 0,
      });
    }
  }

  // Cap at 2 contacts per manifold (standard for 2D physics)
  if (contacts.length > 2) {
    contacts.sort((a, b) => b.depth - a.depth);
    contacts.length = 2;
  }

  if (contacts.length === 0) {
    return null;
  }

  const materials = mixMaterials(bodyA.shape, bodyB.shape);

  return {
    bodyA,
    bodyB,
    normal: mtvAxis,
    contacts,
    friction: materials.friction,
    restitution: materials.restitution,
    isSensor: bodyA.isSensor || bodyB.isSensor,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function computeCenter(vertices: Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const v of vertices) {
    x += v.x;
    y += v.y;
  }
  const n = vertices.length;
  return new Vec2(x / n, y / n);
}
