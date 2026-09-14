<script setup lang="ts">
import { computed, markRaw, onMounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import KakaoMap from '@/components/map/KakaoMap.vue';
import PlaceMarkers from '@/components/map/PlaceMarkers.vue';
import { resolveMapCenter, SEOUL_CENTER } from '@/composables/useGeolocation';
import { useMapPlaces } from '@/composables/useMapPlaces';
import type { KakaoMapInstance } from '@/types/kakao';

const { t } = useI18n();
const { places, error, pending, fetchAll } = useMapPlaces();

const center = ref(SEOUL_CENTER);
const centerReady = ref(false);
const mapInstance = shallowRef<KakaoMapInstance | null>(null);
const sdkError = ref<string | null>(null);
const zoomLevel = ref(7);

/** 완전 축소보다 두 단계 확대한 레벨부터 핀을 숨긴다. */
const HIDE_MARKERS_FROM_LEVEL = 12;
const markersHidden = computed(() => zoomLevel.value >= HIDE_MARKERS_FROM_LEVEL);

onMounted(async () => {
  void fetchAll();
  center.value = await resolveMapCenter();
  centerReady.value = true;
});

function onReady(map: KakaoMapInstance): void {
  mapInstance.value = markRaw(map);
  zoomLevel.value = map.getLevel();
}

function onZoom(level: number): void {
  zoomLevel.value = level;
}

function onSdkError(code: string): void {
  sdkError.value = code;
}
</script>

<template>
  <div class="bg-line absolute inset-0">
    <KakaoMap
      v-if="centerReady"
      :lat="center.lat"
      :lng="center.lng"
      class="h-full w-full"
      @ready="onReady"
      @zoom="onZoom"
      @error="onSdkError"
    />
    <PlaceMarkers :map="mapInstance" :places="places" :hidden="markersHidden" />

    <p
      v-if="sdkError"
      class="bg-cream/90 text-muted absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-sm"
    >
      {{ sdkError === 'missing_key' ? t('map.missingKey') : t('map.sdkError') }}
    </p>
    <p
      v-else-if="error"
      class="bg-ink text-paper pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-sm px-3 py-2 text-xs"
    >
      {{ t('map.fetchError') }}
    </p>
    <p
      v-else-if="!centerReady || (pending && places.length === 0)"
      class="bg-ink/80 text-paper pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-sm px-3 py-2 text-xs"
    >
      {{ t('map.loading') }}
    </p>
  </div>
</template>
