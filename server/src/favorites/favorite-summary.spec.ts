import { fillFavoriteCounts, parseFavoriteIdList, singleFavoriteId } from './favorite-summary';

describe('parseFavoriteIdList', () => {
  it('쉼표로 나눈 ID를 그대로 둔다', () => {
    expect(parseFavoriteIdList('12,34')).toEqual(['12', '34']);
  });

  it('빈 칸, 중복, 한도 초과, 경로 문자는 거절한다', () => {
    expect(parseFavoriteIdList('12,,34')).toBeNull();
    expect(parseFavoriteIdList('12,12')).toBeNull();
    expect(parseFavoriteIdList('12/34')).toBeNull();
    expect(
      parseFavoriteIdList(Array.from({ length: 101 }, (_, index) => String(index)).join(',')),
    ).toBeNull();
  });
});

describe('singleFavoriteId', () => {
  it('장소 ID 하나만 받고 쉼표 목록은 거절한다', () => {
    expect(singleFavoriteId(' 130431 ')).toBe('130431');
    expect(singleFavoriteId('12,34')).toBeNull();
  });
});

describe('fillFavoriteCounts', () => {
  it('없는 장소는 0이고 요청하지 않은 장소는 빼 둔다', () => {
    expect(
      fillFavoriteCounts(
        [
          { placeId: '12', total: 3 },
          { placeId: '99', total: 8 },
        ],
        ['12', '34'],
      ),
    ).toEqual({ '12': 3, '34': 0 });
  });
});
