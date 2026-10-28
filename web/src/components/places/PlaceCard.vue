<script setup lang="ts">
import { PLACE_KIND_LABELS, type PlaceSummary } from '@nest-vue/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import FavoriteControl from '@/components/places/FavoriteControl.vue';
import { placeDetailPath } from '@/lib/placePath';

const props = defineProps<{
  place: PlaceSummary;
  count: number | null;
  saved: boolean;
  loggedIn: boolean;
  sessionPending: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  toggleFavorite: [];
}>();

const { locale } = useI18n();

const kindText = computed(
  () => PLACE_KIND_LABELS[props.place.kind][locale.value === 'en' ? 'en' : 'ko'],
);
</script>

<template>
  <article class="border-line bg-paper hover:border-ink/30 overflow-hidden rounded-sm border">
    <RouterLink :to="placeDetailPath(place.kind, place.id)" class="block">
      <span class="bg-line relative block h-44 overflow-hidden">
        <img
          v-if="place.image"
          :src="place.image"
          :alt="place.name"
          loading="lazy"
          decoding="async"
          class="h-full w-full object-cover"
        />
      </span>
      <span class="block px-4 py-3">
        <span class="text-gold text-[11px]">
          {{ kindText }}
          <span v-if="place.category && place.category !== kindText"> · {{ place.category }}</span>
        </span>
        <span class="mt-1 block truncate font-semibold">{{ place.name }}</span>
        <span v-if="place.address" class="text-muted mt-1 block truncate text-sm">{{
          place.address
        }}</span>
      </span>
    </RouterLink>
    <div class="px-4 pb-3">
      <FavoriteControl
        :count="count"
        :saved="saved"
        :logged-in="loggedIn"
        :session-pending="sessionPending"
        :busy="busy"
        @toggle="emit('toggleFavorite')"
      />
    </div>
  </article>
</template>
