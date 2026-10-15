import { sameExhibitionName } from '@nest-vue/shared';

describe('sameExhibitionName', () => {
  it('matches the same place and title after spacing and symbols are removed', () => {
    expect(sameExhibitionName('국립 중앙박물관', '조선의 색', '국립중앙박물관', '조선의색')).toBe(
      true,
    );
  });

  it('matches when the end dates differ', () => {
    expect(sameExhibitionName('국립중앙박물관', '조선의 색', '국립중앙박물관', '조선의 색')).toBe(
      true,
    );
  });

  it('does not match a different place or a different title', () => {
    expect(sameExhibitionName('국립중앙박물관', '조선의 색', '국립경주박물관', '조선의 색')).toBe(
      false,
    );
    expect(sameExhibitionName('국립중앙박물관', '조선의 색', '국립중앙박물관', '황룡사')).toBe(
      false,
    );
  });
});
