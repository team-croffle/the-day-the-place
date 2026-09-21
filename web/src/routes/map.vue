<script setup lang="ts">
import type { MapPlacesQuery, PlaceKind, PlaceSummary } from '@nest-vue/shared';
import { computed, markRaw, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import KakaoMap from '@/components/map/KakaoMap.vue';
import MapSidebar from '@/components/map/MapSidebar.vue';
import PlaceMarkers from '@/components/map/PlaceMarkers.vue';
import { resolveMapCenter, SEOUL_CENTER } from '@/composables/useGeolocation';
import { useMapPlaces } from '@/composables/useMapPlaces';
import { MAP_REGION_VIEWS, placeInBbox, placeInRegion, placeMatchesQuery } from '@/lib/mapRegion';
import type { KakaoMapInstance } from '@/types/kakao';

const { t } = useI18n();
const { places, error, pending, fetchAll } = useMapPlaces();

const center = ref(SEOUL_CENTER);
const centerReady = ref(false);
const mapInstance = shallowRef<KakaoMapInstance | null>(null);
const sdkError = ref<string | null>(null);
const zoomLevel = ref(7);
const viewBbox = ref<MapPlacesQuery | null>(null);
const query = ref('');
const region = ref('all');
const kinds = ref<Record<PlaceKind, boolean>>({ museum: true, site: true });
const selectedId = ref<string | null>(null);

/** 완전 축소보다 두 단계 확대한 레벨부터 핀을 숨긴다. */
const HIDE_MARKERS_FROM_LEVEL = 12;
const markersHidden = computed(() => zoomLevel.value >= HIDE_MARKERS_FROM_LEVEL);

const filteredPlaces = computed(() =>
  places.value.filter(
    (place) =>
      kinds.value[place.kind] &&
      placeInRegion(place, region.value) &&
      placeMatchesQuery(place, query.value),
  ),
);

const listPlaces = computed(() => {
  const bbox = viewBbox.value;
  if (!bbox || markersHidden.value) {
    return [];
  }
  return filteredPlaces.value.filter((place) => placeInBbox(place, bbox));
});

onMounted(async () => {
  void fetchAll();
  center.value = await resolveMapCenter();
  centerReady.value = true;
});

watch(region, (code) => {
  const view = MAP_REGION_VIEWS[code];
  if (!view) {
    return;
  }
  center.value = { lat: view.lat, lng: view.lng };
  mapInstance.value?.setLevel(view.level);
  zoomLevel.value = view.level;
});

function onReady(map: KakaoMapInstance): void {
  mapInstance.value = markRaw(map);
  zoomLevel.value = map.getLevel();
}

function onIdle(view: { bbox: MapPlacesQuery; level: number }): void {
  viewBbox.value = view.bbox;
  zoomLevel.value = view.level;
}

function onZoom(level: number): void {
  zoomLevel.value = level;
}

function onSdkError(code: string): void {
  sdkError.value = code;
}

function onSelect(place: PlaceSummary): void {
  selectedId.value = place.globalId;
  center.value = { lat: place.lat, lng: place.lng };
  const map = mapInstance.value;
  const maps = window.kakao?.maps;
  if (map && maps) {
    map.setLevel(5);
    map.setCenter(new maps.LatLng(place.lat, place.lng));
    zoomLevel.value = 5;
  }
}
</script>

<template>
  <div class="bg-line absolute inset-0 flex">
    <MapSidebar
      v-model:query="query"
      v-model:region="region"
      v-model:kinds="kinds"
      :items="listPlaces"
      :count="listPlaces.length"
      :selected-id="selectedId"
      :zoomed-out="markersHidden"
      @select="onSelect"
    />
    <div class="relative min-w-0 flex-1">
      <KakaoMap
        v-if="centerReady"
        :lat="center.lat"
        :lng="center.lng"
        class="h-full w-full"
        @ready="onReady"
        @idle="onIdle"
        @zoom="onZoom"
        @error="onSdkError"
      />
      <PlaceMarkers :map="mapInstance" :places="filteredPlaces" :hidden="markersHidden" />

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
  </div>
</template>
