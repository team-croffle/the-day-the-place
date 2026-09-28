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
let resizeObserver: ResizeObserver | null = null;

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

function measureHost(): { width: number; height: number } {
  const pane = container.value?.parentElement;
  const width =
    pane && pane.clientWidth > 0 ? pane.clientWidth : Math.max(window.innerWidth - 320, 1);
  let height = pane?.clientHeight ?? 0;
  if (height < 1) {
    let node: HTMLElement | null = pane?.parentElement ?? null;
    while (node && height < 1) {
      height = node.clientHeight;
      node = node.parentElement;
    }
  }
  if (height < 1) {
    height = Math.max(window.innerHeight - 64, 1);
  }
  return { width, height };
}

function syncBox(): boolean {
  const el = container.value;
  if (!el) {
    return false;
  }
  const box = measureHost();
  el.style.width = `${box.width}px`;
  el.style.height = `${box.height}px`;
  return true;
}

function createMap(): void {
  const el = container.value;
  if (map || !maps || !el || !syncBox()) {
    return;
  }
  const center = new maps.LatLng(props.lat, props.lng);
  map = new maps.Map(el, { center, level: props.level });
  maps.event.addListener(map, 'idle', onIdle);
  maps.event.addListener(map, 'zoom_changed', onZoomChanged);
  emit('ready', map);
  map.relayout();
  requestAnimationFrame(onIdle);
}

let relayoutRaf = 0;

function scheduleRelayout(): void {
  if (relayoutRaf) {
    return;
  }
  relayoutRaf = requestAnimationFrame(() => {
    relayoutRaf = 0;
    if (!map) {
      createMap();
      return;
    }
    if (syncBox()) {
      map.relayout();
    }
  });
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

  const pane = container.value.parentElement;
  const row = pane?.parentElement;
  resizeObserver = new ResizeObserver(() => {
    scheduleRelayout();
  });
  if (pane) {
    resizeObserver.observe(pane);
  }
  if (row) {
    resizeObserver.observe(row);
  }
  createMap();
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
  if (relayoutRaf) {
    cancelAnimationFrame(relayoutRaf);
    relayoutRaf = 0;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (map && maps) {
    maps.event.removeListener(map, 'idle', onIdle);
    maps.event.removeListener(map, 'zoom_changed', onZoomChanged);
  }
});
</script>

<template>
  <div ref="container" class="h-full w-full" />
</template>
