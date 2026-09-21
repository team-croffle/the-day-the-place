<script setup lang="ts">
import { PLACE_KIND_LABELS, type PlaceKind, type PlaceSummary } from '@nest-vue/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  place: PlaceSummary;
  nearby: PlaceSummary[];
}>();

const emit = defineEmits<{
  close: [];
  select: [place: PlaceSummary];
}>();

const { t, locale } = useI18n();

function kindLabel(kind: PlaceKind): string {
  return PLACE_KIND_LABELS[kind][locale.value === 'en' ? 'en' : 'ko'];
}

const kindText = computed(() => kindLabel(props.place.kind));
</script>

<template>
  <aside class="border-line bg-paper flex h-full w-80 min-w-80 shrink-0 flex-col border-l">
    <div class="bg-line relative h-48 shrink-0 overflow-hidden">
      <img
        v-if="place.image"
        :src="place.image"
        :alt="place.name"
        class="h-full w-full object-cover"
      />
      <button
        type="button"
        class="bg-ink/70 text-paper hover:bg-ink absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none"
        :aria-label="t('map.previewClose')"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <p class="text-gold text-[11px]">
        {{ kindText }}
        <span v-if="place.category !== kindText"> · {{ place.category }}</span>
      </p>
      <h2 class="mt-1 text-lg font-semibold tracking-tight">{{ place.name }}</h2>
      <p v-if="place.address" class="text-muted mt-2 text-sm">{{ place.address }}</p>
      <p v-if="place.summary" class="text-muted mt-3 text-sm leading-relaxed">
        {{ place.summary }}
      </p>

      <section v-if="nearby.length > 0" class="mt-6">
        <h3 class="text-sm font-semibold">{{ t('map.nearby') }}</h3>
        <ul class="mt-2">
          <li v-for="item in nearby" :key="item.globalId">
            <button
              type="button"
              class="hover:bg-cream flex w-full items-center gap-3 rounded-sm py-2 text-left"
              @click="emit('select', item)"
            >
              <span
                class="bg-line h-12 w-12 shrink-0 overflow-hidden rounded-sm"
                aria-hidden="true"
              >
                <img
                  v-if="item.image"
                  :src="item.image"
                  :alt="''"
                  class="h-full w-full object-cover"
                />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ item.name }}</span>
                <span v-if="item.address" class="text-muted mt-0.5 block truncate text-xs">{{
                  item.address
                }}</span>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>
