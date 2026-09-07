import { toTourPlaceSummary, unwrapTourItems } from './tour.mapper';
import type { TourListItem } from './tour.types';

const museum: TourListItem = {
  contentid: '100',
  contenttypeid: '14',
  title: '국립중앙박물관',
  addr1: '서울 용산구',
  mapx: '126.980',
  mapy: '37.524',
  cat2: 'A0206',
  cat3: 'A02060100',
  firstimage: 'https://example.com/m.jpg',
  overview: '개요',
};

const memorial: TourListItem = {
  contentid: '101',
  contenttypeid: '14',
  title: '독립기념관',
  addr1: '충남 천안시',
  mapx: '127.2',
  mapy: '36.8',
  cat3: 'A02060200',
};

const exhibition: TourListItem = {
  contentid: '102',
  contenttypeid: '14',
  title: '백제역사문화관',
  addr1: '충남 부여군',
  mapx: '126.9',
  mapy: '36.3',
  cat3: 'A02060300',
};

const art: TourListItem = {
  contentid: '200',
  contenttypeid: '14',
  title: '현대미술관',
  addr1: '서울',
  mapx: '127.0',
  mapy: '37.5',
  cat3: 'A02060500',
};

const palace: TourListItem = {
  contentid: '300',
  contenttypeid: '12',
  title: '경복궁',
  addr1: '서울 종로구',
  mapx: '126.977',
  mapy: '37.579',
  cat2: 'A0201',
  cat3: 'A02010100',
};

const cinema: TourListItem = {
  contentid: '400',
  contenttypeid: '14',
  title: 'CGV',
  mapx: '127.0',
  mapy: '37.5',
  cat3: 'A02061200',
};

describe('toTourPlaceSummary', () => {
  it('maps a museum to PlaceSummary', () => {
    const place = toTourPlaceSummary(museum);
    expect(place).toMatchObject({
      source: 'tour',
      id: '100',
      globalId: 'tour:100',
      kind: 'museum',
      name: '국립중앙박물관',
      lat: 37.524,
      lng: 126.98,
      category: '박물관',
    });
  });

  it('keeps memorial and exhibition halls as museum', () => {
    expect(toTourPlaceSummary(memorial)?.kind).toBe('museum');
    expect(toTourPlaceSummary(exhibition)?.kind).toBe('museum');
    expect(toTourPlaceSummary(exhibition)?.category).toBe('전시관');
  });

  it('maps historic tourist sites as site', () => {
    const place = toTourPlaceSummary(palace);
    expect(place?.kind).toBe('site');
    expect(place?.category).toBe('역사관광지');
  });

  it('drops art galleries and other culture types', () => {
    expect(toTourPlaceSummary(art)).toBeNull();
    expect(toTourPlaceSummary(cinema)).toBeNull();
  });

  it('drops rows without coordinates', () => {
    expect(toTourPlaceSummary({ ...museum, mapx: '', mapy: '' })).toBeNull();
  });
});

describe('unwrapTourItems', () => {
  it('normalizes a single item object', () => {
    expect(unwrapTourItems({ item: museum })).toHaveLength(1);
  });

  it('returns empty when Tour sends an empty string body', () => {
    expect(unwrapTourItems('')).toEqual([]);
  });
});
