<script setup lang="ts">
import type { MapPlacesQuery } from '@nest-vue/shared';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { loadKakaoMaps } from '@/lib/kakaoMap';
import type { KakaoMapInstance, KakaoMapsNamespace } from '@/types/kakao';

const props = withDefaults(
  defineProps<{
    lat: number;
    lng: number;
    level?: number;
  }>(),
  { level: 7 },
);

const emit = defineEmits<{
  ready: [map: KakaoMapInstance];
  idle: [view: { bbox: MapPlacesQuery; level: number }];
  zoom: [level: number];
  error: [code: string];
}>();

const container = ref<HTMLElement | null>(null);
let maps: KakaoMapsNamespace | null = null;
let map: KakaoMapInstance | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function readView(): { bbox: MapPlacesQuery; level: number } | null {
  if (!map) {
    return null;
  }
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return {
    bbox: { swLat: sw.getLat(), swLng: sw.getLng(), neLat: ne.getLat(), neLng: ne.getLng() },
    level: map.getLevel(),
  };
}

function onIdle(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  idleTimer = setTimeout(() => {
    const view = readView();
    if (view) {
      emit('idle', view);
    }
  }, 400);
}

function onZoomChanged(): void {
  if (!map) {
    return;
  }
  emit('zoom', map.getLevel());
}

onMounted(async () => {
  if (!container.value) {
    return;
  }
  try {
    maps = await loadKakaoMaps();
  } catch (cause) {
    emit('error', cause instanceof Error ? cause.message : 'sdk_load_failed');
    return;
  }

  const center = new maps.LatLng(props.lat, props.lng);
  map = new maps.Map(container.value, { center, level: props.level });
  maps.event.addListener(map, 'idle', onIdle);
  maps.event.addListener(map, 'zoom_changed', onZoomChanged);
  emit('ready', map);
  requestAnimationFrame(() => {
    map?.relayout();
    requestAnimationFrame(onIdle);
  });
});

watch(
  () => [props.lat, props.lng] as const,
  ([lat, lng]) => {
    if (!map || !maps) {
      return;
    }
    map.setCenter(new maps.LatLng(lat, lng));
  },
);

onBeforeUnmount(() => {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  if (map && maps) {
    maps.event.removeListener(map, 'idle', onIdle);
    maps.event.removeListener(map, 'zoom_changed', onZoomChanged);
  }
});
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
