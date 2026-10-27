<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';

import { authClient, authErrorCode } from '@/lib/authClient';

const { t } = useI18n();
const route = useRoute();
const password = ref('');
const passwordConfirm = ref('');
const pending = ref(false);
const done = ref(false);
const errorKey = ref<string | null>(null);

const token = computed(() => {
  const value = route.query.token;
  return typeof value === 'string' ? value : '';
});
const linkInvalid = computed(() => !token.value || typeof route.query.error === 'string');

async function submit(): Promise<void> {
  errorKey.value = null;
  if (password.value !== passwordConfirm.value) {
    errorKey.value = 'auth.passwordMismatch';
    return;
  }
  pending.value = true;
  const { error } = await authClient.resetPassword({
    newPassword: password.value,
    token: token.value,
  });
  pending.value = false;
  if (!error) {
    done.value = true;
    return;
  }
  const code = authErrorCode(error);
  errorKey.value = code === 'PASSWORD_TOO_SHORT' ? 'auth.passwordShort' : 'auth.resetInvalid';
}
</script>

<template>
  <section class="mx-auto max-w-md px-6 py-16">
    <h1 class="text-2xl font-semibold">{{ t('auth.resetHeading') }}</h1>
    <p v-if="done" class="mt-8 text-sm">
      {{ t('auth.resetDone') }}
      <RouterLink to="/login" class="text-ink underline">{{ t('nav.login') }}</RouterLink>
    </p>
    <p v-else-if="linkInvalid" class="mt-8 text-sm">{{ t('auth.resetInvalid') }}</p>
    <form v-else class="mt-8 space-y-4" @submit.prevent="submit">
      <label class="block text-sm">
        <span>{{ t('auth.newPassword') }}</span>
        <input
          v-model="password"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          class="border-line placeholder:text-muted focus:border-ink mt-1 w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none"
        />
      </label>
      <label class="block text-sm">
        <span>{{ t('auth.passwordConfirm') }}</span>
        <input
          v-model="passwordConfirm"
          type="password"
          required
          minlength="8"
          autocomplete="new-password"
          class="border-line placeholder:text-muted focus:border-ink mt-1 w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none"
        />
      </label>
      <p v-if="errorKey" class="text-sm text-red-700">{{ t(errorKey) }}</p>
      <button
        type="submit"
        class="bg-gold text-ink hover:bg-gold-hover w-full rounded-sm px-3 py-2 text-sm font-medium disabled:opacity-60"
        :disabled="pending"
      >
        {{ pending ? t('auth.pending') : t('auth.resetSubmit') }}
      </button>
    </form>
  </section>
</template>
