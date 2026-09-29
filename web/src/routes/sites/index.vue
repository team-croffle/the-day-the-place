<script setup lang="ts">
import PlaceListView from '@/components/places/PlaceListView.vue';
</script>

<template>
  <PlaceListView
    kind="site"
    title-key="sites.heroTitle"
    body-key="sites.heroBody"
    :categories="[]"
  />
</template>
