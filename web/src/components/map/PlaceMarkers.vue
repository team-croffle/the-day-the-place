<script setup lang="ts">
import type { PlaceKind, PlaceSummary } from '@nest-vue/shared';
import { onBeforeUnmount, toRaw, watch } from 'vue';

import type { KakaoLatLng, KakaoMapInstance, KakaoMapsNamespace } from '@/types/kakao';

const PIN_W = 24;
const PIN_H = 32;
const COLORS: Record<PlaceKind, string> = {
  museum: '#1c1917',
  site: '#6b4f2a',
};

const MAP_EVENTS = ['center_changed', 'idle'] as const;

/** 카카오 타일 줌 애니메이션 길이. 그 사이 배율은 (1-u)^2 로 1에 수렴한다. */
const ZOOM_ANIM_MS = 300;
/** 카카오 기본 타일 크기. 줌 중에는 이 이미지를 늘렸다 줄여서 화면을 키운다. */
const TILE_PX = 256;

const props = defineProps<{
  map: KakaoMapInstance | null;
  places: PlaceSummary[];
  hidden?: boolean;
}>();

type Pin = { latlng: KakaoLatLng; kind: PlaceKind };
type ScreenPin = { x: number; y: number; kind: PlaceKind };

/** 줌 중에는 지도 투영이 이미 최종값이라, 최종 좌표를 기준점 기준으로 되돌려 그린다. */
type ZoomAnim = {
  startedAt: number;
  level: number;
  ref: KakaoLatLng;
  anchor: { x: number; y: number } | null;
  scale0: number;
  scale: number;
  pins: ScreenPin[] | null;
  widths: number[];
};

const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:2;pointer-events:none;';

const PIN_PATH = new Path2D(
  'M12 0C5.4 0 0 5.2 0 11.6 0 20.4 12 32 12 32s12-11.6 12-20.4C24 5.2 18.6 0 12 0z',
);

let pins: Pin[] = [];
let mapsRef: KakaoMapsNamespace | null = null;
let mapRef: KakaoMapInstance | null = null;
let raf = 0;
let zoomRaf = 0;
let zoomAnim: ZoomAnim | null = null;
let resizeObserver: ResizeObserver | null = null;

function schedulePaint(): void {
  if (raf || zoomRaf) {
    return;
  }
  raf = requestAnimationFrame(() => {
    raf = 0;
    paint();
  });
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.save();
  ctx.translate(x - PIN_W / 2, y - PIN_H);
  ctx.fillStyle = color;
  // CanvasRenderingContext2D.fill(Path2D). oxlint는 Array#fill 로 본다.
  // oxlint-disable-next-line unicorn/no-array-fill-with-reference-type
  ctx.fill(PIN_PATH);
  ctx.fillStyle = '#faf7f2';
  ctx.beginPath();
  ctx.arc(PIN_W / 2, 12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function screenPins(map: KakaoMapInstance): ScreenPin[] {
  const projection = map.getProjection();
  return pins.map((pin) => {
    const point = projection.containerPointFromCoords(pin.latlng);
    return { x: point.x, y: point.y, kind: pin.kind };
  });
}

function paint(): void {
  const map = mapRef;
  if (!map) {
    return;
  }

  const node = map.getNode();
  const width = node.clientWidth;
  const height = node.clientHeight;
  if (width < 1 || height < 1) {
    return;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const dpr = window.devicePixelRatio || 1;
  const pixelW = Math.max(1, Math.round(width * dpr));
  const pixelH = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelW || canvas.height !== pixelH) {
    canvas.width = pixelW;
    canvas.height = pixelH;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (props.hidden || pins.length === 0) {
    return;
  }

  const anim = zoomAnim;
  const anchor = anim?.anchor;
  const scale = anim?.scale ?? 1;
  const drawn = anim?.pins && anchor ? anim.pins : screenPins(map);
  const padX = PIN_W;
  const padY = PIN_H;
  for (const pin of drawn) {
    const x = anchor ? anchor.x + (pin.x - anchor.x) * scale : pin.x;
    const y = anchor ? anchor.y + (pin.y - anchor.y) * scale : pin.y;
    if (x < -padX || y < -padY || x > width + padX || y > height + padY) {
      continue;
    }
    drawPin(ctx, x, y, COLORS[pin.kind]);
  }
}

/**
 * 줌 시작 화면과 최종 화면은 한 지점을 축으로 하는 확대·축소 관계다.
 * 배율은 레벨 차이에서 정확히 나오고, 축은 시작 때 화면 왼쪽 위였던 좌표가
 * 어디로 갔는지만 보면 풀린다.
 */
function resolveZoomAnchor(anim: ZoomAnim, map: KakaoMapInstance): boolean {
  const level = map.getLevel();
  if (level === anim.level) {
    return false;
  }
  const ratio = 2 ** (anim.level - level);
  const moved = map.getProjection().containerPointFromCoords(anim.ref);
  anim.anchor = { x: moved.x / (1 - ratio), y: moved.y / (1 - ratio) };
  anim.scale0 = 1 / ratio;
  anim.scale = anim.scale0;
  anim.pins = screenPins(map);
  return true;
}

function tileWidths(map: KakaoMapInstance): number[] {
  const holder = map.getNode().firstElementChild?.firstElementChild;
  if (!holder) {
    return [];
  }
  return [...holder.children].map((layer) => {
    const tile = layer.firstElementChild;
    return tile instanceof HTMLImageElement ? tile.getBoundingClientRect().width : 0;
  });
}

/**
 * 타일 너비가 지금 화면 배율이다. 이번 프레임에 크기가 바뀐 층만 보고,
 * 1 쪽으로 가는 값만 받는다. 못 읽으면 곡선으로 대신 그린다.
 */
function measuredScale(anim: ZoomAnim, widths: number[]): number | null {
  const target = TILE_PX / anim.scale0;
  const zoomingOut = anim.scale0 > 1;
  for (const [index, width] of widths.entries()) {
    if (width < 1 || width === anim.widths[index]) {
      continue;
    }
    const scale = width / target;
    const moved = zoomingOut ? scale <= anim.scale + 0.01 : scale >= anim.scale - 0.01;
    const inRange = zoomingOut ? scale >= 1 : scale <= 1;
    if (moved && inRange) {
      return scale;
    }
  }
  return null;
}

function zoomFrame(): void {
  zoomRaf = 0;
  const anim = zoomAnim;
  const map = mapRef;
  if (!anim || !map) {
    return;
  }

  const elapsed = performance.now() - anim.startedAt;
  if (!anim.anchor && !resolveZoomAnchor(anim, map)) {
    // 아직 투영이 새 레벨로 안 바뀌었다. 애니메이션 시간을 넘기면 그냥 최종 위치로 둔다.
    if (elapsed < ZOOM_ANIM_MS) {
      zoomRaf = requestAnimationFrame(zoomFrame);
      return;
    }
    endZoom();
    return;
  }

  const widths = tileWidths(map);
  const measured = measuredScale(anim, widths);
  anim.widths = widths;

  const rest = Math.max(0, 1 - elapsed / ZOOM_ANIM_MS);
  anim.scale = measured ?? 1 + (anim.scale0 - 1) * rest * rest;
  paint();
  if (rest > 0) {
    zoomRaf = requestAnimationFrame(zoomFrame);
    return;
  }
  endZoom();
}

function onZoomStart(): void {
  const map = mapRef;
  const maps = mapsRef;
  if (!map || !maps) {
    return;
  }
  // 이 시점의 투영은 아직 이전 레벨이다. 화면 왼쪽 위 좌표와 레벨을 기억해 둔다.
  zoomAnim = {
    startedAt: performance.now(),
    level: map.getLevel(),
    ref: map.getProjection().coordsFromContainerPoint(new maps.Point(0, 0)),
    anchor: null,
    scale0: 1,
    scale: 1,
    pins: null,
    widths: [],
  };
  if (zoomRaf) {
    cancelAnimationFrame(zoomRaf);
  }
  zoomRaf = requestAnimationFrame(zoomFrame);
}

function endZoom(): void {
  if (zoomRaf) {
    cancelAnimationFrame(zoomRaf);
    zoomRaf = 0;
  }
  zoomAnim = null;
  paint();
}

function unbindMap(): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (mapRef && mapsRef) {
    for (const type of MAP_EVENTS) {
      mapsRef.event.removeListener(mapRef, type, schedulePaint);
    }
    mapsRef.event.removeListener(mapRef, 'zoom_start', onZoomStart);
    mapsRef.event.removeListener(mapRef, 'zoom_changed', endZoom);
  }
  canvas.remove();
  mapsRef = null;
  mapRef = null;
}

function bindMap(map: KakaoMapInstance | null): void {
  unbindMap();

  const maps = window.kakao?.maps;
  mapsRef = maps ?? null;
  mapRef = map ? toRaw(map) : null;
  if (!mapRef || !mapsRef) {
    return;
  }

  mapRef.getNode().appendChild(canvas);
  for (const type of MAP_EVENTS) {
    mapsRef.event.addListener(mapRef, type, schedulePaint);
  }
  mapsRef.event.addListener(mapRef, 'zoom_start', onZoomStart);
  mapsRef.event.addListener(mapRef, 'zoom_changed', endZoom);
  resizeObserver = new ResizeObserver(() => schedulePaint());
  resizeObserver.observe(mapRef.getNode());
  // 목록이 카카오 SDK보다 먼저 오면 rebuildPins가 빈 배열로 끝난다. 지도가 붙은 뒤 다시 만든다.
  rebuildPins();
}

function rebuildPins(): void {
  const maps = window.kakao?.maps;
  if (!maps) {
    pins = [];
    schedulePaint();
    return;
  }
  pins = props.places.map((place) => ({
    latlng: new maps.LatLng(place.lat, place.lng),
    kind: place.kind,
  }));
  if (zoomAnim) {
    zoomAnim.pins = mapRef ? screenPins(mapRef) : null;
  }
  schedulePaint();
}

watch(
  () => props.map,
  (map) => bindMap(map),
  { immediate: true },
);

watch(
  () => props.places,
  () => rebuildPins(),
  { immediate: true },
);

watch(
  () => props.hidden,
  () => schedulePaint(),
);

onBeforeUnmount(() => {
  bindMap(null);
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  if (zoomRaf) {
    cancelAnimationFrame(zoomRaf);
    zoomRaf = 0;
  }
  zoomAnim = null;
  pins = [];
});
</script>

<template>
  <span class="hidden" />
</template>
