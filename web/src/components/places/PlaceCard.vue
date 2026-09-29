<script setup lang="ts">
import { PLACE_KIND_LABELS, type PlaceSummary } from '@nest-vue/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import { placeDetailPath } from '@/lib/placePath';

const props = defineProps<{ place: PlaceSummary }>();

const { locale } = useI18n();

const kindText = computed(
  () => PLACE_KIND_LABELS[props.place.kind][locale.value === 'en' ? 'en' : 'ko'],
);
</script>

<template>
  <RouterLink
    :to="placeDetailPath(place.kind, place.id)"
    class="border-line bg-paper hover:border-ink/30 block overflow-hidden rounded-sm border"
  >
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
</template>
