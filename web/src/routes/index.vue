<script setup lang="ts">
import { API_ROUTES, type Exhibition } from '@nest-vue/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import ExhibitionCard from '@/components/exhibitions/ExhibitionCard.vue';
import HomeSearch from '@/components/home/HomeSearch.vue';
import { apiFetch } from '@/composables/useApi';

const { t } = useI18n();

const exhibitions = ref<Exhibition[]>([]);

onMounted(async () => {
  try {
    exhibitions.value = await apiFetch<Exhibition[]>(`/${API_ROUTES.EXHIBITIONS}`);
  } catch {
    exhibitions.value = [];
  }
});

const ongoing = computed(() =>
  exhibitions.value.filter((item) => item.status === 'ongoing').slice(0, 4),
);
const featured = computed(() => ongoing.value[0] ?? null);
const siteSlots = 6;
const eraTabs = [
  'home.eraAll',
  'home.eraThree',
  'home.eraGoryeo',
  'home.eraJoseon',
  'home.eraModern',
] as const;
const eras = [
  { id: 'three', key: 'home.eraThree', years: 'BC 57 – 668' },
  { id: 'goryeo', key: 'home.eraGoryeo', years: '918 – 1392' },
  { id: 'joseon', key: 'home.eraJoseon', years: '1392 – 1897' },
  { id: 'modern', key: 'home.eraModern', years: '1897 –' },
] as const;
</script>

<template>
  <div>
    <section class="bg-ink text-paper relative min-h-[28rem]">
      <div
        class="from-ink via-ink/90 to-gold/30 absolute inset-0 bg-linear-to-br"
        aria-hidden="true"
      />
      <div class="relative mx-auto flex min-h-[28rem] max-w-6xl flex-col justify-end px-6 pb-20">
        <p class="text-gold text-xs tracking-widest uppercase">
          {{ featured ? t(`exhibitions.status.${featured.status}`) : t('home.heroEyebrow') }}
        </p>
        <h1 class="mt-3 max-w-xl text-3xl font-semibold sm:text-4xl">
          {{ featured ? featured.title : t('home.heroTitle') }}
        </h1>
        <p class="text-paper/80 mt-3 max-w-lg text-sm">
          {{ featured ? featured.summary : t('home.heroBody') }}
        </p>
        <RouterLink
          to="/exhibitions"
          class="bg-gold text-ink hover:bg-gold-hover mt-6 inline-flex w-fit rounded-sm px-4 py-2 text-sm font-medium"
        >
          {{ t('home.heroCta') }}
        </RouterLink>
      </div>
    </section>

    <HomeSearch />

    <section class="mx-auto max-w-6xl px-6 pb-16">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <p class="text-muted text-xs tracking-widest uppercase">
            {{ t('home.exhibitionsEyebrow') }}
          </p>
          <h2 class="mt-1 text-2xl font-semibold">{{ t('home.exhibitionsTitle') }}</h2>
        </div>
        <RouterLink to="/exhibitions" class="text-muted hover:text-ink text-sm">
          {{ t('home.seeAll') }}
        </RouterLink>
      </div>
      <p v-if="ongoing.length === 0" class="text-muted text-sm">{{ t('exhibitions.empty') }}</p>
      <ul v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="item in ongoing" :key="item.id">
          <RouterLink to="/exhibitions" class="block">
            <ExhibitionCard :exhibition="item" />
          </RouterLink>
        </li>
      </ul>
    </section>

    <section class="bg-ink text-paper py-16">
      <div class="mx-auto max-w-6xl px-6">
        <div class="mb-6 flex items-end justify-between">
          <div>
            <p class="text-gold text-xs tracking-widest uppercase">{{ t('home.sitesEyebrow') }}</p>
            <h2 class="mt-1 text-2xl font-semibold">{{ t('home.sitesTitle') }}</h2>
          </div>
          <RouterLink to="/sites" class="text-paper/70 hover:text-paper text-sm">
            {{ t('home.seeAll') }}
          </RouterLink>
        </div>
        <div class="mb-6 flex flex-wrap gap-2 text-xs">
          <span
            v-for="tab in eraTabs"
            :key="tab"
            class="border-paper/20 text-paper/70 rounded-full border px-3 py-1"
          >
            {{ t(tab) }}
          </span>
        </div>
        <ul class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <li v-for="n in siteSlots" :key="n" class="bg-paper/10 overflow-hidden rounded-md">
            <div class="bg-paper/10 h-36" />
            <p class="p-3 text-sm">{{ t('home.placeholderTitle') }}</p>
          </li>
        </ul>
      </div>
    </section>

    <section id="eras" class="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
      <p class="text-muted text-xs tracking-widest uppercase">{{ t('home.erasEyebrow') }}</p>
      <h2 class="mt-1 text-2xl font-semibold">{{ t('home.erasTitle') }}</h2>
      <ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="era in eras" :key="era.id" class="bg-ink text-paper overflow-hidden rounded-md">
          <div class="from-ink to-gold/20 flex h-52 flex-col justify-end bg-linear-to-t p-5">
            <p class="text-gold text-xs">{{ era.years }}</p>
            <p class="text-lg font-semibold">{{ t(era.key) }}</p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
