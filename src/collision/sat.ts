import { Vec2 } from '../math/Vec2.js';
import { Body } from '../dynamics/Body.js';
import { Polygon } from '../shapes/Polygon.js';
import { type Manifold, type ContactPoint, mixMaterials } from './Manifold.js';

// ---------------------------------------------------------------------------
// Scratch buffers for world-space vertex/normal transforms.
// Avoids allocating arrays and Vec2s every collision pair.
// ---------------------------------------------------------------------------

/** Max vertices per polygon (generous upper bound). */
const MAX_VERTS = 32;

// Pre-allocated scratch arrays for transformed vertices/normals
const _vertsA: Vec2[] = new Array(MAX_VERTS);
const _vertsB: Vec2[] = new Array(MAX_VERTS);
const _normalsA: Vec2[] = new Array(MAX_VERTS);
const _normalsB: Vec2[] = new Array(MAX_VERTS);

// Initialize scratch Vec2 objects once
for (let i = 0; i < MAX_VERTS; i++) {
  _vertsA[i] = new Vec2();
  _vertsB[i] = new Vec2();
  _normalsA[i] = new Vec2();
  _normalsB[i] = new Vec2();
}

// Scratch for clip output (max 4 points from Sutherland-Hodgman on a 2-vertex input)
const _clipBuf1: Vec2[] = [new Vec2(), new Vec2(), new Vec2(), new Vec2()];
const _clipBuf2: Vec2[] = [new Vec2(), new Vec2(), new Vec2(), new Vec2()];

// ---------------------------------------------------------------------------
// Helpers (allocation-free on hot path)
// ---------------------------------------------------------------------------

/**
 * Transform polygon vertices to world space using inline rotation.
 * Writes results into the provided scratch array, returns the count.
 */
function transformVertices(
  body: Body,
  polygon: Polygon,
  out: Vec2[],
): number {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const ox = polygon.offset.x;
  const oy = polygon.offset.y;
  const px = body.position.x;
  const py = body.position.y;
  const verts = polygon.vertices;
  const n = verts.length;

  for (let i = 0; i < n; i++) {
    const lx = verts[i].x + ox;
    const ly = verts[i].y + oy;
    out[i].x = px + (cos * lx - sin * ly);
    out[i].y = py + (sin * lx + cos * ly);
  }

  return n;
}

/**
 * Rotate polygon normals to world space using inline rotation.
 * Writes results into the provided scratch array.
 */
function transformNormals(
  body: Body,
  polygon: Polygon,
  out: Vec2[],
): void {
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);
  const normals = polygon.normals;
  const n = normals.length;

  for (let i = 0; i < n; i++) {
    out[i].x = cos * normals[i].x - sin * normals[i].y;
    out[i].y = sin * normals[i].x + cos * normals[i].y;
  }
}

/**
 * Project vertices onto an axis, returning [min, max] via out parameters.
 */
function projectOnAxis(
  vertices: Vec2[],
  count: number,
  axisX: number,
  axisY: number,
): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const d = vertices[i].x * axisX + vertices[i].y * axisY;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/**
 * Find the edge on the polygon most aligned with the given normal.
 */
function findBestEdge(normals: Vec2[], count: number, nx: number, ny: number): number {
  let bestDot = -Infinity;
  let bestIdx = 0;
  for (let i = 0; i < count; i++) {
    const d = normals[i].x * nx + normals[i].y * ny;
    if (d > bestDot) {
      bestDot = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Find the edge most anti-aligned with the given normal.
 */
function findIncidentEdge(normals: Vec2[], count: number, nx: number, ny: number): number {
  let bestDot = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < count; i++) {
    const d = normals[i].x * nx + normals[i].y * ny;
    if (d < bestDot) {
      bestDot = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Clip a set of points against a half-plane: planeNormal.dot(point) >= offset.
 * Writes to outBuf, returns number of output points.
 * Operates on scratch buffers to avoid allocation.
 */
function clipByPlane(
  points: Vec2[],
  pointCount: number,
  pnx: number,
  pny: number,
  offset: number,
  outBuf: Vec2[],
): number {
  let outCount = 0;

  for (let i = 0; i < pointCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % pointCount];
    const da = a.x * pnx + a.y * pny - offset;
    const db = b.x * pnx + b.y * pny - offset;

    if (da >= 0) {
      outBuf[outCount].x = a.x;
      outBuf[outCount].y = a.y;
      outCount++;
    }

    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      outBuf[outCount].x = a.x + t * (b.x - a.x);
      outBuf[outCount].y = a.y + t * (b.y - a.y);
      outCount++;
    }
  }

  return outCount;
}

// ---------------------------------------------------------------------------
// SAT Polygon vs Polygon
// ---------------------------------------------------------------------------

/**
 * SAT polygon-polygon collision detection with Sutherland-Hodgman clipping
 * for contact point generation.
 *
 * Normal points from bodyA toward bodyB.
 *
 * Hot-path optimized: uses pre-allocated scratch buffers for vertex/normal
 * transforms and clip operations. No transient Vec2/array allocations in
 * the inner loop.
 */
export function polygonVsPolygon(
  bodyA: Body,
  bodyB: Body,
): Manifold | null {
  const polyA = bodyA.shape as Polygon;
  const polyB = bodyB.shape as Polygon;

  const nA = transformVertices(bodyA, polyA, _vertsA);
  const nB = transformVertices(bodyB, polyB, _vertsB);
  transformNormals(bodyA, polyA, _normalsA);
  transformNormals(bodyB, polyB, _normalsB);

  // Track minimum overlap (MTV)
  let minOverlap = Infinity;
  let mtvX = 1;
  let mtvY = 0;
  let referenceIsA = true;

  // Test all axes from polygon A
  for (let i = 0; i < nA; i++) {
    const axisX = _normalsA[i].x;
    const axisY = _normalsA[i].y;
    const [minA, maxA] = projectOnAxis(_vertsA, nA, axisX, axisY);
    const [minB, maxB] = projectOnAxis(_vertsB, nB, axisX, axisY);

    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) return null;

    if (overlap < minOverlap) {
      minOverlap = overlap;
      mtvX = axisX;
      mtvY = axisY;
      referenceIsA = true;
    }
  }

  // Test all axes from polygon B
  for (let i = 0; i < nB; i++) {
    const axisX = _normalsB[i].x;
    const axisY = _normalsB[i].y;
    const [minA, maxA] = projectOnAxis(_vertsA, nA, axisX, axisY);
    const [minB, maxB] = projectOnAxis(_vertsB, nB, axisX, axisY);

    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) return null;

    if (overlap < minOverlap) {
      minOverlap = overlap;
      mtvX = axisX;
      mtvY = axisY;
      referenceIsA = false;
    }
  }

  // Ensure normal points from A toward B
  let cenAx = 0, cenAy = 0;
  for (let i = 0; i < nA; i++) { cenAx += _vertsA[i].x; cenAy += _vertsA[i].y; }
  cenAx /= nA; cenAy /= nA;

  let cenBx = 0, cenBy = 0;
  for (let i = 0; i < nB; i++) { cenBx += _vertsB[i].x; cenBy += _vertsB[i].y; }
  cenBx /= nB; cenBy /= nB;

  const ddx = cenBx - cenAx;
  const ddy = cenBy - cenAy;
  if (ddx * mtvX + ddy * mtvY < 0) {
    mtvX = -mtvX;
    mtvY = -mtvY;
    referenceIsA = !referenceIsA;
  }

  // ---------------------------------------------------------------------------
  // Contact clipping (Sutherland-Hodgman)
  // ---------------------------------------------------------------------------

  const refVerts = referenceIsA ? _vertsA : _vertsB;
  const refNormals = referenceIsA ? _normalsA : _normalsB;
  const refCount = referenceIsA ? nA : nB;
  const incVerts = referenceIsA ? _vertsB : _vertsA;
  const incNormals = referenceIsA ? _normalsB : _normalsA;
  const incCount = referenceIsA ? nB : nA;

  // Reference normal points outward from reference body
  const refNx = referenceIsA ? mtvX : -mtvX;
  const refNy = referenceIsA ? mtvY : -mtvY;

  const refEdgeIdx = findBestEdge(refNormals, refCount, refNx, refNy);
  const refV1 = refVerts[refEdgeIdx];
  const refV2 = refVerts[(refEdgeIdx + 1) % refCount];

  const incEdgeIdx = findIncidentEdge(incNormals, incCount, refNx, refNy);
  const incV1 = incVerts[incEdgeIdx];
  const incV2 = incVerts[(incEdgeIdx + 1) % incCount];

  // Reference edge tangent
  const refEdgeX = refV2.x - refV1.x;
  const refEdgeY = refV2.y - refV1.y;
  const refEdgeLen = Math.sqrt(refEdgeX * refEdgeX + refEdgeY * refEdgeY);
  const invLen = refEdgeLen > 1e-10 ? 1 / refEdgeLen : 0;
  const tangentX = refEdgeX * invLen;
  const tangentY = refEdgeY * invLen;

  // Set up incident edge in clip buffer 1
  _clipBuf1[0].x = incV1.x;
  _clipBuf1[0].y = incV1.y;
  _clipBuf1[1].x = incV2.x;
  _clipBuf1[1].y = incV2.y;

  // Clip against side plane 1: tangent.dot(point) >= tangent.dot(refV1)
  const side1Offset = tangentX * refV1.x + tangentY * refV1.y;
  let clipCount = clipByPlane(_clipBuf1, 2, tangentX, tangentY, side1Offset, _clipBuf2);
  if (clipCount < 1) return null;

  // Clip against side plane 2: (-tangent).dot(point) >= (-tangent).dot(refV2)
  const side2Offset = -(tangentX * refV2.x + tangentY * refV2.y);
  clipCount = clipByPlane(_clipBuf2, clipCount, -tangentX, -tangentY, side2Offset, _clipBuf1);
  if (clipCount < 1) return null;

  // Deduplicate clipped points
  const EPS_SQ = 1e-8;
  let uniqueCount = 0;
  for (let i = 0; i < clipCount; i++) {
    let isDup = false;
    for (let j = 0; j < uniqueCount; j++) {
      const dx = _clipBuf1[i].x - _clipBuf2[j].x;
      const dy = _clipBuf1[i].y - _clipBuf2[j].y;
      if (dx * dx + dy * dy < EPS_SQ) {
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      _clipBuf2[uniqueCount].x = _clipBuf1[i].x;
      _clipBuf2[uniqueCount].y = _clipBuf1[i].y;
      uniqueCount++;
    }
  }

  // Keep only points behind the reference face plane
  const refFaceOffset = refNx * refV1.x + refNy * refV1.y;
  const contacts: ContactPoint[] = [];

  for (let i = 0; i < uniqueCount; i++) {
    const px = _clipBuf2[i].x;
    const py = _clipBuf2[i].y;
    const depth = refNx * px + refNy * py - refFaceOffset;
    if (depth <= 0) {
      const incVertIdx = incEdgeIdx + (i % 2);
      contacts.push({
        // Allocate final contact point Vec2 (these persist into manifold)
        point: new Vec2(px, py),
        depth: -depth,
        id: (refEdgeIdx << 8) | (incVertIdx % incCount),
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

  if (contacts.length === 0) return null;

  const materials = mixMaterials(bodyA.shape, bodyB.shape);

  return {
    bodyA,
    bodyB,
    normal: new Vec2(mtvX, mtvY),
    contacts,
    friction: materials.friction,
    restitution: materials.restitution,
    isSensor: bodyA.isSensor || bodyB.isSensor,
  };
}
