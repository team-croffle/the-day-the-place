import { coverageCells, placeInBbox } from './tour.client';

describe('coverageCells', () => {
  it('uses one center when the view fits in 20km', () => {
    const cells = coverageCells({
      swLat: 37.55,
      swLng: 126.96,
      neLat: 37.58,
      neLng: 127.0,
    });
    expect(cells).toHaveLength(1);
    expect(cells[0]?.radius).toBeLessThanOrEqual(20_000);
  });

  it('covers a wide view with several 20km centers', () => {
    const cells = coverageCells({
      swLat: 37.4,
      swLng: 126.7,
      neLat: 37.7,
      neLng: 127.2,
    });
    expect(cells.length).toBeGreaterThan(1);
    expect(cells.length).toBeLessThanOrEqual(9);
    for (const cell of cells) {
      expect(cell.radius).toBe(20_000);
    }
  });
});

describe('placeInBbox', () => {
  const box = { swLat: 37.5, swLng: 126.9, neLat: 37.6, neLng: 127.1 };

  it('keeps a place inside the view', () => {
    expect(placeInBbox({ lat: 37.55, lng: 127.0 }, box)).toBe(true);
  });

  it('drops a place outside the view', () => {
    expect(placeInBbox({ lat: 35.0, lng: 129.0 }, box)).toBe(false);
  });
});
