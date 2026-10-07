import type { Exhibition } from '@nest-vue/shared';

import { exhibitionsFromItems, omitRowsCoveredByCulture } from './culture-exhibitions';

const TODAY = '2026-10-07';

function item(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    TITLE: '우리들의 밥상',
    CNTC_INSTT_NM: '국립중앙박물관',
    PERIOD: '2026-07-01~2026-10-25',
    DESCRIPTION: '<p>밥과 계절을 보여 준다.</p>',
    LOCAL_ID: 'OPENEXHT_1',
    URL: 'https://www.museum.go.kr/show',
    IMAGE_OBJECT: 'https://cdn.example.test/poster.jpg',
    ...overrides,
  };
}

function stored(overrides: Partial<Exhibition> = {}): Exhibition {
  return {
    id: 'news',
    title: '황룡사, 부처의 사리를 모시다 - 황룡봉불',
    startsOn: '2026-06-12',
    endsOn: '2026-10-11',
    status: 'ongoing',
    placeSource: 'tour',
    placeId: '129778',
    placeName: '국립중앙박물관',
    summary: '뉴스 요약',
    imageUrl: null,
    sourceUrl: 'https://news.example.test/a',
    ...overrides,
  };
}

describe('culture exhibitions', () => {
  it('keeps a museum show and drops an art museum, a permanent show, and an ended show', () => {
    const rows = exhibitionsFromItems(
      [
        item(),
        item({ TITLE: '현대', CNTC_INSTT_NM: '국립현대미술관', LOCAL_ID: 'art' }),
        item({ TITLE: '상설 도자기', GENRE: '상설전시', LOCAL_ID: 'perm' }),
        item({ TITLE: '끝난 전시', PERIOD: '2026-01-01~2026-09-30', LOCAL_ID: 'old' }),
      ],
      TODAY,
    );

    expect(rows.map((row) => row.title)).toEqual(['우리들의 밥상']);
    expect(rows[0]).toMatchObject({
      id: 'culture:OPENEXHT_1:국립중앙박물관:우리들의밥상',
      placeName: '국립중앙박물관',
      startsOn: '2026-07-01',
      endsOn: '2026-10-25',
      summary: '밥과 계절을 보여 준다.',
      sourceUrl: 'https://www.museum.go.kr/show',
    });
  });

  it('keeps one card when the same museum and period are listed twice', () => {
    const rows = exhibitionsFromItems(
      [
        item({ TITLE: '도기陶器의 전통, 질그릇의 어제와 오늘(가제)', LOCAL_ID: '181' }),
        item({ TITLE: '도기陶器, 우리를 담은 질그릇', LOCAL_ID: '181' }),
        item({
          TITLE: '상설전시실의 지도',
          EVENT_SITE: '아시아문화박물관 상설전시실 1',
          LOCAL_ID: 'room',
        }),
        item({
          TITLE: '&lt;백제 왕실 사찰&gt;',
          CNTC_INSTT_NM: '국립익산박물관',
          LOCAL_ID: '185',
          PERIOD: '2026-11-10~2027-02-07',
        }),
      ],
      TODAY,
    );

    expect(rows.map((row) => row.title)).toEqual([
      '도기陶器, 우리를 담은 질그릇',
      '<백제 왕실 사찰>',
    ]);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
  });

  it('drops a stored row when the culture list has the same show', () => {
    const culture = exhibitionsFromItems(
      [item({ TITLE: '황룡사, 부처의 사리를 모시다', LOCAL_ID: 'culture' })],
      TODAY,
    );
    const kept = omitRowsCoveredByCulture(
      [stored(), stored({ id: 'other', title: '금관의 나라', placeName: '국립경주박물관' })],
      culture,
    );

    expect(kept.map((row) => row.id)).toEqual(['other']);
  });
});
