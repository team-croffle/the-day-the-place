<script setup lang="ts">
import { MAP_REGION_CHIPS } from '@nest-vue/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';

import { authClient } from '@/lib/authClient';

const XP_TOTAL = 1000;
const VISIT_COUNT = 0;
const FAVORITE_COUNT = 0;
const AVERAGE_RATING = 0;

const { t, locale } = useI18n();
const router = useRouter();
const session = authClient.useSession();

const tab = ref<'visits' | 'favorites'>('visits');

const regions = MAP_REGION_CHIPS.filter((chip) => chip.code !== 'all' && chip.code !== '39');
const badges = ['badgeFirst', 'badgeFive', 'badgeSeoul', 'badgeHeritage', 'badgeFifty'] as const;

const user = computed(() => session.value.data?.user ?? null);
const initials = computed(() => user.value?.name.slice(0, 2) ?? '');
const joined = computed(() => {
  const createdAt = user.value?.createdAt;
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = new Intl.DateTimeFormat(locale.value === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
  }).format(date);
  return t('me.joined', { date: formatted });
});

watch(
  () => [session.value.isPending, session.value.data] as const,
  ([pending, data]) => {
    if (!pending && !data) void router.replace('/login');
  },
  { immediate: true },
);

async function logout(): Promise<void> {
  await authClient.signOut();
  await router.push('/');
}
</script>

<template>
  <p v-if="session.isPending" class="text-muted mx-auto max-w-6xl px-6 py-16 text-sm">
    {{ t('me.loading') }}
  </p>

  <div v-else-if="user">
    <section class="bg-ink text-paper">
      <div class="mx-auto max-w-6xl px-6 pt-6 pb-20">
        <p class="text-paper/55 text-xs">
          <RouterLink to="/" class="hover:text-paper">{{ t('me.breadcrumbHome') }}</RouterLink>
          <span aria-hidden="true"> › </span>
          <span>{{ t('me.breadcrumb') }}</span>
        </p>

        <div class="mt-5 flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="me-avatar">{{ initials }}</div>
            <div class="min-w-0">
              <p class="me-rank">{{ t('me.rank') }}</p>
              <h1 class="mt-0.5 text-2xl leading-tight font-semibold">
                {{ user.name }}<span v-if="locale === 'ko'"> 님</span>
              </h1>
              <p class="mt-1 text-xs text-white/55">
                {{ user.email }}
                <span v-if="joined"> · {{ joined }}</span>
              </p>
            </div>
          </div>
          <button type="button" class="me-logout" @click="logout">
            {{ t('auth.logout') }}
          </button>
        </div>

        <div class="me-rule"></div>
        <div class="mt-3 flex items-center justify-between gap-4 text-xs">
          <span class="text-white/70">{{ t('me.nextRank') }}</span>
          <span class="me-xp">{{ t('me.xp', { current: 0, total: XP_TOTAL }) }}</span>
        </div>
      </div>
    </section>

    <div class="mx-auto -mt-12 max-w-6xl px-6 pb-16">
      <section class="bg-white shadow-[0_8px_24px_rgba(28,25,23,0.06)]">
        <div class="me-panel">
          <div class="me-stats">
            <div class="me-stat me-stat-lead">
              <p class="text-muted text-[11px]">{{ t('me.exploreRate') }}</p>
              <p class="mt-2 text-4xl leading-none font-semibold tracking-tight">
                0<span class="ml-0.5 text-2xl font-medium">%</span>
              </p>
              <p class="text-muted mt-2 text-[11px]">{{ t('me.exploreDetail') }}</p>
            </div>
            <div class="me-stat">
              <p class="text-3xl leading-none font-semibold">
                {{ t('me.placeCount', { count: VISIT_COUNT }) }}
              </p>
              <p class="text-muted mt-2 text-[11px]">{{ t('me.visited') }}</p>
            </div>
            <div class="me-stat">
              <p class="text-3xl leading-none font-semibold">
                {{ t('me.pointCount', { count: AVERAGE_RATING }) }}
              </p>
              <p class="text-muted mt-2 text-[11px]">{{ t('me.avgRating') }}</p>
            </div>
            <div class="me-stat">
              <p class="text-3xl leading-none font-semibold">
                {{ t('me.placeCount', { count: FAVORITE_COUNT }) }}
              </p>
              <p class="text-muted mt-2 text-[11px]">{{ t('me.favorites') }}</p>
            </div>
          </div>

          <div class="me-regions">
            <p class="text-xs font-medium">{{ t('me.regionTitle') }}</p>
            <ul class="mt-3 space-y-2.5">
              <li v-for="region in regions" :key="region.code" class="me-region">
                <span>{{ region.ko }}</span>
                <span class="me-track"><span class="me-fill"></span></span>
                <span>0</span>
              </li>
            </ul>
          </div>
        </div>

        <ul class="me-badges">
          <li v-for="badge in badges" :key="badge">
            <span aria-hidden="true">★</span>
            {{ t(`me.${badge}`) }}
          </li>
        </ul>
      </section>

      <div class="mt-8 flex gap-6 border-b border-[#e6dfd2] text-sm" role="tablist">
        <button
          type="button"
          role="tab"
          class="-mb-px border-b-2 px-0.5 pb-2"
          :class="tab === 'visits' ? 'border-ink font-medium' : 'text-muted border-transparent'"
          :aria-selected="tab === 'visits'"
          @click="tab = 'visits'"
        >
          {{ t('me.tabVisits') }}
          <span
            class="ml-1.5 inline-block min-w-4 px-1 text-center text-[10px] leading-4"
            :class="tab === 'visits' ? 'bg-ink text-paper' : 'text-muted bg-[#ece7df]'"
          >
            {{ VISIT_COUNT }}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          class="-mb-px border-b-2 px-0.5 pb-2"
          :class="tab === 'favorites' ? 'border-ink font-medium' : 'text-muted border-transparent'"
          :aria-selected="tab === 'favorites'"
          @click="tab = 'favorites'"
        >
          {{ t('me.tabFavorites') }}
          <span
            class="ml-1.5 inline-block min-w-4 px-1 text-center text-[10px] leading-4"
            :class="tab === 'favorites' ? 'bg-ink text-paper' : 'text-muted bg-[#ece7df]'"
          >
            {{ FAVORITE_COUNT }}
          </span>
        </button>
      </div>

      <p
        class="text-muted mt-4 bg-white px-6 py-12 text-center text-sm shadow-[0_8px_24px_rgba(28,25,23,0.04)]"
      >
        {{ tab === 'visits' ? t('me.emptyVisits') : t('me.emptyFavorites') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.me-avatar {
  display: grid;
  width: 4.25rem;
  height: 4.25rem;
  flex-shrink: 0;
  place-items: center;
  background: #8d6b34;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.me-rank,
.me-xp {
  color: #d7b56d;
}

.me-rank {
  font-size: 11px;
  letter-spacing: 0.04em;
}

.me-logout {
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 2px;
  padding: 0.35rem 0.75rem;
  font-size: 12px;
}

.me-logout:hover {
  border-color: #d7b56d;
  color: #d7b56d;
}

.me-rule {
  height: 1px;
  margin-top: 1.5rem;
  background: #c4a574;
}

.me-panel {
  display: grid;
  gap: 1.75rem;
  padding: 1.5rem 1.5rem 1rem;
}

.me-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem 1rem;
  align-items: end;
}

.me-stat-lead {
  grid-column: 1 / -1;
}

@media (min-width: 900px) {
  .me-panel {
    grid-template-columns: minmax(0, 1.45fr) minmax(15rem, 0.7fr);
    align-items: start;
    padding: 1.75rem 1.75rem 1rem;
  }

  .me-stats {
    grid-template-columns: 1.3fr repeat(3, 1fr);
    gap: 0;
  }

  .me-stat-lead {
    grid-column: auto;
    border-right: 1px solid #eee6da;
    padding-right: 1.25rem;
  }

  .me-stat:not(.me-stat-lead) {
    padding-left: 1.25rem;
  }

  .me-regions {
    border-left: 1px solid #eee6da;
    padding-left: 1.5rem;
  }
}

.me-region {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) 0.75rem;
  align-items: center;
  gap: 0.5rem;
  color: #8a8178;
  font-size: 11px;
}

.me-track {
  display: block;
  height: 6px;
  background: #e7dcc8;
}

.me-fill {
  display: block;
  width: 0;
  height: 100%;
  background: #c4a574;
}

.me-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.75rem;
  margin: 0;
  border-top: 1px solid #eee6da;
  padding: 0.8rem 1.5rem 0.9rem;
  color: #8d8378;
  font-size: 11px;
  list-style: none;
}

.me-badges li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.me-badges span {
  color: #c4a574;
}
</style>
