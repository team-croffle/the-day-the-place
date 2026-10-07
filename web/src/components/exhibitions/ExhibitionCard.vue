<script setup lang="ts">
import type { Exhibition } from '@nest-vue/shared';
import { useI18n } from 'vue-i18n';

import { exhibitionPeriod } from '@/lib/exhibitionPeriod';

defineProps<{
  exhibition: Exhibition;
  featured?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <article
    class="bg-paper overflow-hidden rounded-md shadow-sm"
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
      <a
        v-if="featured && exhibition.sourceUrl"
        :href="exhibition.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="bg-ink text-paper hover:bg-ink/90 mt-4 inline-flex w-fit rounded-sm px-3 py-1.5 text-xs"
      >
        {{ t('exhibitions.readMore') }}
      </a>
    </div>
  </article>
</template>
