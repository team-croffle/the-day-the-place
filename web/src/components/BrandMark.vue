<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="bg-ink text-gold flex h-full w-full flex-col items-center justify-center gap-2 px-3">
    <svg class="h-12 w-12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        d="M12 2c-4.4 0-8 3.4-8 7.6 0 5.4 8 12.4 8 12.4s8-7 8-12.4C20 5.4 16.4 2 12 2Zm0 10.2A2.6 2.6 0 1 1 12 7a2.6 2.6 0 0 1 0 5.2Z"
      />
    </svg>
    <p class="text-paper/80 text-center text-xs">{{ t('exhibitions.noImage') }}</p>
  </div>
</template>
