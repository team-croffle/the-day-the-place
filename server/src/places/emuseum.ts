import type { Paginated, RelicDetail, RelicSummary } from '@nest-vue/shared';

const BASE_URL = 'https://apis.data.go.kr/1371027/openapi';
const MUSEUM_PARENTS = ['PS01001', 'PS01002', 'PS01003', 'PS01004', 'PS01005'] as const;
const PAGE_SIZE = 24;
const DAY_MS = 24 * 60 * 60 * 1000;
const IMAGE_BYTE_LIMIT = 2_000_000;
const MAX_CACHED_IMAGES = 96;
const RELIC_ID = /^PS\d{10,40}$/;

export class EmuseumError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'EmuseumError';
  }
}

interface StoredRelic {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface StoredDetail extends StoredRelic {
  era: string | null;
  material: string | null;
  museumCode: string | null;
  museumName: string | null;
}

interface CacheEntry<T> {
  at: number;
  value: T;
}

interface RelicPage {
  rows: StoredRelic[];
  total: number;
}

interface KnownImage {
  code: string;
  url: string;
}

export function isRelicId(value: string): boolean {
  return RELIC_ID.test(value);
}

/** 공백을 없앤 이름. 같은 기관만 붙인다. */
export function compactPlaceName(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, '');
}

export function museumCodeForName(
  museums: readonly { name: string; code: string }[],
  placeName: string,
): string | null {
  const target = compactPlaceName(placeName);
  if (!target) {
    return null;
  }
  return museums.find((museum) => compactPlaceName(museum.name) === target)?.code ?? null;
}

export function relicsFromXml(xml: string): StoredRelic[] {
  assertOk(xml);
  return parseRecords(xml).flatMap((record) => {
    const id = record.id ?? '';
    const name = record.nameKr || record.name || '';
    if (!isRelicId(id) || !name) {
      return [];
    }
    return [{ id, name, imageUrl: pickImageUrl(record) }];
  });
}

export function detailFromXml(xml: string): StoredDetail | null {
  assertOk(xml);
  const record = parseRecords(xml)[0];
  if (!record) {
    return null;
  }
  const id = record.id ?? '';
  const name = record.nameKr || record.name || '';
  if (!isRelicId(id) || !name) {
    return null;
  }
  return {
    id,
    name,
    era: record.nationalityName1 || record.nationalityName2 || null,
    material: record.materialName2 || record.materialName1 || null,
    museumCode: record.museumCode || record.museumCode2 || null,
    museumName: record.museumName2 || null,
    imageUrl: pickImageUrl(record),
  };
}

export function museumsFromXml(xml: string): { name: string; code: string }[] {
  assertOk(xml);
  return parseRecords(xml).flatMap((record) => {
    const code = record.code ?? '';
    const name = record.nameKr || record.name || '';
    if (!code || !name) {
      return [];
    }
    return [{ code, name }];
  });
}

export function totalFromXml(xml: string): number {
  const raw = xml.match(/<totalCount>(\d+)<\/totalCount>/)?.[1];
  const total = raw ? Number(raw) : 0;
  return Number.isFinite(total) ? total : 0;
}

export function toSummary(relic: StoredRelic): RelicSummary {
  return { id: relic.id, name: relic.name, hasImage: relic.imageUrl !== null };
}

export function toDetail(relic: StoredDetail): RelicDetail {
  return {
    id: relic.id,
    name: relic.name,
    era: relic.era,
    material: relic.material,
    hasImage: relic.imageUrl !== null,
  };
}

export class EmuseumCatalog {
  private readonly apiKey: string;
  private readonly now: () => number;
  private readonly fetchImpl: typeof fetch;
  private museums: CacheEntry<Map<string, string>> | null = null;
  private readonly pages = new Map<string, CacheEntry<RelicPage>>();
  private readonly knownImages = new Map<string, CacheEntry<KnownImage>>();
  private readonly details = new Map<string, CacheEntry<StoredDetail>>();
  private readonly images = new Map<string, CacheEntry<{ body: Buffer; type: string }>>();
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(options: { apiKey: string; now?: () => number; fetch?: typeof fetch }) {
    this.apiKey = decodeServiceKey(options.apiKey);
    this.now = options.now ?? Date.now;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async listForMuseum(placeName: string, pageNo: number): Promise<Paginated<RelicSummary>> {
    const code = await this.codeFor(placeName);
    if (!code) {
      return { items: [], page: 1, size: PAGE_SIZE, total: 0, totalPages: 0 };
    }
    const page = await this.page(code, pageNo);
    const totalPages = page.total === 0 ? 0 : Math.ceil(page.total / PAGE_SIZE);
    return {
      items: page.rows.map(toSummary),
      page: pageNo,
      size: PAGE_SIZE,
      total: page.total,
      totalPages,
    };
  }

  async detailForMuseum(placeName: string, relicId: string): Promise<RelicDetail | null> {
    const code = await this.codeFor(placeName);
    if (!code || !isRelicId(relicId)) {
      return null;
    }
    const detail = await this.detail(relicId);
    if (!detail || !belongsToMuseum(detail, code, placeName)) {
      return null;
    }
    return toDetail(detail);
  }

  async imageForMuseum(
    placeName: string,
    relicId: string,
  ): Promise<{ body: Buffer; type: string } | null> {
    const code = await this.codeFor(placeName);
    if (!code || !isRelicId(relicId)) {
      return null;
    }
    const known = this.fresh(this.knownImages.get(relicId));
    if (known?.code === code) {
      return this.image(relicId, known.url);
    }
    const detail = await this.detail(relicId);
    if (!detail?.imageUrl || !belongsToMuseum(detail, code, placeName)) {
      return null;
    }
    return this.image(relicId, detail.imageUrl);
  }

  private async codeFor(placeName: string): Promise<string | null> {
    const index = await this.museumIndex();
    return index.get(compactPlaceName(placeName)) ?? null;
  }

  private museumIndex(): Promise<Map<string, string>> {
    const cached = this.fresh(this.museums);
    if (cached) {
      return Promise.resolve(cached);
    }
    return this.once('museums', async () => {
      this.requireKey();
      const byName = new Map<string, string>();
      const groups = await Promise.all(MUSEUM_PARENTS.map((parent) => this.codePages(parent)));
      for (const rows of groups) {
        for (const row of rows) {
          const key = compactPlaceName(row.name);
          if (key && !byName.has(key)) {
            byName.set(key, row.code);
          }
        }
      }
      this.museums = { at: this.now(), value: byName };
      return byName;
    });
  }

  private page(code: string, pageNo: number): Promise<RelicPage> {
    const key = `${code}:${pageNo}`;
    const cached = this.fresh(this.pages.get(key));
    if (cached) {
      return Promise.resolve(cached);
    }
    return this.once(`page:${key}`, async () => {
      const xml = await this.getXml('list', {
        museumCode: code,
        numOfRows: String(PAGE_SIZE),
        pageNo: String(pageNo),
      });
      const rows = relicsFromXml(xml).slice(0, PAGE_SIZE);
      const value = { rows, total: totalFromXml(xml) };
      const at = this.now();
      this.pages.set(key, { at, value });
      for (const row of rows) {
        if (row.imageUrl) {
          this.knownImages.set(row.id, { at, value: { code, url: row.imageUrl } });
        }
      }
      return value;
    });
  }

  private detail(relicId: string): Promise<StoredDetail | null> {
    const cached = this.fresh(this.details.get(relicId));
    if (cached) {
      return Promise.resolve(cached);
    }
    return this.once(`detail:${relicId}`, async () => {
      const xml = await this.getXml('detail', { id: relicId });
      const detail = detailFromXml(xml);
      if (detail) {
        this.details.set(relicId, { at: this.now(), value: detail });
      }
      return detail;
    });
  }

  private image(relicId: string, imageUrl: string): Promise<{ body: Buffer; type: string }> {
    const cached = this.fresh(this.images.get(relicId));
    if (cached) {
      return Promise.resolve(cached);
    }
    return this.once(`image:${relicId}`, async () => {
      const response = await this.fetchImpl(imageUrl, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        throw new EmuseumError('image');
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > IMAGE_BYTE_LIMIT) {
        throw new EmuseumError('image');
      }
      const type = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
      const image = { body: bytes, type: type.startsWith('image/') ? type : 'image/jpeg' };
      this.images.delete(relicId);
      this.images.set(relicId, { at: this.now(), value: image });
      while (this.images.size > MAX_CACHED_IMAGES) {
        const oldest = this.images.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        this.images.delete(oldest);
      }
      return image;
    });
  }

  private async codePages(parent: string): Promise<{ name: string; code: string }[]> {
    const rows: { name: string; code: string }[] = [];
    for (let page = 1; page <= 10; page += 1) {
      // 다음 페이지 여부는 이번 응답의 건수로 정한다.
      // eslint-disable-next-line no-await-in-loop
      const xml = await this.getXml('code', {
        parentCode: parent,
        numOfRows: '100',
        pageNo: String(page),
      });
      const batch = museumsFromXml(xml);
      rows.push(...batch);
      if (batch.length < 100) {
        break;
      }
    }
    return rows;
  }

  private async getXml(path: string, params: Record<string, string>): Promise<string> {
    this.requireKey();
    const url = new URL(`${BASE_URL}/${path}`);
    url.searchParams.set('serviceKey', this.apiKey);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    const response = await this.fetchImpl(url, {
      headers: { Accept: 'application/xml' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new EmuseumError('upstream');
    }
    const xml = await response.text();
    if (xml.trim().startsWith('{')) {
      throw new EmuseumError('upstream');
    }
    assertOk(xml);
    return xml;
  }

  private requireKey(): void {
    if (!this.apiKey) {
      throw new EmuseumError('missing-key');
    }
  }

  private fresh<T>(entry: CacheEntry<T> | null | undefined): T | null {
    if (!entry || this.now() - entry.at >= DAY_MS) {
      return null;
    }
    return entry.value;
  }

  private once<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const promise = this.finish(key, load);
    this.pending.set(key, promise);
    return promise;
  }

  private async finish<T>(key: string, load: () => Promise<T>): Promise<T> {
    try {
      return await load();
    } finally {
      this.pending.delete(key);
    }
  }
}

function belongsToMuseum(detail: StoredDetail, code: string, placeName: string): boolean {
  if (detail.museumCode === code) {
    return true;
  }
  return compactPlaceName(detail.museumName ?? '') === compactPlaceName(placeName);
}

function assertOk(xml: string): void {
  const code = xml.match(/<resultCode>([^<]*)<\/resultCode>/)?.[1]?.trim();
  if (code && code !== '0000') {
    throw new EmuseumError(code);
  }
}

function parseRecords(xml: string): Record<string, string>[] {
  return [...xml.matchAll(/<data>([\s\S]*?)<\/data>/g)].map((match) => {
    const record: Record<string, string> = {};
    for (const item of match[1].matchAll(/<item key="([^"]+)" value="([^"]*)"/g)) {
      record[item[1]] = unescapeXml(item[2]);
    }
    return record;
  });
}

function pickImageUrl(record: Record<string, string>): string | null {
  return safeImageUrl(
    record.imgThumUriL || record.imgThumUriM || record.imgUri || record.imgThumUriS,
  );
}

function safeImageUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    if (host !== 'emuseum.go.kr' && !host.endsWith('.emuseum.go.kr')) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function unescapeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function decodeServiceKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}
