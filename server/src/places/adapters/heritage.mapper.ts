import { HERITAGE_KIND_CODES, type PlaceDesignation } from '@nest-vue/shared';

import type { HeritageListItem } from './heritage.types';

const MAX_DESIGNATIONS = 40;

const KIND_RANK = new Map<string, number>(
  Object.values(HERITAGE_KIND_CODES).map((code, index) => [code, index]),
);

/** 목록 XML. 실패로 볼 본문은 던지고, 0건은 빈 배열이다. */
export function parseHeritageList(xml: string): { total: number; items: HeritageListItem[] } {
  if (!xml.includes('<result>')) {
    throw new Error('Heritage API returned an unexpected body');
  }
  const total = Number(tagText(xml, 'totalCnt') ?? '0');
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => ({
    ccmaName: tagText(match[1] ?? '', 'ccmaName'),
    ccbaMnm1: tagText(match[1] ?? '', 'ccbaMnm1'),
    ccbaKdcd: tagText(match[1] ?? '', 'ccbaKdcd'),
    ccbaAsno: tagText(match[1] ?? '', 'ccbaAsno'),
    ccbaCtcd: tagText(match[1] ?? '', 'ccbaCtcd'),
    ccbaCncl: tagText(match[1] ?? '', 'ccbaCncl'),
  }));
  return { total: Number.isFinite(total) ? total : 0, items };
}

/** 장소 이름이 유산 이름에 들어 있는 지정만. 종목 코드 순. */
export function toPlaceDesignations(
  items: HeritageListItem[],
  placeName: string,
): PlaceDesignation[] {
  const needle = placeName.trim();
  if (!needle) {
    return [];
  }
  const seen = new Set<string>();
  const rows: PlaceDesignation[] = [];
  for (const item of items) {
    if (item.ccbaCncl === 'Y') {
      continue;
    }
    const name = item.ccbaMnm1?.trim();
    const kind = item.ccmaName?.trim();
    const kdcd = item.ccbaKdcd?.trim();
    const asno = item.ccbaAsno?.trim();
    const ctcd = item.ccbaCtcd?.trim();
    if (!name || !kind || !kdcd || !asno || !ctcd || !name.includes(needle)) {
      continue;
    }
    const id = `${kdcd}:${asno}:${ctcd}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    rows.push({ id, name, kind });
  }
  return rows
    .toSorted((a, b) => {
      const rankA = KIND_RANK.get(a.id.split(':')[0] ?? '') ?? KIND_RANK.size;
      const rankB = KIND_RANK.get(b.id.split(':')[0] ?? '') ?? KIND_RANK.size;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.name.localeCompare(b.name, 'ko');
    })
    .slice(0, MAX_DESIGNATIONS);
}

function tagText(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`).exec(
    block,
  );
  const raw = match?.[1] ?? match?.[2];
  const text = raw
    ?.replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
  return text ? text : undefined;
}
