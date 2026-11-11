<script setup lang="ts">
import { MAP_REGION_CHIPS, type PlaceKind } from '@nest-vue/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import PageNav from '@/components/PageNav.vue';
import PlaceCard from '@/components/places/PlaceCard.vue';
import Skeleton from '@/components/Skeleton.vue';
import { useFavoriteMarks, type FavoriteTargetView } from '@/composables/useFavoriteMarks';
import { usePlaceList } from '@/composables/usePlaceList';

const props = defineProps<{
  kind: PlaceKind;
  titleKey: string;
  bodyKey: string;
  categories: readonly string[];
}>();

const { t } = useI18n();
const { q, region, category, page, result, items, error, pending } = usePlaceList(props.kind);
const favoriteTargets = computed<FavoriteTargetView[]>(() =>
  items.value.map((place) => ({
    source: place.source,
    id: place.id,
    name: place.name,
    kind: place.kind,
  })),
);
const favorites = useFavoriteMarks(favoriteTargets);

const total = computed(() => result.value?.total ?? 0);
const totalPages = computed(() => result.value?.totalPages ?? 0);
</script>

<template>
  <div>
    <section class="bg-ink text-paper">
      <div class="mx-auto max-w-6xl px-6 pt-8 pb-16">
        <p class="text-paper/60 text-xs">
          <RouterLink to="/" class="hover:text-paper">{{ t('places.home') }}</RouterLink>
          <span aria-hidden="true"> / </span>
          <span>{{ t(titleKey) }}</span>
        </p>
        <h1 class="mt-6 text-3xl font-semibold sm:text-4xl">{{ t(titleKey) }}</h1>
        <p class="text-paper/80 mt-3 max-w-xl text-sm">{{ t(bodyKey) }}</p>
        <p v-if="result" class="text-gold mt-6 text-sm">
          {{ t('places.count', { n: total }) }}
        </p>
      </div>
    </section>

    <div class="mx-auto max-w-6xl px-6 pb-16">
      <div class="border-line bg-paper -mt-8 rounded-sm border p-4 shadow-sm">
        <label class="sr-only" :for="`${kind}-search`">{{ t('places.search') }}</label>
        <input
          :id="`${kind}-search`"
          v-model="q"
          type="search"
          class="border-line placeholder:text-muted focus:border-ink w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none"
          :placeholder="t('places.searchPlaceholder')"
        />
        <div class="mt-3 flex flex-wrap gap-1">
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
        <div v-if="categories.length > 0" class="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            class="rounded-sm px-2 py-1 text-xs"
            :class="
              category === ''
                ? 'bg-ink text-paper'
                : 'border-line text-muted hover:border-ink hover:text-ink border bg-white'
            "
            :aria-pressed="category === ''"
            @click="category = ''"
          >
            {{ t('places.allCategories') }}
          </button>
          <button
            v-for="item in categories"
            :key="item"
            type="button"
            class="rounded-sm px-2 py-1 text-xs"
            :class="
              category === item
                ? 'bg-ink text-paper'
                : 'border-line text-muted hover:border-ink hover:text-ink border bg-white'
            "
            :aria-pressed="category === item"
            @click="category = item"
          >
            {{ item }}
          </button>
        </div>
      </div>

      <div v-if="pending" class="mt-8" aria-busy="true">
        <p class="sr-only">{{ t('places.loading') }}</p>
        <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="n in 6" :key="n" class="bg-paper overflow-hidden rounded-md shadow-sm">
            <Skeleton class="h-40" />
            <div class="space-y-2 p-4">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-3 w-1/2" />
            </div>
          </li>
        </ul>
      </div>
      <p v-else-if="error" class="mt-8 text-sm" role="alert">{{ error }}</p>
      <p v-else-if="items.length === 0" class="text-muted mt-8 text-sm">{{ t('places.empty') }}</p>
      <ul v-else class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="place in items" :key="place.globalId">
          <PlaceCard
            :place="place"
            :count="favorites.countOf(place.source, place.id)"
            :saved="favorites.isSaved(place.source, place.id)"
            :logged-in="Boolean(favorites.session.value.data)"
            :session-pending="favorites.session.value.isPending"
            :busy="favorites.isBusy(place.source, place.id)"
            @toggle-favorite="favorites.toggle(place)"
          />
        </li>
      </ul>

      <PageNav v-model="page" :total-pages="totalPages" :pending="pending" />
    </div>
  </div>
</template>
