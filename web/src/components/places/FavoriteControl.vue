<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

const props = defineProps<{
  count: number | null;
  saved: boolean;
  loggedIn: boolean;
  sessionPending: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const { t } = useI18n();

const countLabel = computed(() =>
  props.count === null ? '' : t('places.favoriteCount', { n: props.count }),
);
</script>

<template>
  <span class="inline-flex items-center gap-2 text-sm">
    <span v-if="count !== null" class="text-muted" :aria-label="countLabel">{{ count }}</span>
    <RouterLink
      v-if="!sessionPending && !loggedIn"
      to="/login"
      class="border-line rounded-sm border px-3 py-1.5"
    >
      {{ t('places.favorite') }}
    </RouterLink>
    <button
      v-else
      type="button"
      class="rounded-sm border px-3 py-1.5 disabled:opacity-40"
      :class="saved ? 'border-ink bg-ink text-paper' : 'border-line'"
      :disabled="sessionPending || busy"
      :aria-pressed="saved"
      @click="emit('toggle')"
    >
      {{ saved ? t('places.favoriteSaved') : t('places.favorite') }}
    </button>
  </span>
</template>
