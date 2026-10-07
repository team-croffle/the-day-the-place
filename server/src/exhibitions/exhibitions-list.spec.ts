import { selectExhibitions, type Exhibition } from '@nest-vue/shared';

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
});
