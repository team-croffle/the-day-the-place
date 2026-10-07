/** 2026-10-01 → 2026.10.01. 시작일이 없으면 종료일만. */
export function exhibitionPeriod(startsOn: string | null, endsOn: string): string {
  const end = endsOn.replaceAll('-', '.');
  if (!startsOn) {
    return end;
  }
  return `${startsOn.replaceAll('-', '.')} – ${end}`;
}
