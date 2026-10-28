<script setup lang="ts">
import {
  API_ROUTES,
  MAP_REGION_CHIPS,
  type MapPlacesQuery,
  type Paginated,
  type PlaceKind,
  type PlaceSummary,
  type RelicSearchHit,
} from '@nest-vue/shared';
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import KakaoMap from '@/components/map/KakaoMap.vue';
import MapPinPopup from '@/components/map/MapPinPopup.vue';
import MapPreview from '@/components/map/MapPreview.vue';
import MapSidebar from '@/components/map/MapSidebar.vue';
import PlaceMarkers from '@/components/map/PlaceMarkers.vue';
import { apiFetch } from '@/composables/useApi';
import { useFavoriteMarks, type FavoriteTargetView } from '@/composables/useFavoriteMarks';
import { resolveMapCenter, SEOUL_CENTER } from '@/composables/useGeolocation';
import { useMapPlaces } from '@/composables/useMapPlaces';
import { isKakaoMapsReady } from '@/lib/kakaoMap';
import { MAP_REGION_VIEWS, nearestPlaces, placeInRegion, placeMatchesQuery } from '@/lib/mapRegion';
import type { KakaoMapInstance } from '@/types/kakao';

const { t } = useI18n();
const route = useRoute();
const { places, error, pending, fetchAll } = useMapPlaces();

function textQuery(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim().slice(0, 80) : '';
}

const initialQuery = textQuery(route.query.q);
const regionCode = textQuery(route.query.region);
const initialRegion = MAP_REGION_CHIPS.some((chip) => chip.code === regionCode)
  ? regionCode
  : 'all';

const center = ref(SEOUL_CENTER);
const mapInstance = shallowRef<KakaoMapInstance | null>(null);
const sdkError = ref<string | null>(null);
const zoomLevel = ref(7);
const query = ref(initialQuery);
const queryForFilter = ref(initialQuery);
const region = ref(initialRegion);
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

const favoriteTargets = computed<FavoriteTargetView[]>(() => {
  const place = selectedPlace.value;
  if (!place) return [];
  return [{ source: place.source, id: place.id, name: place.name, kind: place.kind }];
});
const favorites = useFavoriteMarks(favoriteTargets);

function toggleSelectedFavorite(): void {
  const target = favoriteTargets.value[0];
  if (target) void favorites.toggle(target);
}

const relicQuery = ref('');
const relicHits = ref<Paginated<RelicSearchHit> | null>(null);
const relicHitsError = ref<string | null>(null);
const relicHitsPending = ref(false);
let relicRequest = 0;

const markerPlaces = computed(() => {
  if (selectedPlace.value) {
    return [selectedPlace.value];
  }
  if (hasQuery.value) {
    return [];
  }
  return filteredPlaces.value;
});

async function loadRelicHits(name: string, page = 1): Promise<void> {
  const request = ++relicRequest;
  const queryName = name.trim();
  if (!queryName) {
    relicHits.value = null;
    relicHitsError.value = null;
    relicHitsPending.value = false;
    return;
  }
  relicHitsPending.value = true;
  relicHitsError.value = null;
  try {
    const params = new URLSearchParams({ q: queryName, page: String(page) });
    const pageResult = await apiFetch<Paginated<RelicSearchHit>>(
      `/${API_ROUTES.PLACES}/relics?${params}`,
    );
    if (request !== relicRequest) {
      return;
    }
    relicHits.value = pageResult;
  } catch (cause) {
    if (request !== relicRequest) {
      return;
    }
    relicHits.value = null;
    relicHitsError.value = cause instanceof Error ? cause.message : t('map.relicsError');
  } finally {
    if (request === relicRequest) {
      relicHitsPending.value = false;
    }
  }
}

function onRelicSearch(name: string): void {
  relicQuery.value = name.trim().slice(0, 40);
  void loadRelicHits(relicQuery.value, 1);
}

onMounted(async () => {
  void fetchAll();
  if (region.value !== 'all') {
    return;
  }
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

function applyRegionView(code: string): void {
  const view = MAP_REGION_VIEWS[code];
  if (!view) {
    return;
  }
  center.value = { lat: view.lat, lng: view.lng };
  mapInstance.value?.setLevel(view.level);
  zoomLevel.value = view.level;
}

applyRegionView(region.value);

watch(region, applyRegionView);

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
      :relics="relicHits"
      :relics-pending="relicHitsPending"
      :relics-error="relicHitsError"
      :museums="places"
      :relic-query="relicQuery"
      @select="onSelectFromList"
      @relic-search="onRelicSearch"
      @relic-page="loadRelicHits(relicQuery, $event)"
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
          :count="favorites.countOf(selectedPlace.source, selectedPlace.id)"
          :saved="favorites.isSaved(selectedPlace.source, selectedPlace.id)"
          :logged-in="Boolean(favorites.session.value.data)"
          :session-pending="favorites.session.value.isPending"
          :busy="favorites.isBusy(selectedPlace.source, selectedPlace.id)"
          @close="onClearSelect"
          @select="onSelectFromPin"
          @toggle-favorite="toggleSelectedFavorite"
        />
      </div>
    </Transition>
  </div>
</template>
