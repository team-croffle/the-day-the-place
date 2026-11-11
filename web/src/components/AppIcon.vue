<script setup lang="ts">
defineProps<{
  name:
    | 'map'
    | 'museum'
    | 'site'
    | 'exhibition'
    | 'login'
    | 'signup'
    | 'logout'
    | 'user'
    | 'search';
}>();
</script>

<template>
  <svg
    class="h-4 w-4 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'map'">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </template>
    <template v-else-if="name === 'museum'">
      <path d="M4 20h16" />
      <path d="M6 20V10" />
      <path d="M10 20V10" />
      <path d="M14 20V10" />
      <path d="M18 20V10" />
      <path d="M3 10l9-6 9 6" />
    </template>
    <template v-else-if="name === 'site'">
      <path d="M3 18l9-13 9 13" />
      <path d="M8 18v3" />
      <path d="M16 18v3" />
      <path d="M4 21h16" />
    </template>
    <template v-else-if="name === 'exhibition'">
      <rect x="4" y="5" width="16" height="14" rx="1" />
      <path d="M8 15l3-3 2 2 3-4" />
    </template>
    <template v-else-if="name === 'login'">
      <path d="M15 4h4v16h-4" />
      <path d="M10 12H3" />
      <path d="M7 8l4 4-4 4" />
    </template>
    <template v-else-if="name === 'signup'">
      <circle cx="10" cy="8" r="3" />
      <path d="M4 19c1.2-3 3.2-4.5 6-4.5" />
      <path d="M17 11v6" />
      <path d="M14 14h6" />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M9 4H5v16h4" />
      <path d="M10 12h11" />
      <path d="M17 8l4 4-4 4" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="3" />
      <path d="M6 19c1.5-3 3.5-4.5 6-4.5s4.5 1.5 6 4.5" />
    </template>
    <template v-else>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.5-3.5" />
    </template>
  </svg>
</template>
