import {
  API_ROUTES,
  type FavoriteItem,
  type FavoriteSummary,
  type PlaceKind,
  type PlaceSource,
} from '@nest-vue/shared';
import { computed, ref, watch, type Ref } from 'vue';

import { authClient } from '@/lib/authClient';

import { apiFetch } from './useApi';

function markKey(source: PlaceSource, id: string): string {
  return `${source}:${id}`;
}

export interface FavoriteTargetView {
  source: PlaceSource;
  id: string;
  name: string;
  kind: PlaceKind;
}

export function useFavoriteMarks(targets: Ref<FavoriteTargetView[]>) {
  const session = authClient.useSession();
  const counts = ref<Record<string, number>>({});
  const saved = ref<Set<string>>(new Set());
  const busyKey = ref<string | null>(null);

  const requestKey = computed(() =>
    targets.value
      .map((item) => markKey(item.source, item.id))
      .toSorted()
      .join('|'),
  );

  watch(requestKey, () => void load(), { immediate: true });

  async function load(): Promise<void> {
    const groups = new Map<PlaceSource, string[]>();
    for (const item of targets.value) {
      const list = groups.get(item.source) ?? [];
      if (!list.includes(item.id)) list.push(item.id);
      groups.set(item.source, list);
    }
    if (groups.size === 0) {
      counts.value = {};
      saved.value = new Set();
      return;
    }
    try {
      const parts = await Promise.all(
        [...groups].map(async ([source, ids]) => {
          const summary = await apiFetch<FavoriteSummary>(
            `/${API_ROUTES.FAVORITES}/summary?source=${encodeURIComponent(source)}&ids=${encodeURIComponent(ids.join(','))}`,
          );
          return { source, ids, summary };
        }),
      );
      const nextCounts: Record<string, number> = {};
      const nextSaved = new Set<string>();
      for (const part of parts) {
        for (const id of part.ids)
          nextCounts[markKey(part.source, id)] = part.summary.counts[id] ?? 0;
        for (const id of part.summary.saved) nextSaved.add(markKey(part.source, id));
      }
      counts.value = nextCounts;
      saved.value = nextSaved;
    } catch {
      return;
    }
  }

  function countOf(source: PlaceSource, id: string): number | null {
    const key = markKey(source, id);
    return Object.hasOwn(counts.value, key) ? counts.value[key] : null;
  }

  function isSaved(source: PlaceSource, id: string): boolean {
    return saved.value.has(markKey(source, id));
  }

  function isBusy(source: PlaceSource, id: string): boolean {
    return busyKey.value === markKey(source, id);
  }

  async function toggle(target: FavoriteTargetView): Promise<void> {
    if (!session.value.data) return;
    const key = markKey(target.source, target.id);
    if (busyKey.value === key) return;
    busyKey.value = key;
    const wasSaved = saved.value.has(key);
    try {
      if (wasSaved) {
        await apiFetch<void>(
          `/${API_ROUTES.FAVORITES}/${encodeURIComponent(target.source)}/${encodeURIComponent(target.id)}`,
          { method: 'DELETE' },
        );
      } else {
        await apiFetch<FavoriteItem>(`/${API_ROUTES.FAVORITES}`, {
          method: 'PUT',
          body: JSON.stringify({
            source: target.source,
            placeId: target.id,
            name: target.name,
            kind: target.kind,
          }),
        });
      }
      await load();
    } catch {
      return;
    } finally {
      busyKey.value = null;
    }
  }

  return { session, countOf, isSaved, isBusy, toggle };
}
