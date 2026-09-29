<script setup lang="ts">
import PlaceListView from '@/components/places/PlaceListView.vue';

const categories = ['박물관', '기념관', '전시관'] as const;
</script>

<template>
  <PlaceListView
    kind="museum"
    title-key="museums.heroTitle"
    body-key="museums.heroBody"
    :categories="categories"
  />
</template>
