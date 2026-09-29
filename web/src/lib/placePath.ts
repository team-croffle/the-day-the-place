import type { PlaceKind } from '@nest-vue/shared';

export function placeDetailPath(kind: PlaceKind, id: string): string {
  return kind === 'museum' ? `/museums/${id}` : `/sites/${id}`;
}
