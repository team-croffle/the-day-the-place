export function pageItems(current: number, total: number): Array<number | 'gap'> {
  if (total < 1) return [];
  const safe = Math.min(Math.max(1, current), total);
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const wanted = [1, total, safe - 2, safe - 1, safe, safe + 1, safe + 2].filter(
    (page) => page >= 1 && page <= total,
  );
  const unique = [...new Set(wanted)].toSorted((left, right) => left - right);
  const items: Array<number | 'gap'> = [];
  for (const page of unique) {
    const prev = items.at(-1);
    if (typeof prev === 'number' && page - prev > 1) items.push('gap');
    items.push(page);
  }
  return items;
}
