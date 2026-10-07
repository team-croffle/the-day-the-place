<script setup lang="ts">
import type { Exhibition } from '@nest-vue/shared';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import { exhibitionPeriod } from '@/lib/exhibitionPeriod';

defineProps<{
  exhibition: Exhibition;
  featured?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <RouterLink
    :to="`/exhibitions/${exhibition.id}`"
    class="bg-paper hover:border-ink/30 block overflow-hidden rounded-md border border-transparent shadow-sm"
    :class="featured ? 'sm:grid sm:grid-cols-2' : ''"
  >
    <div class="bg-line relative" :class="featured ? 'min-h-56 sm:min-h-72' : 'h-40'">
      <img
        v-if="exhibition.imageUrl"
        :src="exhibition.imageUrl"
        :alt="exhibition.title"
        loading="lazy"
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover"
      />
      <span class="bg-ink/80 text-paper absolute top-3 left-3 rounded-sm px-2 py-0.5 text-[11px]">
        {{ t(`exhibitions.status.${exhibition.status}`) }}
      </span>
    </div>
    <div class="flex flex-col p-4" :class="featured ? 'sm:p-6' : ''">
      <h3 class="font-semibold" :class="featured ? 'text-lg' : 'line-clamp-2 text-sm'">
        {{ exhibition.title }}
      </h3>
      <p v-if="featured" class="text-muted mt-2 line-clamp-3 text-sm">{{ exhibition.summary }}</p>
      <p class="text-muted mt-2 text-xs">
        {{ exhibitionPeriod(exhibition.startsOn, exhibition.endsOn) }}
      </p>
      <p class="mt-1 text-xs">{{ exhibition.placeName }}</p>
      <span
        v-if="featured"
        class="bg-ink text-paper mt-4 inline-flex w-fit rounded-sm px-3 py-1.5 text-xs"
      >
        {{ t('exhibitions.readMore') }}
      </span>
    </div>
  </RouterLink>
</template>
