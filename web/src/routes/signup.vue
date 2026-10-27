<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';

import { authClient, authErrorCode } from '@/lib/authClient';

const { t } = useI18n();
const router = useRouter();
const session = authClient.useSession();

const name = ref('');
const email = ref('');
const password = ref('');
const passwordConfirm = ref('');
const pending = ref(false);
const sent = ref(false);
const errorKey = ref<string | null>(null);

watch(
  () => session.value.data,
  (data) => {
    if (data) void router.replace('/');
  },
);

async function submit(): Promise<void> {
  errorKey.value = null;
  if (password.value !== passwordConfirm.value) {
    errorKey.value = 'auth.passwordMismatch';
    return;
  }

  pending.value = true;
  const { error } = await authClient.signUp.email({
    name: name.value,
    email: email.value,
    password: password.value,
    callbackURL: `${window.location.origin}/`,
  });
  pending.value = false;
  if (!error) {
    sent.value = true;
    return;
  }

  const code = authErrorCode(error);
  if (code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
    errorKey.value = 'auth.emailTaken';
    return;
  }
  errorKey.value = code === 'PASSWORD_TOO_SHORT' ? 'auth.passwordShort' : 'auth.failed';
}
</script>

<template>
  <section class="mx-auto max-w-md px-6 py-16">
    <h1 class="text-2xl font-semibold">{{ t('auth.signupHeading') }}</h1>
    <p v-if="sent" class="mt-8 text-sm">{{ t('auth.checkEmail') }}</p>
    <form v-else class="mt-8 space-y-4" @submit.prevent="submit">
      <label class="block text-sm">
        <span>{{ t('auth.name') }}</span>
        <input
          v-model="name"
          type="text"
          required
          autocomplete="name"
          class="border-line placeholder:text-muted focus:border-ink mt-1 w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none"
        />
      </label>
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
      <p class="text-muted text-xs">{{ t('auth.passwordHint') }}</p>
      <p v-if="errorKey" class="text-sm text-red-700">{{ t(errorKey) }}</p>
      <button
        type="submit"
        class="bg-gold text-ink hover:bg-gold-hover w-full rounded-sm px-3 py-2 text-sm font-medium disabled:opacity-60"
        :disabled="pending"
      >
        {{ pending ? t('auth.pending') : t('auth.signupSubmit') }}
      </button>
    </form>
    <p class="text-muted mt-6 text-sm">
      {{ t('auth.hasAccount') }}
      <RouterLink to="/login" class="text-ink underline">{{ t('nav.login') }}</RouterLink>
    </p>
  </section>
</template>
