import { type Body } from '../dynamics/Body.js';
import { type Manifold } from '../collision/Manifold.js';
import { type Constraint } from '../constraints/Constraint.js';

/**
 * Static utility class for drawing debug overlays onto a Canvas 2D context.
 *
 * Draws AABBs (green), contact points (red), contact normals (blue),
 * and constraint connections (yellow) for physics debugging.
 */
export class DebugRenderer {
  /**
   * Draw axis-aligned bounding boxes around every body.
   * Green rectangles showing broadphase AABB bounds.
   */
  static drawAABBs(
    ctx: CanvasRenderingContext2D,
    bodies: readonly Body[],
    scale: number,
  ): void {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1 / scale;

    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const aabb = body.shape.computeAABB(body.position, body.angle);
      ctx.strokeRect(
        aabb.min.x,
        aabb.min.y,
        aabb.max.x - aabb.min.x,
        aabb.max.y - aabb.min.y,
      );
    }
  }

  /**
   * Draw contact points as red filled circles at collision locations.
   */
  static drawContacts(
    ctx: CanvasRenderingContext2D,
    manifolds: readonly Manifold[],
    scale: number,
  ): void {
    ctx.fillStyle = '#ff0000';
    const radius = 3 / scale;

    for (let i = 0; i < manifolds.length; i++) {
      const m = manifolds[i];
      for (let j = 0; j < m.contacts.length; j++) {
        const c = m.contacts[j];
        ctx.beginPath();
        ctx.arc(c.point.x, c.point.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Draw contact normals as blue lines extending from contact points.
   * Lines point in the manifold normal direction, length 0.5 meters.
   */
  static drawNormals(
    ctx: CanvasRenderingContext2D,
    manifolds: readonly Manifold[],
    scale: number,
  ): void {
    ctx.strokeStyle = '#0088ff';
    ctx.lineWidth = 1.5 / scale;

    for (let i = 0; i < manifolds.length; i++) {
      const m = manifolds[i];
      for (let j = 0; j < m.contacts.length; j++) {
        const c = m.contacts[j];
        ctx.beginPath();
        ctx.moveTo(c.point.x, c.point.y);
        ctx.lineTo(c.point.x + m.normal.x * 0.5, c.point.y + m.normal.y * 0.5);
        ctx.stroke();
      }
    }
  }

  /**
   * Draw constraint connections as yellow lines between anchor points.
   * Small filled circles mark each anchor.
   */
  static drawConstraints(
    ctx: CanvasRenderingContext2D,
    constraints: readonly Constraint[],
    scale: number,
  ): void {
    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth = 1.5 / scale;
    ctx.fillStyle = '#ffdd00';
    const anchorRadius = 2 / scale;

    for (let i = 0; i < constraints.length; i++) {
      const constraint = constraints[i];
      const anchorA = constraint.getWorldAnchorA();
      const anchorB = constraint.getWorldAnchorB();

      // Line between anchors
      ctx.beginPath();
      ctx.moveTo(anchorA.x, anchorA.y);
      ctx.lineTo(anchorB.x, anchorB.y);
      ctx.stroke();

      // Anchor point circles
      ctx.beginPath();
      ctx.arc(anchorA.x, anchorA.y, anchorRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(anchorB.x, anchorB.y, anchorRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
