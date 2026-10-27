<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { authClient } from '@/lib/authClient';

const { t } = useI18n();
const router = useRouter();
const session = authClient.useSession();

const isAdmin = computed(() => {
  const user = session.value.data?.user;
  return !!user && 'role' in user && user.role === 'admin';
});

watch(
  () => [session.value.isPending, session.value.data] as const,
  ([pending, data]) => {
    if (pending) return;
    if (!data) {
      void router.replace('/login');
      return;
    }
    if (!isAdmin.value) void router.replace('/me');
  },
  { immediate: true },
);
</script>

<template>
  <section v-if="isAdmin" class="mx-auto max-w-6xl px-6 py-16">
    <h1 class="text-2xl font-semibold">{{ t('nav.adminPage') }}</h1>
  </section>
</template>
