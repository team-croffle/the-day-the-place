<script setup lang="ts">
import { PLACE_KIND_LABELS, type PlaceKind, type PlaceSummary } from '@nest-vue/shared';
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import { isKakaoMapsReady } from '@/lib/kakaoMap';
import { placeDetailPath } from '@/lib/placePath';
import type { KakaoMapInstance } from '@/types/kakao';

const PIN_H = 32;
const MAP_EVENTS = ['center_changed', 'idle', 'zoom_changed'] as const;

const props = defineProps<{
  map: KakaoMapInstance | null;
  place: PlaceSummary;
}>();

const { locale } = useI18n();
const pos = ref<{ x: number; y: number } | null>(null);

function kindLabel(kind: PlaceKind): string {
  return PLACE_KIND_LABELS[kind][locale.value === 'en' ? 'en' : 'ko'];
}

function update(): void {
  const map = props.map;
  const maps = window.kakao?.maps;
  if (!map || !isKakaoMapsReady(maps)) {
    pos.value = null;
    return;
  }
  const point = map
    .getProjection()
    .containerPointFromCoords(new maps.LatLng(props.place.lat, props.place.lng));
  pos.value = { x: point.x, y: point.y - PIN_H };
}

function bind(map: KakaoMapInstance | null): void {
  const maps = window.kakao?.maps;
  if (!isKakaoMapsReady(maps)) {
    return;
  }
  for (const type of MAP_EVENTS) {
    if (map) {
      maps.event.addListener(map, type, update);
    }
  }
}

function unbind(map: KakaoMapInstance | null): void {
  const maps = window.kakao?.maps;
  if (!isKakaoMapsReady(maps) || !map) {
    return;
  }
  for (const type of MAP_EVENTS) {
    maps.event.removeListener(map, type, update);
  }
}

watch(
  () => [props.map, props.place.globalId] as const,
  ([map], prev) => {
    unbind(prev?.[0] ?? null);
    bind(map);
    update();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  unbind(props.map);
});
</script>

<template>
  <div
    v-if="pos"
    class="border-line bg-paper absolute z-10 w-52 -translate-x-1/2 -translate-y-full overflow-hidden rounded-sm border shadow-sm"
    :style="{ left: `${pos.x}px`, top: `${pos.y - 8}px` }"
  >
    <div class="bg-line h-24 overflow-hidden">
      <img v-if="place.image" :src="place.image" :alt="''" class="h-full w-full object-cover" />
    </div>
    <div class="px-3 py-2">
      <p class="text-gold text-[11px]">
        {{ kindLabel(place.kind) }}
        <span v-if="place.category !== kindLabel(place.kind)"> · {{ place.category }}</span>
      </p>
      <RouterLink
        :to="placeDetailPath(place.kind, place.id)"
        class="mt-0.5 block truncate text-sm font-semibold hover:underline"
      >
        {{ place.name }}
      </RouterLink>
    </div>
  </div>
</template>
