<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

const { t } = useI18n();

const explore = [
  { to: '/museums', key: 'footer.museums' },
  { to: '/sites', key: 'footer.sites' },
  { to: '/exhibitions', key: 'footer.exhibitions' },
  { to: '/#eras', key: 'footer.eras' },
] as const;
</script>

<template>
  <footer class="border-line bg-paper text-muted border-t text-sm">
    <div class="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p class="text-ink font-semibold">{{ t('app.title') }}</p>
        <p class="mt-3 max-w-xs leading-relaxed">{{ t('footer.blurb') }}</p>
      </div>
      <div>
        <p class="text-ink mb-3 font-medium">{{ t('footer.explore') }}</p>
        <ul class="space-y-2">
          <li v-for="item in explore" :key="item.key">
            <RouterLink :to="item.to" class="hover:text-ink">{{ t(item.key) }}</RouterLink>
          </li>
        </ul>
      </div>
      <div>
        <p class="text-ink mb-3 font-medium">{{ t('footer.service') }}</p>
        <ul class="space-y-2">
          <li>{{ t('footer.serviceSoon') }}</li>
        </ul>
      </div>
      <div>
        <p class="text-ink mb-3 font-medium">{{ t('footer.info') }}</p>
        <ul class="space-y-2">
          <li>
            <RouterLink to="/about" class="hover:text-ink">{{ t('footer.about') }}</RouterLink>
          </li>
        </ul>
      </div>
    </div>
    <div class="border-line border-t px-6 py-4 text-center text-xs">
      {{ t('footer.copyright') }}
    </div>
  </footer>
</template>
