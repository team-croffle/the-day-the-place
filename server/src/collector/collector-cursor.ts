import { sameExhibitionName } from '@nest-vue/shared';

const SOURCE_MUSEUM_OR = 'museum_or';
const SOURCE_MUSEUMNEWS = 'museumnews';

export interface PendingPost {
  source: 'museum_or' | 'museumnews';
  postId: number;
  title: string;
  url: string;
  publishedOn: string;
}

export interface CollectorCursor {
  museumOr: number;
  museumnews: number;
  pending: PendingPost[];
}

export interface CursorUpdate {
  source: string;
  lastPostId: number;
}

export function cursorFromRows(
  rows: readonly { source: string; lastPostId: number }[],
): CollectorCursor {
  return {
    museumOr: rows.find((row) => row.source === SOURCE_MUSEUM_OR)?.lastPostId ?? 0,
    museumnews: rows.find((row) => row.source === SOURCE_MUSEUMNEWS)?.lastPostId ?? 0,
    pending: [],
  };
}

export function pendingFromRows(
  rows: readonly {
    source: string;
    postId: number;
    title: string;
    url: string;
    publishedOn: string;
  }[],
): PendingPost[] {
  return rows.flatMap((row) => {
    if (row.source !== SOURCE_MUSEUM_OR && row.source !== SOURCE_MUSEUMNEWS) {
      return [];
    }
    return [
      {
        source: row.source,
        postId: row.postId,
        title: row.title,
        url: row.url,
        publishedOn: row.publishedOn,
      },
    ];
  });
}

export function cursorUpdates(
  cursor: { museumOr?: number | null; museumnews?: number | null } | null | undefined,
): CursorUpdate[] {
  if (!cursor) {
    return [];
  }
  const updates: CursorUpdate[] = [];
  if (typeof cursor.museumOr === 'number') {
    updates.push({ source: SOURCE_MUSEUM_OR, lastPostId: cursor.museumOr });
  }
  if (typeof cursor.museumnews === 'number') {
    updates.push({ source: SOURCE_MUSEUMNEWS, lastPostId: cursor.museumnews });
  }
  return updates;
}

/** 이미 처리한 글 번호보다 앞으로만 움직인다. */
export function forwardPostId(current: number, incoming: number): number {
  return Math.max(current, incoming);
}

export function draftsNotInCulture<T extends { placeName: string; title: string }>(
  drafts: readonly T[],
  culture: readonly { placeName: string; title: string }[],
): T[] {
  return drafts.filter(
    (draft) =>
      !culture.some((item) =>
        sameExhibitionName(item.placeName, item.title, draft.placeName, draft.title),
      ),
  );
}
