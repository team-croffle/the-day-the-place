<script setup lang="ts">
import {
  API_ROUTES,
  MAP_REGION_CHIPS,
  selectExhibitions,
  type Exhibition,
  type ExhibitionStatus,
} from '@nest-vue/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import ExhibitionCard from '@/components/exhibitions/ExhibitionCard.vue';
import { apiFetch } from '@/composables/useApi';

const { t } = useI18n();

const items = ref<Exhibition[]>([]);
const error = ref<string | null>(null);
const pending = ref(true);
const q = ref('');
const status = ref<'' | ExhibitionStatus>('');
const region = ref('all');

const statuses = ['', 'ongoing', 'upcoming'] as const;

onMounted(async () => {
  try {
    items.value = await apiFetch<Exhibition[]>(`/${API_ROUTES.EXHIBITIONS}`);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    pending.value = false;
  }
});

const today = computed(() =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()),
);

const filtered = computed(() =>
  selectExhibitions(
    items.value,
    {
      q: q.value,
      status: status.value || undefined,
      region: region.value,
    },
    today.value,
  ),
);

const ongoing = computed(() => filtered.value.filter((item) => item.status === 'ongoing'));
const upcoming = computed(() => filtered.value.filter((item) => item.status === 'upcoming'));
const ongoingTotal = computed(() => items.value.filter((item) => item.status === 'ongoing').length);
const upcomingTotal = computed(
  () => items.value.filter((item) => item.status === 'upcoming').length,
);
</script>

<template>
  <div>
    <section class="bg-ink text-paper">
      <div class="mx-auto max-w-6xl px-6 pt-8 pb-16">
        <p class="text-paper/60 text-xs">
          <RouterLink to="/" class="hover:text-paper">{{ t('places.home') }}</RouterLink>
          <span aria-hidden="true"> / </span>
          <span>{{ t('nav.exhibitions') }}</span>
        </p>
        <h1 class="mt-6 text-3xl font-semibold sm:text-4xl">{{ t('exhibitions.heading') }}</h1>
        <p class="text-paper/80 mt-3 max-w-xl text-sm">{{ t('exhibitions.body') }}</p>
        <p v-if="!pending && !error" class="text-gold mt-6 text-sm">
          {{ t('exhibitions.ongoingCount', { n: ongoingTotal }) }}
          <span class="text-paper/40" aria-hidden="true"> · </span>
          {{ t('exhibitions.upcomingCount', { n: upcomingTotal }) }}
        </p>
      </div>
    </section>

    <div class="mx-auto max-w-6xl px-6 pb-16">
      <div class="border-line bg-paper -mt-8 rounded-sm border p-4 shadow-sm">
        <label class="sr-only" for="exhibition-search">{{ t('home.search') }}</label>
        <input
          id="exhibition-search"
          v-model="q"
          type="search"
          class="border-line placeholder:text-muted focus:border-ink w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none"
          :placeholder="t('exhibitions.searchPlaceholder')"
        />
        <div class="mt-3 flex flex-wrap gap-1">
          <button
            v-for="item in statuses"
            :key="item || 'all'"
            type="button"
            class="rounded-sm px-2 py-1 text-xs"
            :class="
              status === item
                ? 'bg-ink text-paper'
                : 'border-line text-muted hover:border-ink hover:text-ink border bg-white'
            "
            :aria-pressed="status === item"
            @click="status = item"
          >
            {{ item === '' ? t('exhibitions.statusAll') : t(`exhibitions.status.${item}`) }}
          </button>
        </div>
        <div class="mt-2 flex flex-wrap gap-1">
          <button
            v-for="chip in MAP_REGION_CHIPS"
            :key="chip.code"
            type="button"
            class="rounded-sm px-2 py-1 text-xs"
            :class="
              region === chip.code
                ? 'bg-ink text-paper'
                : 'border-line text-muted hover:border-ink hover:text-ink border bg-white'
            "
            :aria-pressed="region === chip.code"
            @click="region = chip.code"
          >
            {{ chip.ko }}
          </button>
        </div>
      </div>

      <p v-if="pending" class="text-muted mt-8 text-sm">{{ t('exhibitions.loading') }}</p>
      <p v-else-if="error" class="mt-8 text-sm" role="alert">{{ error }}</p>
      <p v-else-if="filtered.length === 0" class="text-muted mt-8 text-sm">
        {{ t('exhibitions.empty') }}
      </p>
      <template v-else>
        <section v-if="ongoing.length > 0" class="mt-8">
          <h2 class="text-lg font-semibold">
            {{ t('exhibitions.ongoingTitle') }}
            <span class="text-muted text-sm font-normal">{{ ongoing.length }}</span>
          </h2>
          <ExhibitionCard class="mt-4" :exhibition="ongoing[0]!" featured />
          <ul v-if="ongoing.length > 1" class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="item in ongoing.slice(1)" :key="item.id">
              <ExhibitionCard :exhibition="item" />
            </li>
          </ul>
        </section>

        <section v-if="upcoming.length > 0" class="mt-12">
          <h2 class="text-lg font-semibold">
            {{ t('exhibitions.upcomingTitle') }}
            <span class="text-muted text-sm font-normal">{{ upcoming.length }}</span>
          </h2>
          <ExhibitionCard class="mt-4" :exhibition="upcoming[0]!" featured />
          <ul v-if="upcoming.length > 1" class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="item in upcoming.slice(1)" :key="item.id">
              <ExhibitionCard :exhibition="item" />
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
