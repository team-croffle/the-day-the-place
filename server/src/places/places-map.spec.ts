import { TourAdapterError } from './adapters/tour.client';
import { fetchMapPlaces, HERITAGE_MAP_SKIPPED } from './places-map';

const bbox = { swLat: 37.5, swLng: 126.9, neLat: 37.6, neLng: 127.1 };

const museum = {
  source: 'tour' as const,
  id: '1',
  globalId: 'tour:1',
  kind: 'museum' as const,
  name: '국립중앙박물관',
  lat: 37.52,
  lng: 126.98,
  address: '서울',
  category: '박물관',
  summary: '',
};

describe('fetchMapPlaces', () => {
  it('fills tour and leaves heritage unrequested', async () => {
    const result = await fetchMapPlaces(bbox, async () => [museum]);

    expect(result.tour).toEqual({ ok: true, items: [museum] });
    expect(result.heritage).toEqual(HERITAGE_MAP_SKIPPED);
    expect(result.heritage.items).toBeNull();
  });

  it('does not collapse a Tour failure into an empty list', async () => {
    const result = await fetchMapPlaces(bbox, async () => {
      throw new TourAdapterError('TourAPI 30: SERVICE KEY IS NOT REGISTERED');
    });

    expect(result.tour).toEqual({
      ok: false,
      error: 'TourAPI 30: SERVICE KEY IS NOT REGISTERED',
      items: null,
    });
    expect(result.heritage).toEqual(HERITAGE_MAP_SKIPPED);
  });
});
