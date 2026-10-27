<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import { authClient } from '@/lib/authClient';

const { t } = useI18n();
const email = ref('');
const pending = ref(false);
const sent = ref(false);
const errorKey = ref<string | null>(null);

async function submit(): Promise<void> {
  errorKey.value = null;
  pending.value = true;
  const { error } = await authClient.requestPasswordReset({
    email: email.value,
    redirectTo: `${window.location.origin}/reset-password`,
  });
  pending.value = false;
  if (error) {
    errorKey.value = 'auth.failed';
    return;
  }
  sent.value = true;
}
</script>

<template>
  <section class="mx-auto max-w-md px-6 py-16">
    <h1 class="text-2xl font-semibold">{{ t('auth.forgotHeading') }}</h1>
    <p v-if="sent" class="mt-8 text-sm">{{ t('auth.forgotSent') }}</p>
    <form v-else class="mt-8 space-y-4" @submit.prevent="submit">
      <label class="block text-sm">
        <span>{{ t('auth.email') }}</span>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="border-line placeholder:text-muted focus:border-ink mt-1 w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none"
        />
      </label>
      <p v-if="errorKey" class="text-sm text-red-700">{{ t(errorKey) }}</p>
      <button
        type="submit"
        class="bg-gold text-ink hover:bg-gold-hover w-full rounded-sm px-3 py-2 text-sm font-medium disabled:opacity-60"
        :disabled="pending"
      >
        {{ pending ? t('auth.pending') : t('auth.forgotSubmit') }}
      </button>
    </form>
    <p class="text-muted mt-6 text-sm">
      <RouterLink to="/login" class="text-ink underline">{{ t('nav.login') }}</RouterLink>
    </p>
  </section>
</template>
