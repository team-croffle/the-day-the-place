<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';

import AppFooter from '@/components/AppFooter.vue';
import AppHeader from '@/components/AppHeader.vue';

const route = useRoute();
const isMap = computed(() => route.path === '/map');
</script>

<template>
  <div class="flex min-h-screen flex-col" :class="{ 'h-screen overflow-hidden': isMap }">
    <AppHeader />
    <main class="flex-1" :class="{ 'min-h-0': isMap }">
      <RouterView />
    </main>
    <AppFooter v-if="!isMap" />
  </div>
</template>
