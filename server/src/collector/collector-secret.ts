import { timingSafeEqual } from 'node:crypto';

/** 비밀이 비어 있거나 다르면 거절한다. */
export function collectorSecretMatches(expected: string, given: string): boolean {
  if (!expected) {
    return false;
  }
  const left = Buffer.from(expected);
  const right = Buffer.from(given);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
