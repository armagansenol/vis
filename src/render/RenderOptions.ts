/**
 * Configuration options for the Renderer.
 */
export interface RenderOptions {
  /** Canvas width in CSS pixels. Default: canvas.clientWidth or 800. */
  width?: number;
  /** Canvas height in CSS pixels. Default: canvas.clientHeight or 600. */
  height?: number;
  /** Pixels per meter. Default: 50. */
  scale?: number;
  /** Horizontal offset in pixels. Default: width / 2 (centering origin). */
  offsetX?: number;
  /** Vertical offset in pixels. Default: 50 (origin near bottom). */
  offsetY?: number;
  /** Background color. Default: '#1a1a2e'. */
  background?: string;
  /** Enable debug overlays (placeholder for Plan 02). Default: false. */
  debug?: boolean;
  /** Show rotation indicators on circles. Default: true. */
  showRotation?: boolean;
}

/** Default render options (applied when not overridden). */
export const DEFAULT_RENDER_OPTIONS: Required<RenderOptions> = {
  width: 800,
  height: 600,
  scale: 50,
  offsetX: 400,
  offsetY: 50,
  background: '#1a1a2e',
  debug: false,
  showRotation: true,
};

/** Visually distinct semi-transparent colors for dynamic body palette cycling. */
export const BODY_PALETTE: readonly string[] = [
  'rgba(69,179,224,0.7)',
  'rgba(239,83,80,0.7)',
  'rgba(102,187,106,0.7)',
  'rgba(255,167,38,0.7)',
  'rgba(171,71,188,0.7)',
  'rgba(255,241,118,0.7)',
  'rgba(77,208,225,0.7)',
  'rgba(255,112,67,0.7)',
];

/** Fill color for static bodies. */
export const STATIC_BODY_COLOR = 'rgba(120,120,130,0.6)';
/** Stroke color for static bodies. */
export const STATIC_BODY_STROKE = '#555';
