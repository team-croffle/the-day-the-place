<script setup lang="ts">
import { API_ROUTES, PLACE_KIND_LABELS, type PlaceDetail, type PlaceKind } from '@nest-vue/shared';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import { ApiError, apiFetch } from '@/composables/useApi';

const props = defineProps<{
  kind: PlaceKind;
  id: string;
  listPath: string;
  listTitleKey: string;
}>();

const { t, locale } = useI18n();

const place = ref<PlaceDetail | null>(null);
const error = ref<string | null>(null);
const pending = ref(false);
const tab = ref<'intro' | 'visit' | 'directions' | 'exhibitions'>('intro');
const openIndex = ref<number | null>(null);

const photos = computed(() =>
  place.value?.images && place.value.images.length > 1 ? place.value.images : [],
);

const openSrc = computed(() =>
  openIndex.value === null ? null : (photos.value[openIndex.value] ?? null),
);

const kindText = computed(() =>
  place.value ? PLACE_KIND_LABELS[place.value.kind][locale.value === 'en' ? 'en' : 'ko'] : '',
);

const directionsUrl = computed(() => {
  if (!place.value) {
    return '';
  }
  return `https://map.kakao.com/link/to/${encodeURIComponent(place.value.name)},${place.value.lat},${place.value.lng}`;
});

const tabs = computed(() => {
  const base = ['intro', 'visit', 'directions'] as const;
  return props.kind === 'museum' ? ([...base, 'exhibitions'] as const) : base;
});

async function load(id: string): Promise<void> {
  pending.value = true;
  error.value = null;
  place.value = null;
  tab.value = 'intro';
  openIndex.value = null;
  try {
    const detail = await apiFetch<PlaceDetail>(`/${API_ROUTES.PLACES}/tour/${id}`);
    if (detail.kind !== props.kind) {
      error.value = t('places.notFound');
      return;
    }
    place.value = detail;
  } catch (cause) {
    error.value =
      cause instanceof ApiError && cause.status === 404
        ? t('places.notFound')
        : cause instanceof Error
          ? cause.message
          : String(cause);
  } finally {
    pending.value = false;
  }
}

function closePhoto(): void {
  openIndex.value = null;
}

function stepPhoto(delta: number): void {
  if (openIndex.value === null || photos.value.length === 0) {
    return;
  }
  const count = photos.value.length;
  openIndex.value = (openIndex.value + delta + count) % count;
}

function onPhotoKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closePhoto();
  }
}

watch(openSrc, (src) => {
  if (src) {
    window.addEventListener('keydown', onPhotoKeydown);
  } else {
    window.removeEventListener('keydown', onPhotoKeydown);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onPhotoKeydown);
});

watch(
  () => props.id,
  (id) => {
    if (id) {
      void load(id);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <p v-if="pending" class="text-muted mx-auto max-w-6xl px-6 py-16 text-sm">
      {{ t('places.loading') }}
    </p>
    <div v-else-if="error" class="mx-auto max-w-6xl px-6 py-16">
      <p role="alert">{{ error }}</p>
      <RouterLink :to="listPath" class="text-gold mt-4 inline-block text-sm">
        {{ t('places.backToList') }}
      </RouterLink>
    </div>
    <template v-else-if="place">
      <section class="bg-ink text-paper relative min-h-72">
        <img
          v-if="place.image"
          :src="place.image"
          :alt="place.name"
          class="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div class="from-ink absolute inset-0 bg-linear-to-t to-transparent" />
        <div class="relative mx-auto flex min-h-72 max-w-6xl flex-col justify-end px-6 py-8">
          <p class="text-paper/70 text-xs">
            <RouterLink to="/" class="hover:text-paper">{{ t('places.home') }}</RouterLink>
            <span aria-hidden="true"> / </span>
            <RouterLink :to="listPath" class="hover:text-paper">{{ t(listTitleKey) }}</RouterLink>
          </p>
          <p class="text-gold mt-4 text-[11px]">
            {{ kindText }}
            <span v-if="place.category && place.category !== kindText">
              · {{ place.category }}</span
            >
          </p>
          <h1 class="mt-1 text-3xl font-semibold sm:text-4xl">{{ place.name }}</h1>
          <p v-if="place.address" class="text-paper/80 mt-2 text-sm">{{ place.address }}</p>
        </div>
      </section>

      <div class="border-line bg-paper border-b">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div class="flex gap-4 text-sm">
            <button
              v-for="item in tabs"
              :key="item"
              type="button"
              class="border-b-2 pb-1"
              :class="tab === item ? 'border-gold text-ink' : 'text-muted border-transparent'"
              @click="tab = item"
            >
              {{ t(`places.tab.${item}`) }}
            </button>
          </div>
          <div class="flex gap-2 text-sm">
            <RouterLink to="/login" class="border-line rounded-sm border px-3 py-1.5">
              {{ t('places.save') }}
            </RouterLink>
            <a
              :href="directionsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="bg-gold text-ink hover:bg-gold-hover rounded-sm px-3 py-1.5"
            >
              {{ t('places.directionsCta') }}
            </a>
          </div>
        </div>
      </div>

      <div class="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_18rem]">
        <div class="min-w-0">
          <template v-if="tab === 'intro'">
            <h2 class="text-lg font-semibold">{{ t('places.tab.intro') }}</h2>
            <p class="text-muted mt-3 text-sm leading-relaxed whitespace-pre-line">
              {{ place.description || place.summary || t('places.noIntro') }}
            </p>
            <div v-if="photos.length > 0" class="mt-8">
              <h3 class="text-lg font-semibold">{{ t('places.photos') }}</h3>
              <div class="mt-3 flex gap-3 overflow-x-auto">
                <button
                  v-for="(src, index) in photos"
                  :key="src"
                  type="button"
                  class="h-44 w-64 shrink-0"
                  :aria-label="t('places.openPhoto')"
                  @click="openIndex = index"
                >
                  <img :src="src" alt="" class="h-full w-full object-cover" />
                </button>
              </div>
            </div>
          </template>
          <template v-else-if="tab === 'visit'">
            <h2 class="text-lg font-semibold">{{ t('places.tab.visit') }}</h2>
            <dl class="mt-3 space-y-2 text-sm">
              <div v-if="place.hours">
                <dt class="text-muted">{{ t('places.hours') }}</dt>
                <dd class="whitespace-pre-line">{{ place.hours }}</dd>
              </div>
              <div v-if="place.fee">
                <dt class="text-muted">{{ t('places.fee') }}</dt>
                <dd>{{ place.fee }}</dd>
              </div>
              <div v-if="place.tel">
                <dt class="text-muted">{{ t('places.tel') }}</dt>
                <dd>{{ place.tel }}</dd>
              </div>
            </dl>
            <p v-if="!place.hours && !place.fee && !place.tel" class="text-muted mt-3 text-sm">
              {{ t('places.noVisit') }}
            </p>
          </template>
          <template v-else-if="tab === 'directions'">
            <h2 class="text-lg font-semibold">{{ t('places.tab.directions') }}</h2>
            <p class="mt-3 text-sm">{{ place.address }}</p>
            <a
              :href="directionsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-gold mt-3 inline-block text-sm"
            >
              {{ t('places.directionsCta') }}
            </a>
          </template>
          <template v-else>
            <h2 class="text-lg font-semibold">{{ t('places.tab.exhibitions') }}</h2>
            <p class="text-muted mt-3 text-sm">{{ t('places.exhibitionsLater') }}</p>
          </template>
        </div>

        <aside class="border-line h-fit rounded-sm border p-4 text-sm">
          <h2 class="font-semibold">{{ t('places.facts') }}</h2>
          <p v-if="place.tel" class="mt-3">{{ place.tel }}</p>
          <p v-if="place.address" class="text-muted mt-2">{{ place.address }}</p>
          <div
            v-if="kind === 'site' || (place.designations && place.designations.length > 0)"
            class="mt-4"
          >
            <h3 class="text-xs font-semibold">{{ t('places.designations') }}</h3>
            <p v-if="!place.designations" class="text-muted mt-2 text-xs">
              {{ t('places.designationsError') }}
            </p>
            <p v-else-if="place.designations.length === 0" class="text-muted mt-2 text-xs">
              {{ t('places.noDesignations') }}
            </p>
            <ul v-else class="mt-2 space-y-1">
              <li v-for="item in place.designations" :key="item.id">
                <span class="text-gold">{{ item.kind }}</span>
                {{ item.name }}
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div
        v-if="openSrc"
        class="bg-ink/80 fixed inset-0 z-50 flex items-center justify-center gap-3 p-4"
        @click.self="closePhoto"
      >
        <button type="button" class="text-paper absolute top-4 right-6 text-sm" @click="closePhoto">
          {{ t('places.closePhoto') }}
        </button>
        <button
          v-if="photos.length > 1"
          type="button"
          class="text-paper shrink-0 px-2 text-sm"
          @click="stepPhoto(-1)"
        >
          {{ t('places.prev') }}
        </button>
        <img :src="openSrc" :alt="place.name" class="max-h-[85vh] max-w-full object-contain" />
        <button
          v-if="photos.length > 1"
          type="button"
          class="text-paper shrink-0 px-2 text-sm"
          @click="stepPhoto(1)"
        >
          {{ t('places.next') }}
        </button>
      </div>
    </template>
  </div>
</template>
