import {
  API_ROUTES,
  type PlaceKind,
  type PlaceSearchResult,
  type PlaceSummary,
} from '@nest-vue/shared';
import { computed, onMounted, ref, watch } from 'vue';

import { apiFetch } from '@/composables/useApi';

const PAGE_SIZE = 12;

export function usePlaceList(kind: PlaceKind) {
  const q = ref('');
  const region = ref('all');
  const category = ref('');
  const page = ref(1);
  const result = ref<Extract<PlaceSearchResult, { ok: true }> | null>(null);
  const error = ref<string | null>(null);
  const pending = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  async function load(): Promise<void> {
    const current = ++requestId;
    pending.value = true;
    error.value = null;
    const params = new URLSearchParams({
      kind,
      page: String(page.value),
      size: String(PAGE_SIZE),
    });
    const query = q.value.trim();
    if (query) {
      params.set('q', query);
    }
    if (region.value !== 'all') {
      params.set('region', region.value);
    }
    if (category.value) {
      params.set('category', category.value);
    }

    try {
      const data = await apiFetch<PlaceSearchResult>(`/${API_ROUTES.PLACES_SEARCH}?${params}`);
      if (current !== requestId) {
        return;
      }
      if (!data.ok) {
        result.value = null;
        error.value = data.error;
        return;
      }
      result.value = data;
    } catch (cause) {
      if (current !== requestId) {
        return;
      }
      result.value = null;
      error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (current === requestId) {
        pending.value = false;
      }
    }
  }

  function reloadFromFirstPage(): void {
    if (page.value !== 1) {
      page.value = 1;
      return;
    }
    void load();
  }

  watch(q, () => {
    clearTimeout(timer);
    timer = setTimeout(reloadFromFirstPage, 180);
  });

  watch([region, category], () => {
    clearTimeout(timer);
    reloadFromFirstPage();
  });

  watch(page, () => {
    void load();
  });

  onMounted(() => {
    void load();
  });

  const items = computed<PlaceSummary[]>(() => result.value?.items ?? []);

  return { q, region, category, page, result, items, error, pending };
}
