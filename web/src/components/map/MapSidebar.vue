<script setup lang="ts">
import {
  MAP_REGION_CHIPS,
  PLACE_KIND_LABELS,
  type PlaceKind,
  type PlaceSummary,
} from '@nest-vue/shared';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const ITEM_H = 84;
const OVERSCAN = 8;

const { t, locale } = useI18n();

const kinds = defineModel<{ museum: boolean; site: boolean }>('kinds', { required: true });
const query = defineModel<string>('query', { required: true });
const region = defineModel<string>('region', { required: true });

const props = defineProps<{
  items: PlaceSummary[];
  count: number;
  selectedId: string | null;
  searching: boolean;
}>();

const emit = defineEmits<{
  select: [place: PlaceSummary];
}>();

const scroller = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportH = ref(480);
let resizeObserver: ResizeObserver | null = null;

const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ITEM_H) - OVERSCAN));
const endIndex = computed(() =>
  Math.min(props.items.length, Math.ceil((scrollTop.value + viewportH.value) / ITEM_H) + OVERSCAN),
);
const visibleItems = computed(() => props.items.slice(startIndex.value, endIndex.value));
const padTop = computed(() => startIndex.value * ITEM_H);
const padBottom = computed(() => Math.max(0, (props.items.length - endIndex.value) * ITEM_H));

function kindLabel(kind: PlaceKind): string {
  return PLACE_KIND_LABELS[kind][locale.value === 'en' ? 'en' : 'ko'];
}

function toggleKind(kind: PlaceKind): void {
  kinds.value = { ...kinds.value, [kind]: !kinds.value[kind] };
}

function onScroll(event: Event): void {
  const el = event.currentTarget;
  if (el instanceof HTMLElement) {
    scrollTop.value = el.scrollTop;
  }
}

function syncViewport(): void {
  viewportH.value = scroller.value?.clientHeight ?? 480;
}

watch(
  () => props.items,
  () => {
    scrollTop.value = 0;
    if (scroller.value) {
      scroller.value.scrollTop = 0;
    }
  },
);

onMounted(() => {
  syncViewport();
  if (!scroller.value) {
    return;
  }
  resizeObserver = new ResizeObserver(syncViewport);
  resizeObserver.observe(scroller.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <aside class="border-line bg-paper flex h-full w-80 max-w-[85vw] shrink-0 flex-col border-r">
    <div class="border-line shrink-0 space-y-3 border-b px-4 py-4">
      <p class="text-muted text-[11px] tracking-wide">{{ t('map.exploreEyebrow') }}</p>
      <h1 class="text-xl font-semibold tracking-tight">{{ t('map.exploreTitle') }}</h1>

      <label class="sr-only" for="map-search">{{ t('map.searchPlaceholder') }}</label>
      <input
        id="map-search"
        v-model="query"
        type="search"
        class="border-line placeholder:text-muted focus:border-ink w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none"
        :placeholder="t('map.searchPlaceholder')"
      />

      <div class="grid grid-cols-2 gap-1">
        <button
          type="button"
          class="rounded-sm px-2 py-2 text-sm font-medium"
          :class="kinds.museum ? 'bg-ink text-paper' : 'border-line text-muted border bg-white'"
          :aria-pressed="kinds.museum"
          @click="toggleKind('museum')"
        >
          {{ t('map.kindMuseum') }}
        </button>
        <button
          type="button"
          class="rounded-sm px-2 py-2 text-sm font-medium"
          :class="kinds.site ? 'text-paper bg-[#6b4f2a]' : 'border-line text-muted border bg-white'"
          :aria-pressed="kinds.site"
          @click="toggleKind('site')"
        >
          {{ t('map.kindSite') }}
        </button>
      </div>

      <div>
        <p class="text-muted mb-1.5 text-[11px]">{{ t('map.regionLabel') }}</p>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="chip in MAP_REGION_CHIPS"
            :key="chip.code"
            type="button"
            class="rounded-sm px-2 py-1 text-xs"
            :class="
              region === chip.code
                ? 'bg-ink text-paper'
                : 'border-line text-muted hover:border-ink hover:text-ink border bg-white'
            "
            :aria-pressed="region === chip.code"
            @click="region = chip.code"
          >
            {{ chip.ko }}
          </button>
        </div>
      </div>
    </div>

    <p class="text-muted shrink-0 px-4 py-2 text-xs">
      {{ t('map.showingCount', { n: count }) }}
    </p>

    <ul ref="scroller" class="min-h-0 flex-1 overflow-y-auto" @scroll.passive="onScroll">
      <li v-if="items.length === 0" class="text-muted px-4 py-6 text-sm">
        {{ searching ? t('map.emptySearch') : t('map.emptyList') }}
      </li>
      <template v-else>
        <li v-if="padTop > 0" :style="{ height: `${padTop}px` }" aria-hidden="true" />
        <li v-for="place in visibleItems" :key="place.globalId" :style="{ height: `${ITEM_H}px` }">
          <button
            type="button"
            class="hover:bg-cream flex h-full w-full items-start gap-3 px-4 py-3 text-left"
            :class="{ 'bg-cream': selectedId === place.globalId }"
            @click="emit('select', place)"
          >
            <span
              class="bg-line relative h-14 w-14 shrink-0 overflow-hidden rounded-sm"
              aria-hidden="true"
            >
              <img
                v-if="place.image"
                :src="place.image"
                :alt="''"
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="text-gold block text-[11px]">
                {{ kindLabel(place.kind) }}
                <span v-if="place.category !== kindLabel(place.kind)">
                  · {{ place.category }}
                </span>
              </span>
              <span class="mt-0.5 block truncate text-sm font-semibold">{{ place.name }}</span>
              <span v-if="place.address" class="text-muted mt-0.5 block truncate text-xs">{{
                place.address
              }}</span>
            </span>
          </button>
        </li>
        <li v-if="padBottom > 0" :style="{ height: `${padBottom}px` }" aria-hidden="true" />
      </template>
    </ul>
  </aside>
</template>
