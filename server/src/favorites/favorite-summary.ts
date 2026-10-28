export const FAVORITE_IDS_LIMIT = 100;
const FAVORITE_ID_MAX = 64;
const FAVORITE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** 쉼표로 받은 장소 ID. 비었거나 한도를 넘거나 겹치면 null. */
export function parseFavoriteIdList(raw: string): string[] | null {
  const parts = raw.split(',');
  if (parts.length === 0 || parts.length > FAVORITE_IDS_LIMIT) return null;
  const ids = parts.map((part) => part.trim());
  if (ids.some((id) => !FAVORITE_ID_PATTERN.test(id) || id.length > FAVORITE_ID_MAX)) return null;
  if (new Set(ids).size !== ids.length) return null;
  return ids;
}

/** 저장·해제에 쓰는 장소 ID 하나. 목록이 아니거나 비면 null. */
export function singleFavoriteId(raw: string): string | null {
  const ids = parseFavoriteIdList(raw.trim());
  if (!ids || ids.length !== 1) return null;
  return ids[0];
}

/** 요청한 ID는 행이 없어도 0이다. 요청 밖 ID는 넣지 않는다. */
export function fillFavoriteCounts(
  grouped: ReadonlyArray<{ placeId: string; total: number }>,
  ids: readonly string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = 0;
  for (const row of grouped) {
    if (Object.hasOwn(counts, row.placeId)) counts[row.placeId] = row.total;
  }
  return counts;
}
