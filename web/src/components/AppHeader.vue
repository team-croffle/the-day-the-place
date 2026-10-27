<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import LocaleSwitcher from '@/components/LocaleSwitcher.vue';
import { PRIMARY_NAV } from '@/constants/nav';
import { authClient } from '@/lib/authClient';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = authClient.useSession();
const onMe = computed(() => route.path === '/me');
const onAccount = computed(() => route.path === '/me' || route.path.startsWith('/admin'));
const isAdmin = computed(() => {
  const user = session.value.data?.user;
  return !!user && 'role' in user && user.role === 'admin';
});

async function logout(): Promise<void> {
  await authClient.signOut();
  await router.push('/');
}
</script>

<template>
  <header class="bg-ink text-paper sticky top-0 z-40">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
      <RouterLink to="/" class="text-paper flex shrink-0 items-center gap-2">
        <span class="text-gold" aria-hidden="true">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2c-4.4 0-8 3.4-8 7.6 0 5.4 8 12.4 8 12.4s8-7 8-12.4C20 5.4 16.4 2 12 2Zm0 10.2A2.6 2.6 0 1 1 12 7a2.6 2.6 0 0 1 0 5.2Z"
            />
          </svg>
        </span>
        <span class="leading-tight">
          <span class="block font-semibold tracking-tight">{{ t('app.title') }}</span>
          <span class="text-gold hidden text-[10px] tracking-widest uppercase sm:block">{{
            t('app.tagline')
          }}</span>
        </span>
      </RouterLink>

      <nav class="flex flex-1 items-center gap-6 text-sm">
        <RouterLink
          v-for="item in PRIMARY_NAV"
          :key="item.to"
          :to="item.to"
          class="text-paper/80 hover:text-paper border-b-2 border-transparent py-1"
          active-class="!border-gold !text-gold"
        >
          {{ t(item.key) }}
        </RouterLink>
      </nav>

      <div class="flex items-center gap-3">
        <LocaleSwitcher />
        <template v-if="!session.isPending && session.data">
          <div v-if="isAdmin" class="account-menu">
            <span class="text-sm" :class="onAccount ? 'text-gold' : 'text-paper'">
              {{ session.data.user.name }}
            </span>
            <div class="account-panel">
              <div class="account-list">
                <RouterLink to="/me" class="account-item" :class="onMe ? 'text-gold' : 'text-ink'">
                  {{ t('nav.myPage') }}
                </RouterLink>
                <RouterLink
                  to="/admin"
                  class="account-item"
                  :class="route.path.startsWith('/admin') ? 'text-gold' : 'text-ink'"
                >
                  {{ t('nav.adminPage') }}
                </RouterLink>
              </div>
            </div>
          </div>
          <RouterLink
            v-else
            to="/me"
            class="hover:text-gold hidden text-sm sm:inline"
            :class="onMe ? 'text-gold' : 'text-paper'"
          >
            {{ session.data.user.name }}
          </RouterLink>
          <button type="button" class="text-paper hover:text-gold text-sm" @click="logout">
            {{ t('auth.logout') }}
          </button>
        </template>
        <template v-else-if="!session.isPending">
          <RouterLink to="/login" class="text-paper hover:text-gold hidden text-sm sm:inline">
            {{ t('nav.login') }}
          </RouterLink>
          <RouterLink
            to="/signup"
            class="bg-gold text-ink hover:bg-gold-hover rounded-sm px-3 py-1.5 text-sm font-medium"
          >
            {{ t('nav.signup') }}
          </RouterLink>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.account-menu {
  position: relative;
  display: none;
  height: 4rem;
  align-items: center;
}

@media (min-width: 640px) {
  .account-menu {
    display: flex;
  }
}

.account-panel {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 50;
  padding-top: 0.25rem;
}

.account-menu:hover .account-panel {
  display: block;
}

.account-list {
  min-width: 9.5rem;
  background: var(--color-paper);
  border: 1px solid var(--color-line);
  border-radius: 2px;
  padding: 0.25rem 0;
  box-shadow: 0 8px 24px rgb(28 25 23 / 12%);
}

.account-item {
  display: block;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  white-space: nowrap;
}

.account-item:hover {
  background: var(--color-cream);
}
</style>
