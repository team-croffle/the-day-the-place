import {
  cursorFromRows,
  cursorUpdates,
  draftsNotInCulture,
  forwardPostId,
} from './collector-cursor';

describe('collector cursor', () => {
  it('reads zero when a source has no row', () => {
    expect(cursorFromRows([{ source: 'museum_or', lastPostId: 7135 }])).toEqual({
      museumOr: 7135,
      museumnews: 0,
      pending: [],
    });
  });

  it('updates only the sources present in the request', () => {
    expect(cursorUpdates({ museumnews: 46359 })).toEqual([
      { source: 'museumnews', lastPostId: 46359 },
    ]);
    expect(cursorUpdates(null)).toEqual([]);
  });

  it('does not move a cursor backward', () => {
    expect(forwardPostId(7135, 7000)).toBe(7135);
    expect(forwardPostId(7135, 7200)).toBe(7200);
  });
});

describe('draftsNotInCulture', () => {
  it('drops a draft the culture list already has', () => {
    const kept = draftsNotInCulture(
      [
        { placeName: '국립 중앙박물관', title: '조선의 색' },
        { placeName: '국립경주박물관', title: '황룡사' },
      ],
      [{ placeName: '국립중앙박물관', title: '조선의색' }],
    );

    expect(kept).toEqual([{ placeName: '국립경주박물관', title: '황룡사' }]);
  });
});
