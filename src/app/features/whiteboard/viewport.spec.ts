import { boundsOf, edgePoint, fitTo, intersects, MAX_ZOOM, normalizeRect, toScreen, toWorld, zoomAt } from './viewport';

describe('whiteboard viewport geometry', () => {
  it('converts between screen and world coordinates', () => {
    const v = { x: 100, y: 50, zoom: 2 };
    expect(toWorld(v, { x: 300, y: 250 })).toEqual({ x: 100, y: 100 });
    expect(toScreen(v, { x: 100, y: 100 })).toEqual({ x: 300, y: 250 });
  });

  it('zooms around the anchor point and clamps the zoom', () => {
    const v = { x: 0, y: 0, zoom: 1 };
    const anchor = { x: 200, y: 100 };
    const z = zoomAt(v, anchor, 2);
    expect(toWorld(z, anchor)).toEqual(toWorld(v, anchor));
    expect(zoomAt(v, anchor, 99).zoom).toBe(MAX_ZOOM);
  });

  it('fits content into the screen without zooming in past 100%', () => {
    const content = boundsOf([
      { x: 0, y: 0, w: 200, h: 100 },
      { x: 1800, y: 900, w: 200, h: 100 },
    ])!;
    expect(content).toEqual({ x: 0, y: 0, w: 2000, h: 1000 });
    const v = fitTo(content, 1096, 596, 48);
    expect(v.zoom).toBeCloseTo(0.5);
    expect(toScreen(v, { x: 1000, y: 500 })).toEqual({ x: 548, y: 298 });
    expect(fitTo({ x: 0, y: 0, w: 10, h: 10 }, 1000, 1000).zoom).toBe(1);
  });

  it('computes marquee rectangles, hits and connector end points', () => {
    const r = normalizeRect({ x: 50, y: 80 }, { x: 10, y: 20 });
    expect(r).toEqual({ x: 10, y: 20, w: 40, h: 60 });
    expect(intersects(r, { x: 45, y: 70, w: 100, h: 100 })).toBe(true);
    expect(intersects(r, { x: 51, y: 0, w: 10, h: 10 })).toBe(false);
    expect(edgePoint({ x: 0, y: 0, w: 100, h: 50 }, { x: 500, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(edgePoint({ x: 0, y: 0, w: 100, h: 50 }, { x: 50, y: -500 })).toEqual({ x: 50, y: 0 });
  });
});
