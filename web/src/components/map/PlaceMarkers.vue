<script setup lang="ts">
import type { PlaceKind, PlaceSummary } from '@nest-vue/shared';
import { onBeforeUnmount, toRaw, watch } from 'vue';

import type {
  KakaoAbstractOverlay,
  KakaoLatLng,
  KakaoMapInstance,
  KakaoMapsNamespace,
} from '@/types/kakao';

const PIN_W = 24;
const PIN_H = 32;
const COLORS: Record<PlaceKind, string> = {
  museum: '#1c1917',
  site: '#6b4f2a',
};

const props = defineProps<{
  map: KakaoMapInstance | null;
  places: PlaceSummary[];
  hidden?: boolean;
}>();

type Pin = { latlng: KakaoLatLng; kind: PlaceKind };

const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';

const PIN_PATH = new Path2D(
  'M12 0C5.4 0 0 5.2 0 11.6 0 20.4 12 32 12 32s12-11.6 12-20.4C24 5.2 18.6 0 12 0z',
);

let pins: Pin[] = [];
let mapsRef: KakaoMapsNamespace | null = null;
let mapRef: KakaoMapInstance | null = null;
let overlay: KakaoAbstractOverlay | null = null;
let raf = 0;
let resizeObserver: ResizeObserver | null = null;

function schedulePaint(): void {
  if (raf) {
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

function paint(): void {
  const map = mapRef;
  const maps = mapsRef;
  if (!map || !maps) {
    return;
  }

  const projection = overlay?.getProjection() ?? map.getProjection();
  const node = map.getNode();
  const width = node.clientWidth;
  const height = node.clientHeight;
  if (width < 1 || height < 1) {
    return;
  }

  const bounds = map.getBounds();
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  const origin = projection.pointFromCoords(
    new maps.LatLng(northEast.getLat(), southWest.getLng()),
  );
  canvas.style.left = `${origin.x}px`;
  canvas.style.top = `${origin.y}px`;
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

  const padX = PIN_W;
  const padY = PIN_H;
  for (const pin of pins) {
    const point = projection.pointFromCoords(pin.latlng);
    const x = point.x - origin.x;
    const y = point.y - origin.y;
    if (x < -padX || y < -padY || x > width + padX || y > height + padY) {
      continue;
    }
    drawPin(ctx, x, y, COLORS[pin.kind]);
  }
}

function createOverlay(maps: KakaoMapsNamespace): KakaoAbstractOverlay {
  function PinOverlay(this: KakaoAbstractOverlay) {
    maps.AbstractOverlay.call(this);
  }
  PinOverlay.prototype = Object.create(maps.AbstractOverlay.prototype);
  PinOverlay.prototype.constructor = PinOverlay;
  PinOverlay.prototype.onAdd = function (this: KakaoAbstractOverlay) {
    this.getPanels().overlayLayer.appendChild(canvas);
  };
  PinOverlay.prototype.onRemove = function () {
    canvas.remove();
  };
  PinOverlay.prototype.draw = function () {
    paint();
  };
  return new (PinOverlay as unknown as new () => KakaoAbstractOverlay)();
}

function bindMap(map: KakaoMapInstance | null): void {
  if (overlay) {
    overlay.setMap(null);
    overlay = null;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;

  const maps = window.kakao?.maps;
  mapsRef = maps ?? null;
  mapRef = map ? toRaw(map) : null;
  if (!mapRef || !mapsRef) {
    return;
  }

  overlay = createOverlay(mapsRef);
  overlay.setMap(mapRef);
  resizeObserver = new ResizeObserver(() => schedulePaint());
  resizeObserver.observe(mapRef.getNode());
  schedulePaint();
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
  pins = [];
});
</script>

<template>
  <span class="hidden" />
</template>
