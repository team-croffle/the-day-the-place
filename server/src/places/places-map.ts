import type {
  MapPlacesQuery,
  MapPlacesResponse,
  PlaceSourceResult,
  PlaceSummary,
} from '@nest-vue/shared';

export const HERITAGE_MAP_SKIPPED: PlaceSourceResult = {
  ok: false,
  error: 'not_requested',
  items: null,
};

export async function fetchMapPlaces(
  query: MapPlacesQuery,
  listTour: (q: MapPlacesQuery) => Promise<PlaceSummary[]>,
): Promise<MapPlacesResponse> {
  try {
    const items = await listTour(query);
    return {
      tour: { ok: true, items },
      heritage: HERITAGE_MAP_SKIPPED,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TourAPI request failed';
    return {
      tour: { ok: false, error: message, items: null },
      heritage: HERITAGE_MAP_SKIPPED,
    };
  }
}
