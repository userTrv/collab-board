/** Pure geometry for the whiteboard canvas. screen = world × zoom + offset. */
export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2.5;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function toWorld(v: Viewport, p: Point): Point {
  return { x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom };
}

export function toScreen(v: Viewport, p: Point): Point {
  return { x: p.x * v.zoom + v.x, y: p.y * v.zoom + v.y };
}

/** Zooms keeping the world point under `anchor` (screen coords) fixed. */
export function zoomAt(v: Viewport, anchor: Point, nextZoom: number): Viewport {
  const zoom = clampZoom(nextZoom);
  const world = toWorld(v, anchor);
  return { zoom, x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom };
}

export function boundsOf(rects: readonly Rect[]): Rect | null {
  if (!rects.length) return null;
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Viewport that shows `content` centred inside a `width`×`height` screen, never zooming past 1. */
export function fitTo(content: Rect | null, width: number, height: number, padding = 48): Viewport {
  if (!content || width <= 0 || height <= 0) return { x: padding, y: padding, zoom: 1 };
  const zoom = clampZoom(Math.min(1, (width - padding * 2) / content.w, (height - padding * 2) / content.h));
  return { zoom, x: (width - content.w * zoom) / 2 - content.x * zoom, y: (height - content.h * zoom) / 2 - content.y * zoom };
}

export function normalizeRect(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Where the segment from the centre of `r` towards `target` leaves the rectangle. */
export function edgePoint(r: Rect, target: Point): Point {
  const c = center(r);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const scale = Math.min(dx !== 0 ? r.w / 2 / Math.abs(dx) : Infinity, dy !== 0 ? r.h / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}
