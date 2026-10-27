<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';

import { authClient, authErrorCode } from '@/lib/authClient';

const { t } = useI18n();
const router = useRouter();
const session = authClient.useSession();

const email = ref('');
const password = ref('');
const pending = ref(false);
const errorKey = ref<string | null>(null);

watch(
  () => session.value.data,
  (data) => {
    if (data) void router.replace('/');
  },
);

async function submit(): Promise<void> {
  errorKey.value = null;
  pending.value = true;
  const { error } = await authClient.signIn.email({
    email: email.value,
    password: password.value,
  });
  pending.value = false;
  if (!error) return;

  const code = authErrorCode(error);
  if (code === 'EMAIL_NOT_VERIFIED') {
    errorKey.value = 'auth.emailUnverified';
    return;
  }
  errorKey.value = code === 'INVALID_EMAIL_OR_PASSWORD' ? 'auth.invalidCredentials' : 'auth.failed';
}
</script>

<template>
  <section class="mx-auto max-w-md px-6 py-16">
    <h1 class="text-2xl font-semibold">{{ t('auth.loginHeading') }}</h1>
    <form class="mt-8 space-y-4" @submit.prevent="submit">
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
      <label class="block text-sm">
        <span>{{ t('auth.password') }}</span>
        <input
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          class="border-line placeholder:text-muted focus:border-ink mt-1 w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none"
        />
      </label>
      <p v-if="errorKey" class="text-sm text-red-700">{{ t(errorKey) }}</p>
      <p class="text-sm">
        <RouterLink to="/forgot-password" class="text-ink underline">
          {{ t('auth.forgotPassword') }}
        </RouterLink>
      </p>
      <button
        type="submit"
        class="bg-gold text-ink hover:bg-gold-hover w-full rounded-sm px-3 py-2 text-sm font-medium disabled:opacity-60"
        :disabled="pending"
      >
        {{ pending ? t('auth.pending') : t('auth.loginSubmit') }}
      </button>
    </form>
    <p class="text-muted mt-6 text-sm">
      {{ t('auth.noAccount') }}
      <RouterLink to="/signup" class="text-ink underline">{{ t('nav.signup') }}</RouterLink>
    </p>
  </section>
</template>
