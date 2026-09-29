import { toTourPlaceDetail, toTourPlaceSummary, unwrapTourItems } from './tour.mapper';
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

  it('keeps a museum that only has the new lcls codes', () => {
    const place = toTourPlaceSummary({
      contentid: '129703',
      contenttypeid: '14',
      title: '국립중앙박물관',
      addr1: '서울특별시 용산구 서빙고로 137',
      mapx: '126.979',
      mapy: '37.521',
      cat1: '',
      cat2: '',
      cat3: '',
      lclsSystm1: 'VE',
      lclsSystm2: 'VE07',
      lclsSystm3: 'VE070100',
    });
    expect(place).toMatchObject({
      kind: 'museum',
      name: '국립중앙박물관',
      category: '박물관',
    });
  });

  it('drops rows without coordinates', () => {
    expect(toTourPlaceSummary({ ...museum, mapx: '', mapy: '' })).toBeNull();
  });
});

describe('toTourPlaceDetail', () => {
  it('keeps overview and telephone on a map place', () => {
    const detail = toTourPlaceDetail({ ...museum, tel: '02-000-0000' });
    expect(detail).toMatchObject({
      id: '100',
      kind: 'museum',
      description: '개요',
      tel: '02-000-0000',
    });
  });

  it('drops a gallery the map would not show', () => {
    expect(toTourPlaceDetail(art)).toBeNull();
  });

  it('reads museum hours, closing day, and fee from culture fields', () => {
    const detail = toTourPlaceDetail(museum, {
      usetimeculture: ' 10:00-18:00 ',
      restdateculture: '월요일',
      usefee: '무료',
      usetime: '무시',
    });
    expect(detail?.hours).toBe('10:00-18:00\n휴무 월요일');
    expect(detail?.fee).toBe('무료');
  });

  it('turns Tour line-break tags into newlines', () => {
    const detail = toTourPlaceDetail(museum, { usetimeculture: '10:00<br>18:00' });
    expect(detail?.hours).toBe('10:00\n18:00');
  });

  it('puts the cover first and skips a repeated image url', () => {
    const detail = toTourPlaceDetail(museum, null, [
      { originimgurl: 'https://example.com/m.jpg' },
      { originimgurl: ' https://example.com/hall.jpg ' },
      { smallimageurl: 'https://example.com/small.jpg' },
      { originimgurl: '   ' },
    ]);
    expect(detail?.images).toEqual([
      'https://example.com/m.jpg',
      'https://example.com/hall.jpg',
      'https://example.com/small.jpg',
    ]);
    expect(detail?.image).toBe('https://example.com/m.jpg');
  });

  it('reads site hours without inventing a fee', () => {
    const detail = toTourPlaceDetail(palace, { usetime: '09:00-17:00', usefee: '   ' });
    expect(detail?.kind).toBe('site');
    expect(detail?.hours).toBe('09:00-17:00');
    expect(detail?.fee).toBeUndefined();
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
