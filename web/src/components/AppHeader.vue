<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import LocaleSwitcher from '@/components/LocaleSwitcher.vue';
import { PRIMARY_NAV } from '@/constants/nav';

const { t } = useI18n();
</script>

<template>
  <header class="bg-ink text-paper sticky top-0 z-40">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
      <RouterLink to="/" class="text-paper flex shrink-0 items-center gap-2">
        <span class="text-gold" aria-hidden="true">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2c-4.4 0-8 3.4-8 7.6 0 5.4 8 12.4 8 12.4s8-7 8-12.4C20 5.4 16.4 2 12 2Zm0 10.2A2.6 2.6 0 1 1 12 7a2.6 2.6 0 0 1 0 5.2Z"
            />
          </svg>
        </span>
        <span class="leading-tight">
          <span class="block font-semibold tracking-tight">{{ t('app.title') }}</span>
          <span class="text-gold hidden text-[10px] tracking-widest uppercase sm:block">{{
            t('app.tagline')
          }}</span>
        </span>
      </RouterLink>

      <nav class="flex flex-1 items-center gap-6 text-sm">
        <RouterLink
          v-for="item in PRIMARY_NAV"
          :key="item.to"
          :to="item.to"
          class="text-paper/80 hover:text-paper border-b-2 border-transparent py-1"
          active-class="!border-gold !text-gold"
        >
          {{ t(item.key) }}
        </RouterLink>
      </nav>

      <div class="flex items-center gap-3">
        <LocaleSwitcher />
        <RouterLink to="/login" class="text-paper hover:text-gold hidden text-sm sm:inline">
          {{ t('nav.login') }}
        </RouterLink>
        <RouterLink
          to="/signup"
          class="bg-gold text-ink hover:bg-gold-hover rounded-sm px-3 py-1.5 text-sm font-medium"
        >
          {{ t('nav.signup') }}
        </RouterLink>
      </div>
    </div>
  </header>
</template>
