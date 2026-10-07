import dgram from 'node:dgram';
import { lookup } from 'node:dns/promises';
import https from 'node:https';

import type { Exhibition, ExhibitionStatus } from '@nest-vue/shared';

const DNS_HEADER = 12;
const IPV4_LENGTH = 4;
const DNS_POINTER = 0xc0;
const PAGE_SIZE = 100;
const MAX_PAGES = 200;
const SUMMARY_LIMIT = 800;
const MIN_SHARED_TITLE = 8;
const OK_CODES = new Set(['0000', '00', '0']);
const MAP_PLACE = /박물관|기념관|전시관/;
const YMD = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;
const MD = /(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/;
const COMPACT = /(20\d{2})(\d{2})(\d{2})/g;
const HTTP_URL = /https?:\/\/[^\s"'<>]+/;

/** 전시정보(통합)을 페이지 끝까지 읽어 화면에 올릴 행만 돌려준다. 저장하지 않는다. */
export async function fetchCultureExhibitions(
  apiKey: string,
  today: string,
  url = 'https://api.kcisa.kr/openapi/API_CCA_145/request',
): Promise<Exhibition[]> {
  const endpoint = new URL(url);
  const address = await resolveHost(endpoint.hostname);
  const rows: Exhibition[] = [];
  let total: number | null = null;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      serviceKey: decodeServiceKey(apiKey),
      numOfRows: String(PAGE_SIZE),
      pageNo: String(page),
    });
    // 다음 페이지 수는 이번 응답을 본 뒤에 정한다.
    // eslint-disable-next-line no-await-in-loop
    const payload = await getJson(address, endpoint.hostname, `${endpoint.pathname}?${params}`);
    const code = findText(payload, 'resultCode');
    if (code && !OK_CODES.has(code)) {
      throw new Error(code);
    }
    if (total === null) {
      total = asInt(findText(payload, 'totalCount'));
    }
    const batch = exhibitionsFromItems(findItems(payload), today);
    rows.push(...batch);
    const rawCount = findItems(payload).length;
    if (rawCount < PAGE_SIZE || (total !== null && page * PAGE_SIZE >= total)) {
      break;
    }
  }
  return dedupeSamePeriod(rows);
}

/** 통합 목록과 같은 전시인 저장 행을 뺀다. 화면에 남는 것은 통합 쪽이다. */
export function omitRowsCoveredByCulture(
  stored: Exhibition[],
  culture: Exhibition[],
): Exhibition[] {
  return stored.filter((row) => !culture.some((item) => sameShow(row, item)));
}

export function exhibitionsFromItems(
  items: readonly Record<string, unknown>[],
  today: string,
): Exhibition[] {
  const rows = items.flatMap((item) => {
    const exhibition = exhibitionFromItem(item, today);
    return exhibition ? [exhibition] : [];
  });
  return dedupeSamePeriod(rows);
}

function exhibitionFromItem(item: Record<string, unknown>, today: string): Exhibition | null {
  const genre = field(item, 'GENRE');
  const title = plain(field(item, 'TITLE'));
  const period = field(item, 'PERIOD');
  const institution = plain(field(item, 'CNTC_INSTT_NM'));
  const site = plain(field(item, 'EVENT_SITE'));
  if ([genre, title, period, institution, site].some((value) => value.includes('상설'))) {
    return null;
  }
  const [startsOn, endsOn] = parsePeriod(period);
  if (!endsOn || endsOn < today || !title) {
    return null;
  }
  const placeName = choosePlace(institution, site);
  if (!placeName) {
    return null;
  }
  const summary = (plain(field(item, 'DESCRIPTION')) || title).slice(0, SUMMARY_LIMIT);
  const status: ExhibitionStatus = startsOn && today < startsOn ? 'upcoming' : 'ongoing';
  const localId = field(item, 'LOCAL_ID');
  return {
    id: cultureId(localId, placeName, title, endsOn),
    title,
    startsOn,
    endsOn,
    status,
    placeSource: null,
    placeId: null,
    placeName,
    summary,
    imageUrl: httpUrl(field(item, 'IMAGE_OBJECT')),
    sourceUrl: httpUrl(field(item, 'URL')),
  };
}

function parsePeriod(value: string): [string | null, string | null] {
  const text = value.trim();
  YMD.lastIndex = 0;
  COMPACT.lastIndex = 0;
  if (!text || text.includes('상설')) {
    return [null, null];
  }
  const dated = [...text.matchAll(YMD)]
    .map((match) => isoDate(match[1], match[2], match[3]))
    .filter((item): item is string => item !== null);
  if (dated.length > 1) {
    const start = dated[0];
    const end = dated[dated.length - 1];
    if (!start || !end || end < start) {
      return [null, null];
    }
    return [start, end];
  }
  if (dated.length === 1) {
    const start = dated[0];
    if (!start) {
      return [null, null];
    }
    YMD.lastIndex = 0;
    const first = YMD.exec(text);
    YMD.lastIndex = 0;
    const rest = first ? text.slice(first.index + first[0].length) : '';
    const monthDay = MD.exec(rest);
    if (!monthDay) {
      return [null, start];
    }
    const end = endOn(start, monthDay[1] ?? '', monthDay[2] ?? '');
    return end ? [start, end] : [null, null];
  }
  const compact = [...text.matchAll(COMPACT)]
    .map((match) => isoDate(match[1], match[2], match[3]))
    .filter((item): item is string => item !== null);
  if (compact.length > 1) {
    const start = compact[0];
    const end = compact[compact.length - 1];
    if (start && end && end >= start) {
      return [start, end];
    }
  }
  if (compact.length === 1 && compact[0]) {
    return [null, compact[0]];
  }
  return [null, null];
}

function endOn(start: string, month: string, day: string): string | null {
  const year = Number(start.slice(0, 4));
  const sameYear = isoDate(String(year), month, day);
  if (sameYear && sameYear >= start) {
    return sameYear;
  }
  return isoDate(String(year + 1), month, day);
}

function isoDate(
  year: string | undefined,
  month: string | undefined,
  day: string | undefined,
): string | null {
  if (!year || !month || !day) {
    return null;
  }
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function choosePlace(institution: string, site: string): string | null {
  if (MAP_PLACE.test(institution)) {
    return institution;
  }
  if (MAP_PLACE.test(site)) {
    return site;
  }
  return null;
}

function sameShow(left: Exhibition, right: Exhibition): boolean {
  if (fold(left.placeName) !== fold(right.placeName)) {
    return false;
  }
  const a = fold(left.title);
  const b = fold(right.title);
  if (a === b) {
    return true;
  }
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= MIN_SHARED_TITLE && longer.includes(shorter);
}

function fold(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function field(item: Record<string, unknown>, name: string): string {
  for (const [key, value] of Object.entries(item)) {
    if (key.toUpperCase() === name && value !== null && value !== undefined) {
      return String(value).trim();
    }
  }
  return '';
}

function cultureId(localId: string, placeName: string, title: string, endsOn: string): string {
  const body = `${fold(placeName)}:${fold(title)}`;
  return localId ? `culture:${localId}:${body}` : `culture:${body}:${endsOn}`;
}

function dedupeSamePeriod(rows: Exhibition[]): Exhibition[] {
  const kept: Exhibition[] = [];
  for (const row of rows) {
    const index = kept.findIndex(
      (item) =>
        item.placeName === row.placeName &&
        item.startsOn === row.startsOn &&
        item.endsOn === row.endsOn,
    );
    const current = index < 0 ? undefined : kept[index];
    if (!current) {
      kept.push(row);
      continue;
    }
    if (preferSamePeriod(row, current)) {
      kept[index] = row;
    }
  }
  return kept;
}

function preferSamePeriod(next: Exhibition, current: Exhibition): boolean {
  const nextDraft = next.title.includes('가제');
  const currentDraft = current.title.includes('가제');
  if (nextDraft !== currentDraft) {
    return !nextDraft;
  }
  return next.title.length > current.title.length;
}

function plain(value: string): string {
  const withoutTags = value.replace(/<[^>]+>/g, ' ');
  const decoded = withoutTags
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  return decoded.replace(/\s+/g, ' ').trim();
}

function httpUrl(value: string): string | null {
  return HTTP_URL.exec(value)?.[0] ?? null;
}

function findItems(node: unknown): Record<string, unknown>[] {
  if (!node || typeof node !== 'object') {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => findItems(item));
  }
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() !== 'item') {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return [value as Record<string, unknown>];
    }
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
      );
    }
  }
  return Object.values(record).flatMap((value) => findItems(value));
}

function findText(node: unknown, key: string): string | null {
  if (!node || typeof node !== 'object') {
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findText(item, key);
      if (found) {
        return found;
      }
    }
    return null;
  }
  for (const [name, value] of Object.entries(node as Record<string, unknown>)) {
    if (
      name.toLowerCase() === key.toLowerCase() &&
      value !== null &&
      value !== undefined &&
      typeof value !== 'object'
    ) {
      return String(value).trim();
    }
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = findText(value, key);
    if (found) {
      return found;
    }
  }
  return null;
}

function asInt(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}

function decodeServiceKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

async function resolveHost(hostname: string): Promise<string> {
  const system = await systemAddress(hostname);
  if (system) {
    return system;
  }
  if (!hostname.endsWith('.kcisa.kr')) {
    throw new Error('dns');
  }
  const nameserver = await systemAddress('ns.kcis.or.kr');
  if (!nameserver) {
    throw new Error('dns');
  }
  const address = await queryA(nameserver, hostname);
  if (!address) {
    throw new Error('dns');
  }
  return address;
}

async function systemAddress(hostname: string): Promise<string | null> {
  try {
    const found = await lookup(hostname, { family: 4 });
    return found.address || null;
  } catch {
    return null;
  }
}

function queryA(server: string, host: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('dns'));
    }, 3000);
    socket.once('error', () => {
      clearTimeout(timer);
      socket.close();
      reject(new Error('dns'));
    });
    socket.once('message', (data: Buffer) => {
      clearTimeout(timer);
      socket.close();
      resolve(dnsARecord(data));
    });
    socket.send(dnsQuery(host), 53, server);
  });
}

function dnsQuery(host: string): Buffer {
  const header = Buffer.from([
    0x1c, 0x1a, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  const labels = host
    .split('.')
    .map((part) => Buffer.concat([Buffer.from([part.length]), Buffer.from(part, 'ascii')]));
  return Buffer.concat([header, ...labels, Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01])]);
}

function dnsARecord(data: Buffer): string | null {
  if (data.length < DNS_HEADER) {
    return null;
  }
  const questions = data.readUInt16BE(4);
  const answers = data.readUInt16BE(6);
  let offset = DNS_HEADER;
  for (let index = 0; index < questions; index += 1) {
    offset = skipDnsName(data, offset) + 4;
  }
  for (let index = 0; index < answers; index += 1) {
    offset = skipDnsName(data, offset);
    if (offset + 10 > data.length) {
      return null;
    }
    const recordType = data.readUInt16BE(offset);
    const length = data.readUInt16BE(offset + 8);
    const start = offset + 10;
    if (recordType === 1 && length === IPV4_LENGTH && start + IPV4_LENGTH <= data.length) {
      return [data[start], data[start + 1], data[start + 2], data[start + 3]].join('.');
    }
    offset = start + length;
  }
  return null;
}

function skipDnsName(data: Buffer, offset: number): number {
  while (offset < data.length) {
    const length = data[offset] ?? 0;
    if (length === 0) {
      return offset + 1;
    }
    if ((length & DNS_POINTER) === DNS_POINTER) {
      return offset + 2;
    }
    offset += 1 + length;
  }
  return offset;
}

function getJson(address: string, hostname: string, path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        host: address,
        servername: hostname,
        path,
        method: 'GET',
        headers: { Host: hostname, Accept: 'application/json' },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on('end', () => {
          const status = response.statusCode ?? 500;
          if (status < 200 || status >= 300) {
            reject(new Error(String(status)));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
          } catch {
            reject(new Error('parse'));
          }
        });
      },
    );
    request.setTimeout(20_000, () => {
      request.destroy(new Error('timeout'));
    });
    request.on('error', () => {
      reject(new Error('network'));
    });
    request.end();
  });
}
