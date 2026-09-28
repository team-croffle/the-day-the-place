<script setup lang="ts">
import type { MapPlacesQuery, PlaceKind, PlaceSummary } from '@nest-vue/shared';
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import KakaoMap from '@/components/map/KakaoMap.vue';
import MapPinPopup from '@/components/map/MapPinPopup.vue';
import MapPreview from '@/components/map/MapPreview.vue';
import MapSidebar from '@/components/map/MapSidebar.vue';
import PlaceMarkers from '@/components/map/PlaceMarkers.vue';
import { resolveMapCenter, SEOUL_CENTER } from '@/composables/useGeolocation';
import { useMapPlaces } from '@/composables/useMapPlaces';
import { isKakaoMapsReady } from '@/lib/kakaoMap';
import { MAP_REGION_VIEWS, nearestPlaces, placeInRegion, placeMatchesQuery } from '@/lib/mapRegion';
import type { KakaoMapInstance } from '@/types/kakao';

const { t } = useI18n();
const { places, error, pending, fetchAll } = useMapPlaces();

const center = ref(SEOUL_CENTER);
const mapInstance = shallowRef<KakaoMapInstance | null>(null);
const sdkError = ref<string | null>(null);
const zoomLevel = ref(7);
const query = ref('');
const queryForFilter = ref('');
const region = ref('all');
const kinds = ref<Record<PlaceKind, boolean>>({ museum: true, site: true });
const selectedId = ref<string | null>(null);
const hasQuery = computed(() => queryForFilter.value.trim().length > 0);

/** 완전 축소보다 두 단계 확대한 레벨부터 핀을 숨긴다. */
const HIDE_MARKERS_FROM_LEVEL = 12;
const markersHidden = computed(() => zoomLevel.value >= HIDE_MARKERS_FROM_LEVEL);

const filteredPlaces = computed(() =>
  places.value.filter(
    (place) =>
      kinds.value[place.kind] &&
      placeInRegion(place, region.value) &&
      placeMatchesQuery(place, queryForFilter.value),
  ),
);

const selectedPlace = computed(
  () => filteredPlaces.value.find((place) => place.globalId === selectedId.value) ?? null,
);

const nearbyPlaces = computed(() => {
  const origin = selectedPlace.value;
  if (!origin) {
    return [];
  }
  const pool = places.value.filter((place) => kinds.value[place.kind]);
  return nearestPlaces(origin, pool, 3);
});

const markerPlaces = computed(() => {
  if (selectedPlace.value) {
    return [selectedPlace.value];
  }
  if (hasQuery.value) {
    return [];
  }
  return filteredPlaces.value;
});

onMounted(async () => {
  void fetchAll();
  center.value = await resolveMapCenter();
});

let queryTimer: ReturnType<typeof setTimeout> | null = null;

onBeforeUnmount(() => {
  if (queryTimer) {
    clearTimeout(queryTimer);
    queryTimer = null;
  }
});

watch(query, (value) => {
  selectedId.value = null;
  if (queryTimer) {
    clearTimeout(queryTimer);
  }
  queryTimer = setTimeout(() => {
    queryForFilter.value = value;
    queryTimer = null;
  }, 180);
});

watch(filteredPlaces, (list) => {
  if (selectedId.value && !list.some((place) => place.globalId === selectedId.value)) {
    selectedId.value = null;
  }
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
  sdkError.value = null;
  mapInstance.value = markRaw(map);
  zoomLevel.value = map.getLevel();
}

function onIdle(view: { bbox: MapPlacesQuery; level: number }): void {
  zoomLevel.value = view.level;
}

function onZoom(level: number): void {
  zoomLevel.value = level;
}

function onSdkError(code: string): void {
  sdkError.value = code;
}

function placeInView(place: PlaceSummary): boolean {
  const map = mapInstance.value;
  if (!map) {
    return false;
  }
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return (
    place.lat >= sw.getLat() &&
    place.lat <= ne.getLat() &&
    place.lng >= sw.getLng() &&
    place.lng <= ne.getLng()
  );
}

function onSelectFromPin(place: PlaceSummary): void {
  selectedId.value = place.globalId;
}

function onSelectFromList(place: PlaceSummary): void {
  selectedId.value = place.globalId;
  if (placeInView(place)) {
    return;
  }
  const map = mapInstance.value;
  const maps = window.kakao?.maps;
  if (!map || !isKakaoMapsReady(maps)) {
    return;
  }
  map.setCenter(new maps.LatLng(place.lat, place.lng));
}

function onClearSelect(): void {
  selectedId.value = null;
}
</script>

<template>
  <div class="bg-line absolute inset-0 flex min-h-0">
    <MapSidebar
      v-model:query="query"
      v-model:region="region"
      v-model:kinds="kinds"
      :items="filteredPlaces"
      :count="filteredPlaces.length"
      :selected-id="selectedId"
      :searching="hasQuery"
      @select="onSelectFromList"
    />
    <div class="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <KakaoMap
        :lat="center.lat"
        :lng="center.lng"
        @ready="onReady"
        @idle="onIdle"
        @zoom="onZoom"
        @error="onSdkError"
      />
      <PlaceMarkers
        :map="mapInstance"
        :places="markerPlaces"
        :hidden="markersHidden && !selectedPlace"
        @select="onSelectFromPin"
        @clear="onClearSelect"
      />
      <MapPinPopup v-if="selectedPlace && mapInstance" :map="mapInstance" :place="selectedPlace" />

      <p
        v-if="sdkError"
        class="bg-cream/90 text-muted absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-sm"
      >
        {{ sdkError === 'missing_key' ? t('map.missingKey') : t('map.sdkError') }}
      </p>
      <p
        v-else-if="!mapInstance"
        class="bg-cream/90 text-muted pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-sm"
      >
        {{ t('map.mapLoading') }}
      </p>
      <p
        v-else-if="error"
        class="bg-ink text-paper pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-sm px-3 py-2 text-xs"
      >
        {{ t('map.fetchError') }}
      </p>
      <p
        v-else-if="pending && places.length === 0"
        class="bg-ink/80 text-paper pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-sm px-3 py-2 text-xs"
      >
        {{ t('map.loading') }}
      </p>
    </div>
    <Transition name="map-preview">
      <div v-if="selectedPlace" class="map-preview-shell h-full shrink-0 overflow-hidden">
        <MapPreview
          :place="selectedPlace"
          :nearby="nearbyPlaces"
          @close="onClearSelect"
          @select="onSelectFromPin"
        />
      </div>
    </Transition>
  </div>
</template>
