<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { applyFontStep, currentFontStep, fontSteps, type FontStep } from '@/lib/fontScale';

const { t } = useI18n();
const steps = fontSteps();
const step = ref<FontStep>(currentFontStep());
const index = computed(() => steps.indexOf(step.value));

function choose(next: FontStep): void {
  step.value = next;
  applyFontStep(next);
}
</script>

<template>
  <div class="border-paper/30 flex items-center rounded-sm border">
    <button
      type="button"
      class="text-paper hover:text-gold px-1.5 py-1 text-xs disabled:opacity-40"
      :disabled="index <= 0"
      :aria-label="t('font.decrease')"
      @click="choose(steps[index - 1]!)"
    >
      가-
    </button>
    <button
      type="button"
      class="text-paper hover:text-gold border-paper/30 border-l px-1.5 py-1 text-sm disabled:opacity-40"
      :disabled="index >= steps.length - 1"
      :aria-label="t('font.increase')"
      @click="choose(steps[index + 1]!)"
    >
      가+
    </button>
  </div>
</template>
