import { exhibitionRegion, selectExhibitions, type Exhibition } from '@nest-vue/shared';

const TODAY = '2026-10-07';

function row(overrides: Partial<Exhibition> = {}): Exhibition {
  return {
    id: '1',
    title: '조선의 색',
    startsOn: '2026-10-01',
    endsOn: '2026-12-31',
    status: 'ongoing',
    placeSource: 'tour',
    placeId: '126508',
    placeName: '서울역사박물관',
    summary: '안료를 보여 준다.',
    imageUrl: null,
    sourceUrl: null,
    ...overrides,
  };
}

describe('selectExhibitions', () => {
  it('drops a show that has already ended', () => {
    const kept = selectExhibitions(
      [row(), row({ id: '2', endsOn: '2026-10-06', status: 'ongoing' })],
      {},
      TODAY,
    );
    expect(kept.map((item) => item.id)).toEqual(['1']);
  });

  it('uses the start date for upcoming and ongoing', () => {
    const started = row({ status: 'upcoming', startsOn: '2026-10-01' });
    const later = row({
      id: '2',
      title: '황룡사',
      status: 'ongoing',
      startsOn: '2026-11-01',
      placeName: '국립경주박물관',
    });

    expect(
      selectExhibitions([started], { status: 'ongoing' }, TODAY).map((item) => item.id),
    ).toEqual(['1']);
    expect(
      selectExhibitions([later], { status: 'upcoming' }, TODAY).map((item) => item.status),
    ).toEqual(['upcoming']);
  });

  it('filters by status, text, region, and place', () => {
    const rows = [
      row(),
      row({
        id: '2',
        title: '황룡사',
        status: 'upcoming',
        startsOn: '2026-11-01',
        placeName: '국립경주박물관',
        placeId: '129778',
        summary: '사리',
      }),
    ];

    expect(selectExhibitions(rows, { status: 'upcoming' }, TODAY).map((item) => item.id)).toEqual([
      '2',
    ]);
    expect(selectExhibitions(rows, { q: '사리' }, TODAY).map((item) => item.id)).toEqual(['2']);
    expect(selectExhibitions(rows, { region: '11' }, TODAY).map((item) => item.id)).toEqual(['1']);
    expect(
      selectExhibitions(rows, { placeSource: 'tour', placeId: '129778' }, TODAY).map(
        (item) => item.id,
      ),
    ).toEqual(['2']);
  });

  it('keeps one card when titles differ only by punctuation or a longer subtitle', () => {
    const rows = [
      row({
        id: 'late',
        title: '망친 것은 없었다–한익환의 작품이 건네는 위로',
        startsOn: '2026-10-01',
        endsOn: '2027-06-30',
        placeName: '원광대학교 박물관',
        summary: '짧다',
      }),
      row({
        id: 'open',
        title: '망친 것은 없었다?한익환의 작품이 건네는 위로',
        startsOn: '2024-05-01',
        endsOn: '2027-06-30',
        placeName: '원광대학교 박물관',
        summary: '한익환의 작품이 건네는 위로를 보여 준다.',
      }),
      row({
        id: 'plain',
        title: '황룡사, 부처의 사리를 모시다',
        endsOn: '2026-10-11',
        placeName: '국립경주박물관',
        placeId: '129778',
        summary: '사리',
      }),
      row({
        id: 'long',
        title: '황룡사, 부처의 사리를 모시다 - 皇龍奉佛',
        endsOn: '2026-10-11',
        placeName: '국립경주박물관',
        placeId: '129778',
        summary: '사리장엄을 보여 준다.',
      }),
    ];

    expect(selectExhibitions(rows, {}, TODAY).map((item) => item.id)).toEqual(['long', 'open']);
  });

  it('keeps one card when the same title has two end dates', () => {
    const kept = selectExhibitions(
      [
        row({ id: 'short', endsOn: '2026-12-31', summary: '짧다' }),
        row({ id: 'long', endsOn: '2027-03-01', summary: '더 긴 요약을 남긴다.' }),
      ],
      {},
      TODAY,
    );
    expect(kept.map((item) => item.id)).toEqual(['long']);
  });

  it('matches the host museum address when the name has no region', () => {
    const central = row({
      placeName: '국립중앙박물관',
      placeSource: null,
      placeId: null,
    });
    const region = exhibitionRegion(central, [
      {
        source: 'tour',
        id: '126207',
        name: '국립중앙박물관',
        address: '서울특별시 용산구 서빙고로 137',
      },
    ]);

    expect(region).toBe('11');
    expect(
      selectExhibitions([{ ...central, region }], { region: '11' }, TODAY).map((item) => item.id),
    ).toEqual(['1']);
    expect(selectExhibitions([{ ...central, region }], { region: '37' }, TODAY)).toEqual([]);
  });

  it('drops a venue that is not a museum, memorial, or exhibition hall', () => {
    const kept = selectExhibitions(
      [
        row({ id: 'school', placeName: '전남대학교 문화전문대학원', placeId: null }),
        row({ id: 'gallery', placeName: '클리블랜드미술관', placeId: null }),
        row(),
      ],
      {},
      TODAY,
    );
    expect(kept.map((item) => item.id)).toEqual(['1']);
  });
});
