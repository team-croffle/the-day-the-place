import { intersectingAreaCodes } from './tour.areas';
import { coverageCells, listTourPlaces, placeInBbox } from './tour.client';

function emptyTourResponse(): Response {
  return new Response(
    JSON.stringify({
      response: {
        header: { resultCode: '0000', resultMsg: 'OK' },
        body: { items: { item: [] }, totalCount: 0 },
      },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

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

describe('intersectingAreaCodes', () => {
  it('includes Jeonbuk for a Gunsan-Jeonju view', () => {
    const codes = intersectingAreaCodes({
      swLat: 35.4,
      swLng: 126.4,
      neLat: 36.1,
      neLng: 127.3,
    });
    expect(codes).toContain('35');
  });
});

describe('listTourPlaces', () => {
  it('uses areaBasedList2 with cat2 when the view is wider than 20km', async () => {
    const urls: string[] = [];
    const items = await listTourPlaces(
      { swLat: 35.4, swLng: 126.4, neLat: 36.1, neLng: 127.3 },
      {
        apiKey: 'test-key',
        fetchImpl: async (input) => {
          urls.push(String(input));
          return emptyTourResponse();
        },
      },
    );
    expect(items).toEqual([]);
    expect(urls.some((url) => url.includes('areaBasedList2'))).toBe(true);
    expect(urls.every((url) => !url.includes('locationBasedList2'))).toBe(true);
    expect(urls.some((url) => url.includes('cat2=A0201'))).toBe(true);
    expect(urls.some((url) => url.includes('cat2=A0206'))).toBe(true);
  });

  it('stays on locationBasedList2 when the view fits in 20km', async () => {
    const urls: string[] = [];
    await listTourPlaces(
      { swLat: 37.55, swLng: 126.96, neLat: 37.58, neLng: 127.0 },
      {
        apiKey: 'test-key',
        fetchImpl: async (input) => {
          urls.push(String(input));
          return emptyTourResponse();
        },
      },
    );
    expect(urls.some((url) => url.includes('locationBasedList2'))).toBe(true);
    expect(urls.every((url) => !url.includes('areaBasedList2'))).toBe(true);
  });
});
