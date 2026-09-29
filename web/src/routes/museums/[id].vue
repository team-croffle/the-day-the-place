<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import PlaceDetailView from '@/components/places/PlaceDetailView.vue';

const route = useRoute();
const id = computed(() => ('id' in route.params ? route.params.id : ''));
</script>

<template>
  <PlaceDetailView kind="museum" :id="id" list-path="/museums" list-title-key="museums.heroTitle" />
</template>
