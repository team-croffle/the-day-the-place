<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { pageItems } from '@/lib/pageItems';

const page = defineModel<number>({ required: true });

const props = defineProps<{
  totalPages: number;
  pending?: boolean;
}>();

const { t } = useI18n();
const items = computed(() => pageItems(page.value, props.totalPages));
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="mt-8 flex flex-wrap items-center justify-center gap-1 text-sm"
    :aria-label="t('places.pages')"
  >
    <button
      type="button"
      class="border-line rounded-sm border px-2 py-1 disabled:opacity-40"
      :disabled="page <= 1 || pending"
      @click="page -= 1"
    >
      {{ t('places.prev') }}
    </button>
    <template v-for="(item, index) in items" :key="`${item}-${index}`">
      <span v-if="item === 'gap'" class="text-muted px-1" aria-hidden="true">…</span>
      <button
        v-else
        type="button"
        class="min-w-8 rounded-sm px-2 py-1"
        :class="
          item === page
            ? 'bg-ink text-paper'
            : 'border-line hover:border-ink border bg-white disabled:opacity-40'
        "
        :aria-label="t('places.page', { page: item })"
        :aria-current="item === page ? 'page' : undefined"
        :disabled="pending"
        @click="page = item"
      >
        {{ item }}
      </button>
    </template>
    <button
      type="button"
      class="border-line rounded-sm border px-2 py-1 disabled:opacity-40"
      :disabled="page >= totalPages || pending"
      @click="page += 1"
    >
      {{ t('places.next') }}
    </button>
  </nav>
</template>
