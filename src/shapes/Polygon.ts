import { Vec2 } from '../math/Vec2.js';
import { Mat2 } from '../math/Mat2.js';
import { AABB } from '../math/AABB.js';
import {
  ShapeType,
  DEFAULT_DENSITY,
  DEFAULT_FRICTION,
  DEFAULT_RESTITUTION,
  type Material,
  type MassData,
  type Shape,
} from './Shape.js';

export interface PolygonOptions {
  offset?: Vec2;
  density?: number;
  friction?: number;
  restitution?: number;
}

/**
 * Convex polygon shape defined by CCW-wound vertices in local space.
 *
 * Mass/inertia computed via Box2D-style triangle-fan decomposition.
 * Edge normals are precomputed for SAT collision detection.
 */
export class Polygon implements Shape {
  readonly type = ShapeType.Polygon;
  readonly vertices: readonly Vec2[];
  readonly normals: readonly Vec2[];
  material: Material;
  offset: Vec2;

  private constructor(
    vertices: Vec2[],
    normals: Vec2[],
    options?: PolygonOptions,
  ) {
    this.vertices = vertices;
    this.normals = normals;
    this.offset = options?.offset?.clone() ?? Vec2.zero();
    this.material = {
      density: options?.density ?? DEFAULT_DENSITY,
      friction: options?.friction ?? DEFAULT_FRICTION,
      restitution: options?.restitution ?? DEFAULT_RESTITUTION,
    };
  }

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  /**
   * Create a polygon from an array of vertices.
   *
   * Vertices are cloned. Winding is enforced to CCW (reversed if CW).
   * Throws if the polygon is not convex.
   */
  static fromVertices(vertices: Vec2[], options?: PolygonOptions): Polygon {
    if (vertices.length < 3) {
      throw new Error(
        `Polygon requires at least 3 vertices, got ${vertices.length}`,
      );
    }

    // Clone vertices
    let verts = vertices.map((v) => v.clone());

    // Compute signed area to determine winding
    const signedArea = computeSignedArea(verts);
    if (Math.abs(signedArea) < 1e-10) {
      throw new Error(
        'Polygon vertices are degenerate (zero area). Ensure vertices form a non-degenerate polygon.',
      );
    }

    // Enforce CCW winding: positive signed area = CCW
    if (signedArea < 0) {
      verts.reverse();
    }

    // Validate convexity
    if (!isConvex(verts)) {
      throw new Error(
        'Polygon vertices are not convex. Ensure vertices form a convex shape.',
      );
    }

    const normals = computeNormals(verts);
    return new Polygon(verts, normals, options);
  }

  /**
   * Create a box (rectangle) centered at the local origin.
   *
   * Vertices in CCW order: bottom-left, bottom-right, top-right, top-left.
   */
  static box(width: number, height: number, options?: PolygonOptions): Polygon {
    const hw = width / 2;
    const hh = height / 2;
    const verts = [
      new Vec2(-hw, -hh),
      new Vec2(hw, -hh),
      new Vec2(hw, hh),
      new Vec2(-hw, hh),
    ];
    const normals = computeNormals(verts);
    return new Polygon(verts, normals, options);
  }

  /**
   * Create a regular polygon inscribed in a circle of the given radius.
   */
  static regular(
    sides: number,
    radius: number,
    options?: PolygonOptions,
  ): Polygon {
    if (sides < 3) {
      throw new Error(`Regular polygon requires at least 3 sides, got ${sides}`);
    }
    const verts: Vec2[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
      verts.push(new Vec2(radius * Math.cos(angle), radius * Math.sin(angle)));
    }
    // Vertices are already CCW for the standard angular sweep
    const normals = computeNormals(verts);
    return new Polygon(verts, normals, options);
  }

  // ---------------------------------------------------------------------------
  // Mass computation — Box2D triangle-fan algorithm
  // ---------------------------------------------------------------------------

  computeMassData(density: number): MassData {
    const verts = this.vertices;
    const n = verts.length;
    const inv3 = 1 / 3;

    let area = 0;
    let centerX = 0;
    let centerY = 0;
    let I = 0;

    // Use first vertex as reference for numerical stability
    const s = verts[0];

    for (let i = 0; i < n; i++) {
      const e1x = verts[i].x - s.x;
      const e1y = verts[i].y - s.y;
      const e2x = verts[(i + 1) % n].x - s.x;
      const e2y = verts[(i + 1) % n].y - s.y;

      const D = e1x * e2y - e1y * e2x; // cross product
      const triArea = 0.5 * D;
      area += triArea;

      // Centroid contribution
      centerX += triArea * inv3 * (e1x + e2x);
      centerY += triArea * inv3 * (e1y + e2y);

      // Inertia contribution
      const intx2 = e1x * e1x + e2x * e1x + e2x * e2x;
      const inty2 = e1y * e1y + e2y * e1y + e2y * e2y;
      I += 0.25 * inv3 * D * (intx2 + inty2);
    }

    const mass = density * area;

    // Centroid in world local-space (add back reference point)
    centerX = centerX / area + s.x;
    centerY = centerY / area + s.y;
    const centroid = new Vec2(centerX, centerY);

    // Shift inertia from reference to centroid
    let inertia = density * I;
    // I was computed about reference (s). Shift to origin first, then to centroid.
    // I_origin = I_ref + area * |s|^2 (but our formula already uses s as ref).
    // Actually, the formula computes I about the reference point s.
    // To get I about centroid: I_centroid = I_ref - mass * |centroid - s|^2
    // But we need I about origin eventually... Let's follow Box2D exactly:
    // I (as computed) is about origin (0,0) in the shifted coordinate system,
    // which maps to point s in the original coordinates.
    // I_about_s = density * I_accumulated
    // I_about_centroid = I_about_s - mass * |centroid - s|^2
    const dx = centroid.x - s.x;
    const dy = centroid.y - s.y;
    inertia -= mass * (dx * dx + dy * dy);

    // Apply parallel axis theorem for shape offset from body center
    inertia += mass * this.offset.lengthSquared();

    // Shift centroid by shape offset
    const finalCentroid = Vec2.add(centroid, this.offset);

    return { mass, inertia, centroid: finalCentroid };
  }

  // ---------------------------------------------------------------------------
  // AABB
  // ---------------------------------------------------------------------------

  computeAABB(position: Vec2, angle: number): AABB {
    // Inline rotation to avoid Mat2 + per-vertex Vec2 allocations
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ox = this.offset.x;
    const oy = this.offset.y;
    const px = position.x;
    const py = position.y;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const verts = this.vertices;
    for (let i = 0; i < verts.length; i++) {
      const lx = verts[i].x + ox;
      const ly = verts[i].y + oy;
      const wx = px + (cos * lx - sin * ly);
      const wy = py + (sin * lx + cos * ly);
      if (wx < minX) minX = wx;
      if (wy < minY) minY = wy;
      if (wx > maxX) maxX = wx;
      if (wy > maxY) maxY = wy;
    }

    return new AABB(new Vec2(minX, minY), new Vec2(maxX, maxY));
  }

  // ---------------------------------------------------------------------------
  // Support function (for GJK/SAT)
  // ---------------------------------------------------------------------------

  /**
   * Return the vertex with the maximum dot product against the given direction.
   * Direction is in local space.
   */
  support(direction: Vec2): Vec2 {
    let bestDot = -Infinity;
    let bestVertex = this.vertices[0];

    for (const v of this.vertices) {
      const d = v.dot(direction);
      if (d > bestDot) {
        bestDot = d;
        bestVertex = v;
      }
    }

    return bestVertex;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute the signed area of a simple polygon (positive = CCW).
 * Uses the shoelace formula.
 */
function computeSignedArea(vertices: Vec2[]): number {
  const n = vertices.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return area * 0.5;
}

/**
 * Validate that all vertices form a convex polygon (assumes CCW winding).
 * All cross products of consecutive edge pairs must be positive.
 */
function isConvex(vertices: Vec2[]): boolean {
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const c = vertices[(i + 2) % n];

    const cross =
      (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

    // For CCW winding, all cross products must be >= 0
    // We use a small negative tolerance to allow collinear edges
    if (cross < -1e-10) {
      return false;
    }
  }
  return true;
}

/**
 * Compute outward-facing edge normals for a CCW-wound polygon.
 * For edge from v[i] to v[i+1], the outward normal is the right-hand
 * perpendicular of the edge direction, normalized.
 */
function computeNormals(vertices: Vec2[]): Vec2[] {
  const n = vertices.length;
  const normals: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const edge = Vec2.sub(vertices[(i + 1) % n], vertices[i]);
    // Right-hand perpendicular: (y, -x) gives outward normal for CCW winding
    const normal = new Vec2(edge.y, -edge.x).normalize();
    normals.push(normal);
  }
  return normals;
}
