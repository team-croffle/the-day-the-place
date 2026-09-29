import type { PlaceSummary } from '@nest-vue/shared';

import { TourAdapterError } from './adapters/tour.client';
import { filterTourPlaces, searchTourPlaces } from './places-search';

const museum = (id: string, name: string, address: string): PlaceSummary => ({
  source: 'tour',
  id,
  globalId: `tour:${id}`,
  kind: 'museum',
  name,
  lat: 37.5,
  lng: 127,
  address,
  category: '박물관',
  summary: '',
});

const site = (id: string, name: string): PlaceSummary => ({
  source: 'tour',
  id,
  globalId: `tour:${id}`,
  kind: 'site',
  name,
  lat: 37.5,
  lng: 127,
  address: '서울 종로구',
  category: '역사관광지',
  summary: '',
});

const catalog = [
  museum('1', '국립중앙박물관', '서울특별시 용산구'),
  museum('2', '국립중앙박물관 분관', '서울특별시 용산구'),
  museum('3', '경주박물관', '경상북도 경주시'),
  site('4', '경복궁'),
];

describe('filterTourPlaces', () => {
  it('keeps only the requested kind and does not collapse same names', () => {
    const museums = filterTourPlaces(catalog, { kind: 'museum' });
    expect(museums.map((place) => place.id)).toEqual(['1', '2', '3']);
    expect(filterTourPlaces(catalog, { kind: 'site' }).map((place) => place.name)).toEqual([
      '경복궁',
    ]);
  });

  it('filters by address alias and keyword', () => {
    const result = filterTourPlaces(catalog, { kind: 'museum', region: '37', q: '경주' });
    expect(result.map((place) => place.id)).toEqual(['3']);
  });
});

describe('searchTourPlaces', () => {
  it('does not collapse a Tour failure into an empty page', async () => {
    const result = await searchTourPlaces({ kind: 'museum' }, async () => {
      throw new TourAdapterError('TourAPI 30: SERVICE KEY IS NOT REGISTERED');
    });

    expect(result).toEqual({
      ok: false,
      error: 'TourAPI 30: SERVICE KEY IS NOT REGISTERED',
      items: null,
    });
  });
});
