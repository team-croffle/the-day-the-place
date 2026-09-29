<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import PlaceDetailView from '@/components/places/PlaceDetailView.vue';

const route = useRoute();
const id = computed(() => ('id' in route.params ? route.params.id : ''));
</script>

<template>
  <PlaceDetailView kind="site" :id="id" list-path="/sites" list-title-key="sites.heroTitle" />
</template>
