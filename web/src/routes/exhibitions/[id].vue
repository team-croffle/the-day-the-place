<script setup lang="ts">
import { API_ROUTES, type Exhibition } from '@nest-vue/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';

import { ApiError, apiFetch } from '@/composables/useApi';
import { exhibitionPeriod } from '@/lib/exhibitionPeriod';

const route = useRoute();
const { t } = useI18n();

const exhibition = ref<Exhibition | null>(null);
const error = ref<string | null>(null);
const pending = ref(false);

const id = computed(() => {
  const value = 'id' in route.params ? route.params.id : '';
  return typeof value === 'string' ? value : '';
});

async function load(exhibitionId: string): Promise<void> {
  pending.value = true;
  error.value = null;
  exhibition.value = null;
  try {
    exhibition.value = await apiFetch<Exhibition>(`/${API_ROUTES.EXHIBITIONS}/${exhibitionId}`);
  } catch (cause) {
    error.value =
      cause instanceof ApiError && cause.status === 404
        ? t('exhibitions.notFound')
        : cause instanceof Error
          ? cause.message
          : String(cause);
  } finally {
    pending.value = false;
  }
}

watch(
  id,
  (exhibitionId) => {
    if (exhibitionId) {
      void load(exhibitionId);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <p v-if="pending" class="text-muted mx-auto max-w-6xl px-6 py-16 text-sm">
      {{ t('exhibitions.loading') }}
    </p>
    <div v-else-if="error" class="mx-auto max-w-6xl px-6 py-16">
      <p role="alert">{{ error }}</p>
      <RouterLink to="/exhibitions" class="text-gold mt-4 inline-block text-sm">
        {{ t('places.backToList') }}
      </RouterLink>
    </div>
    <template v-else-if="exhibition">
      <section class="bg-ink text-paper relative min-h-72">
        <img
          v-if="exhibition.imageUrl"
          :src="exhibition.imageUrl"
          :alt="exhibition.title"
          class="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div class="from-ink absolute inset-0 bg-linear-to-t to-transparent" />
        <div class="relative mx-auto flex min-h-72 max-w-6xl flex-col justify-end px-6 py-8">
          <p class="text-paper/70 text-xs">
            <RouterLink to="/" class="hover:text-paper">{{ t('places.home') }}</RouterLink>
            <span aria-hidden="true"> / </span>
            <RouterLink to="/exhibitions" class="hover:text-paper">{{
              t('nav.exhibitions')
            }}</RouterLink>
          </p>
          <p class="text-gold mt-4 text-[11px]">
            {{ t(`exhibitions.status.${exhibition.status}`) }}
          </p>
          <h1 class="mt-1 max-w-3xl text-3xl font-semibold sm:text-4xl">{{ exhibition.title }}</h1>
          <p class="text-paper/80 mt-2 text-sm">
            {{ exhibition.placeName }}
            <span aria-hidden="true"> · </span>
            {{ exhibitionPeriod(exhibition.startsOn, exhibition.endsOn) }}
          </p>
        </div>
      </section>
      <div class="mx-auto max-w-6xl px-6 py-10">
        <p class="max-w-2xl text-sm leading-6">{{ exhibition.summary }}</p>
        <a
          v-if="exhibition.sourceUrl"
          :href="exhibition.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-gold mt-6 inline-block text-sm"
        >
          {{ t('exhibitions.source') }}
        </a>
      </div>
    </template>
  </div>
</template>
