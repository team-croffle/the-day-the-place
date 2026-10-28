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
const actionLabel = computed(() =>
  props.saved ? t('places.favoriteUnsave') : t('places.favoriteSave'),
);
const heartFill = computed(() => (props.saved ? '#dc2626' : 'none'));
const heartStroke = computed(() => (props.saved ? '#dc2626' : 'currentColor'));
</script>

<template>
  <span class="inline-flex items-center gap-2 text-sm">
    <RouterLink
      v-if="!sessionPending && !loggedIn"
      to="/login"
      class="text-ink inline-flex h-9 w-9 items-center justify-center"
      :aria-label="t('places.favoriteSave')"
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6" aria-hidden="true">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
        />
      </svg>
    </RouterLink>
    <button
      v-else
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center disabled:opacity-40"
      :class="saved ? 'text-red-600' : 'text-ink'"
      :disabled="sessionPending || busy"
      :aria-pressed="saved"
      :aria-label="actionLabel"
      @click="emit('toggle')"
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6" aria-hidden="true">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          :fill="heartFill"
          :stroke="heartStroke"
          stroke-width="1.7"
        />
      </svg>
    </button>
    <span v-if="count !== null">{{ countLabel }}</span>
  </span>
</template>
