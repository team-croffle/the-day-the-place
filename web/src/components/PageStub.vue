<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ titleKey: string; bodyKey: string }>();

const { t } = useI18n();
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 py-16">
    <h1 class="text-2xl font-semibold">{{ t(titleKey) }}</h1>
    <p class="text-muted mt-3">{{ t(bodyKey) }}</p>
  </section>
</template>
