<script setup lang="ts">
import { MAP_REGION_CHIPS } from '@nest-vue/shared';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import AppIcon from '@/components/AppIcon.vue';

const { t } = useI18n();
const router = useRouter();

const q = ref('');
const region = ref('all');
const era = ref('all');

const eras = [
  { id: 'all', key: 'home.eraAll' },
  { id: 'three', key: 'home.eraThree' },
  { id: 'goryeo', key: 'home.eraGoryeo' },
  { id: 'joseon', key: 'home.eraJoseon' },
  { id: 'modern', key: 'home.eraModern' },
] as const;

function search(): void {
  const query: Record<string, string> = {};
  const name = q.value.trim();
  if (name) {
    query.q = name;
  }
  if (region.value !== 'all') {
    query.region = region.value;
  }
  void router.push({ path: '/map', query });
}
</script>

<template>
  <form
    class="bg-paper mx-auto flex max-w-4xl -translate-y-1/2 flex-col gap-2 rounded-md p-2 shadow-md sm:flex-row sm:items-center"
    @submit.prevent="search"
  >
    <select v-model="region" class="border-line bg-paper rounded-sm border px-3 py-2 text-sm">
      <option v-for="chip in MAP_REGION_CHIPS" :key="chip.code" :value="chip.code">
        {{ chip.ko }}
      </option>
    </select>
    <select v-model="era" class="border-line bg-paper rounded-sm border px-3 py-2 text-sm">
      <option v-for="item in eras" :key="item.id" :value="item.id">
        {{ t(item.key) }}
      </option>
    </select>
    <label class="flex min-w-0 flex-1 items-center gap-2 px-3">
      <span class="sr-only">{{ t('home.search') }}</span>
      <input
        v-model="q"
        type="search"
        class="placeholder:text-muted w-full bg-transparent py-2 text-sm outline-none"
        :placeholder="t('home.searchPlaceholder')"
      />
    </label>
    <button
      type="submit"
      class="bg-ink text-paper hover:bg-ink/90 inline-flex items-center justify-center gap-1.5 rounded-sm px-5 py-2 text-sm font-medium"
      :aria-label="t('home.search')"
    >
      <AppIcon name="search" />
      <span class="hidden sm:inline">{{ t('home.search') }}</span>
    </button>
  </form>
</template>
