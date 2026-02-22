import { type World } from '../engine/World.js';
import { BodyType } from '../dynamics/BodyType.js';
import { ShapeType } from '../shapes/Shape.js';
import { type Circle } from '../shapes/Circle.js';
import { type Polygon } from '../shapes/Polygon.js';
import { lerp } from '../math/utils.js';
import {
  type RenderOptions,
  DEFAULT_RENDER_OPTIONS,
  BODY_PALETTE,
  STATIC_BODY_COLOR,
  STATIC_BODY_STROKE,
} from './RenderOptions.js';

/**
 * Canvas 2D renderer for the physics simulation.
 *
 * Draws circles, boxes, and convex polygons at their interpolated physics
 * positions using a Y-up coordinate system. Owns a requestAnimationFrame loop
 * that calls world.step() each frame.
 */
export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly world: World;

  private readonly scale: number;
  private readonly offsetX: number;
  private readonly offsetY: number;
  private readonly background: string;
  private readonly showRotation: boolean;

  private running = false;
  private lastTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    world: World,
    options?: Partial<RenderOptions>,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.world = world;

    const width = options?.width ?? (canvas.clientWidth || DEFAULT_RENDER_OPTIONS.width);
    const height = options?.height ?? (canvas.clientHeight || DEFAULT_RENDER_OPTIONS.height);

    // Set canvas dimensions for crisp rendering
    canvas.width = width;
    canvas.height = height;

    this.scale = options?.scale ?? DEFAULT_RENDER_OPTIONS.scale;
    this.offsetX = options?.offsetX ?? width / 2;
    this.offsetY = options?.offsetY ?? DEFAULT_RENDER_OPTIONS.offsetY;
    this.background = options?.background ?? DEFAULT_RENDER_OPTIONS.background;
    this.showRotation = options?.showRotation ?? DEFAULT_RENDER_OPTIONS.showRotation;
  }

  /** Start the render loop (requestAnimationFrame). */
  start(): void {
    this.running = true;
    this.lastTime = 0;
    requestAnimationFrame(this.loop);
  }

  /** Stop the render loop. */
  stop(): void {
    this.running = false;
  }

  /**
   * Draw a single frame at the given interpolation alpha.
   * Public for manual render-only usage (no rAF).
   */
  draw(alpha: number): void {
    const { canvas, ctx } = this;

    // Clear canvas with background color (in screen space)
    ctx.resetTransform();
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set up Y-up coordinate transform:
    // scale on X, -scale on Y (flip), translate origin
    ctx.setTransform(
      this.scale, 0,
      0, -this.scale,
      this.offsetX, canvas.height - this.offsetY,
    );

    // 1px line width regardless of scale
    ctx.lineWidth = 1 / this.scale;

    const bodies = this.world.getBodies();
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];

      // Compute interpolated position and angle
      let renderX: number;
      let renderY: number;
      let renderAngle: number;

      if (body.type === BodyType.Static) {
        renderX = body.position.x;
        renderY = body.position.y;
        renderAngle = body.angle;
      } else {
        renderX = lerp(body.prevPosition.x, body.position.x, alpha);
        renderY = lerp(body.prevPosition.y, body.position.y, alpha);
        renderAngle = lerp(body.prevAngle, body.angle, alpha);
      }

      // Set fill/stroke colors
      if (body.type === BodyType.Static) {
        ctx.fillStyle = STATIC_BODY_COLOR;
        ctx.strokeStyle = STATIC_BODY_STROKE;
      } else {
        const color = BODY_PALETTE[body.id % BODY_PALETTE.length];
        ctx.fillStyle = color;
        ctx.strokeStyle = darkenColor(color);
      }

      // Dispatch on shape type
      if (body.shape.type === ShapeType.Circle) {
        this.drawCircle(ctx, body.shape as Circle, renderX, renderY, renderAngle);
      } else if (body.shape.type === ShapeType.Polygon) {
        this.drawPolygon(ctx, body.shape as Polygon, renderX, renderY, renderAngle);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private loop = (now: number): void => {
    if (!this.running) return;

    if (this.lastTime === 0) {
      this.lastTime = now;
      requestAnimationFrame(this.loop);
      return;
    }

    // Compute frame delta in seconds, clamp to max 0.1s
    let frameDt = (now - this.lastTime) / 1000;
    if (frameDt > 0.1) frameDt = 0.1;
    this.lastTime = now;

    const alpha = this.world.step(frameDt);
    this.draw(alpha);

    requestAnimationFrame(this.loop);
  };

  private drawCircle(
    ctx: CanvasRenderingContext2D,
    circle: Circle,
    x: number,
    y: number,
    angle: number,
  ): void {
    const ox = circle.offset.x;
    const oy = circle.offset.y;
    const r = circle.radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotation indicator line
    if (this.showRotation) {
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + r, oy);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawPolygon(
    ctx: CanvasRenderingContext2D,
    polygon: Polygon,
    x: number,
    y: number,
    angle: number,
  ): void {
    const verts = polygon.vertices;
    const ox = polygon.offset.x;
    const oy = polygon.offset.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(verts[0].x + ox, verts[0].y + oy);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x + ox, verts[i].y + oy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Produce a slightly darker version of an rgba color string for stroke.
 * Parses the rgba values and reduces brightness by ~30%.
 */
function darkenColor(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#333';
  const r = Math.round(Number(match[1]) * 0.7);
  const g = Math.round(Number(match[2]) * 0.7);
  const b = Math.round(Number(match[3]) * 0.7);
  return `rgb(${r},${g},${b})`;
}
