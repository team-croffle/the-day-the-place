<script setup lang="ts">
import { API_ROUTES, type Exhibition } from '@nest-vue/shared';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import ExhibitionCard from '@/components/exhibitions/ExhibitionCard.vue';
import HomeSearch from '@/components/home/HomeSearch.vue';
import { apiFetch } from '@/composables/useApi';

const HERO_LIMIT = 5;
const HERO_MS = 6_000;

const { t } = useI18n();

const exhibitions = ref<Exhibition[]>([]);
const slideIndex = ref(0);
const paused = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(async () => {
  try {
    exhibitions.value = await apiFetch<Exhibition[]>(`/${API_ROUTES.EXHIBITIONS}`);
  } catch {
    exhibitions.value = [];
  }
});

onUnmounted(clearHeroTimer);

const ongoing = computed(() =>
  exhibitions.value.filter((item) => item.status === 'ongoing').slice(0, 4),
);
const slides = computed(() =>
  exhibitions.value
    .filter((item) => item.status === 'ongoing' && item.imageUrl)
    .slice(0, HERO_LIMIT),
);
const featured = computed(() => slides.value[slideIndex.value] ?? null);

watch(slides, (list) => {
  if (slideIndex.value >= list.length) slideIndex.value = 0;
  armHeroTimer();
});

function prefersStill(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function clearHeroTimer(): void {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

function armHeroTimer(): void {
  clearHeroTimer();
  if (paused.value || slides.value.length < 2 || prefersStill()) return;
  timer = setInterval(() => {
    slideIndex.value = (slideIndex.value + 1) % slides.value.length;
  }, HERO_MS);
}

function showSlide(next: number): void {
  const count = slides.value.length;
  if (count === 0) return;
  slideIndex.value = (next + count) % count;
  armHeroTimer();
}

function holdHero(): void {
  paused.value = true;
  clearHeroTimer();
}

function releaseHero(event: MouseEvent | FocusEvent): void {
  const next = event.relatedTarget;
  const current = event.currentTarget;
  if (next instanceof Node && current instanceof Node && current.contains(next)) return;
  paused.value = false;
  armHeroTimer();
}
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
    <section
      class="bg-ink text-paper relative min-h-[28rem] overflow-hidden"
      @pointerenter="holdHero"
      @pointerleave="releaseHero"
      @focusin="holdHero"
      @focusout="releaseHero"
    >
      <div v-if="featured?.imageUrl" class="pointer-events-none absolute inset-0">
        <div class="relative mx-auto h-full max-w-6xl">
          <img
            :src="featured.imageUrl"
            alt=""
            class="absolute inset-y-0 right-6 h-full w-[86%] max-w-4xl object-cover object-[center_40%]"
          />
        </div>
      </div>
      <div
        class="absolute inset-0"
        :class="
          featured?.imageUrl
            ? 'from-ink via-ink/60 bg-linear-to-r to-transparent'
            : 'from-ink via-ink/90 to-gold/30 bg-linear-to-br'
        "
        aria-hidden="true"
      />
      <div
        class="relative mx-auto flex min-h-[28rem] max-w-6xl flex-col justify-end px-6 pt-16 pb-24"
      >
        <p class="text-gold text-xs tracking-widest uppercase">
          {{ featured ? t(`exhibitions.status.${featured.status}`) : t('home.heroEyebrow') }}
        </p>
        <h1 class="mt-3 max-w-xl text-3xl font-semibold sm:text-4xl">
          {{ featured ? featured.title : t('home.heroTitle') }}
        </h1>
        <p class="text-paper/80 mt-3 max-w-lg text-sm">
          {{ featured ? featured.summary : t('home.heroBody') }}
        </p>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <RouterLink
            :to="featured ? `/exhibitions/${featured.id}` : '/exhibitions'"
            class="bg-gold text-ink hover:bg-gold-hover inline-flex w-fit rounded-sm px-4 py-2 text-sm font-medium"
          >
            {{ featured ? t('exhibitions.readMore') : t('home.heroCta') }}
          </RouterLink>
          <template v-if="slides.length > 1">
            <button
              type="button"
              class="border-paper/40 hover:border-paper inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg"
              :aria-label="t('home.heroPrev')"
              @click="showSlide(slideIndex - 1)"
            >
              ‹
            </button>
            <button
              type="button"
              class="border-paper/40 hover:border-paper inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg"
              :aria-label="t('home.heroNext')"
              @click="showSlide(slideIndex + 1)"
            >
              ›
            </button>
            <div class="flex items-center gap-2" role="tablist" :aria-label="t('home.heroSlides')">
              <button
                v-for="(slide, index) in slides"
                :key="slide.id"
                type="button"
                role="tab"
                class="h-2 rounded-full"
                :class="index === slideIndex ? 'bg-gold w-6' : 'bg-paper/45 w-2'"
                :aria-selected="index === slideIndex"
                :aria-label="t('home.heroSlide', { title: slide.title })"
                @click="showSlide(index)"
              />
            </div>
          </template>
        </div>
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
          <ExhibitionCard :exhibition="item" />
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
