<script setup lang="ts">
import {
  API_ROUTES,
  USER_ROLES,
  type CollectorStatus,
  type Paginated,
  type User,
  type UserRole,
} from '@nest-vue/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';

import { ApiError, apiFetch } from '@/composables/useApi';
import { authClient } from '@/lib/authClient';

const { t, locale } = useI18n();
const router = useRouter();
const session = authClient.useSession();

const page = ref(1);
const opened = ref(false);
const loading = ref(false);
const collector = ref<CollectorStatus | null>(null);
const members = ref<Paginated<User> | null>(null);
const names = ref<Record<string, string>>({});
const collectorError = ref<string | null>(null);
const membersError = ref<string | null>(null);
const actionError = ref<string | null>(null);
const busyId = ref<string | null>(null);
const pendingDeleteId = ref<string | null>(null);

const isAdmin = computed(() => {
  const user = session.value.data?.user;
  return !!user && 'role' in user && user.role === 'admin';
});
const currentId = computed(() => session.value.data?.user.id ?? '');

watch(
  () => [session.value.isPending, session.value.data, isAdmin.value] as const,
  ([pending, data, admin]) => {
    if (pending) return;
    if (!data) {
      void router.replace('/login');
      return;
    }
    if (!admin) {
      void router.replace('/me');
      return;
    }
    if (!opened.value) {
      opened.value = true;
      void load();
    }
  },
  { immediate: true },
);

watch(page, () => {
  if (opened.value) void load();
});

function refusalKey(error: unknown): string {
  const message = error instanceof ApiError ? error.message : '';
  if (message === 'self-role') return 'admin.selfRole';
  if (message === 'self-delete') return 'admin.selfDelete';
  if (message === 'last-admin') return 'admin.lastAdmin';
  return 'admin.saveFailed';
}

function formatJoined(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale.value === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

async function load(): Promise<void> {
  loading.value = true;
  collectorError.value = null;
  membersError.value = null;
  const [statusResult, membersResult] = await Promise.allSettled([
    apiFetch<CollectorStatus>(`/${API_ROUTES.ADMIN_COLLECTOR}`),
    apiFetch<Paginated<User>>(`/${API_ROUTES.USERS}?page=${page.value}`),
  ]);
  if (statusResult.status === 'fulfilled') {
    collector.value = statusResult.value;
  } else {
    collector.value = null;
    collectorError.value = t('admin.collectorFailed');
  }
  if (membersResult.status === 'fulfilled') {
    members.value = membersResult.value;
    names.value = Object.fromEntries(membersResult.value.items.map((user) => [user.id, user.name]));
  } else {
    members.value = null;
    membersError.value = t('admin.loadFailed');
  }
  loading.value = false;
}

function replaceMember(next: User): void {
  if (!members.value) return;
  members.value = {
    ...members.value,
    items: members.value.items.map((user) => (user.id === next.id ? next : user)),
  };
  names.value = { ...names.value, [next.id]: next.name };
}

async function saveName(user: User): Promise<void> {
  const name = names.value[user.id]?.trim() ?? '';
  if (!name || name === user.name) return;
  actionError.value = null;
  busyId.value = user.id;
  try {
    const updated = await apiFetch<User>(`/${API_ROUTES.USERS}/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    replaceMember(updated);
  } catch (error) {
    names.value = { ...names.value, [user.id]: user.name };
    actionError.value = t(refusalKey(error));
  } finally {
    busyId.value = null;
  }
}

async function onRole(user: User, event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const role = select.value as UserRole;
  if (role === user.role) return;
  actionError.value = null;
  busyId.value = user.id;
  try {
    const updated = await apiFetch<User>(`/${API_ROUTES.USERS}/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    replaceMember(updated);
  } catch (error) {
    select.value = user.role;
    actionError.value = t(refusalKey(error));
  } finally {
    busyId.value = null;
  }
}

async function removeMember(user: User): Promise<void> {
  actionError.value = null;
  busyId.value = user.id;
  try {
    await apiFetch<void>(`/${API_ROUTES.USERS}/${user.id}`, { method: 'DELETE' });
    pendingDeleteId.value = null;
    if ((members.value?.items.length ?? 0) === 1 && page.value > 1) {
      page.value -= 1;
      return;
    }
    await load();
  } catch (error) {
    actionError.value = t(refusalKey(error));
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <p
    v-if="session.isPending || (isAdmin && loading && !members)"
    class="text-muted mx-auto max-w-6xl px-6 py-16 text-sm"
  >
    {{ t('admin.loading') }}
  </p>

  <section v-else-if="isAdmin" class="mx-auto max-w-6xl px-6 py-12">
    <p class="text-muted text-xs">
      <RouterLink to="/" class="hover:text-ink">{{ t('admin.home') }}</RouterLink>
      <span aria-hidden="true"> › </span>
      <span>{{ t('nav.adminPage') }}</span>
    </p>
    <h1 class="mt-3 text-2xl font-semibold">{{ t('nav.adminPage') }}</h1>
    <p class="text-muted mt-2 text-sm">{{ t('admin.lead') }}</p>

    <h2 class="mt-10 text-lg font-semibold">{{ t('admin.collectorTitle') }}</h2>
    <p class="text-muted mt-1 text-sm">{{ t('admin.collectorNote') }}</p>
    <p v-if="collectorError" class="mt-4 text-sm text-red-700">{{ collectorError }}</p>
    <div v-else-if="collector" class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <article class="border-line border bg-white px-4 py-4">
        <p class="text-muted text-xs">{{ t('admin.museumOr') }}</p>
        <p class="mt-2 text-2xl font-semibold">
          {{ t('admin.cursorValue', { n: collector.museumOr }) }}
        </p>
      </article>
      <article class="border-line border bg-white px-4 py-4">
        <p class="text-muted text-xs">{{ t('admin.museumnews') }}</p>
        <p class="mt-2 text-2xl font-semibold">
          {{ t('admin.cursorValue', { n: collector.museumnews }) }}
        </p>
      </article>
      <article class="border-line border bg-white px-4 py-4">
        <p class="text-muted text-xs">{{ t('admin.pendingCount') }}</p>
        <p class="mt-2 text-2xl font-semibold">
          {{ t('admin.countValue', { n: collector.pendingCount }) }}
        </p>
      </article>
      <article class="border-line border bg-white px-4 py-4">
        <p class="text-muted text-xs">{{ t('admin.exhibitionCount') }}</p>
        <p class="mt-2 text-2xl font-semibold">
          {{ t('admin.countValue', { n: collector.exhibitionCount }) }}
        </p>
      </article>
    </div>

    <h2 class="mt-12 text-lg font-semibold">{{ t('admin.membersTitle') }}</h2>
    <p class="text-muted mt-1 text-sm">{{ t('admin.membersNote') }}</p>
    <p v-if="actionError" class="mt-4 text-sm text-red-700">{{ actionError }}</p>
    <p v-if="membersError" class="mt-4 text-sm text-red-700">{{ membersError }}</p>
    <p v-else-if="members && members.items.length === 0" class="text-muted mt-4 text-sm">
      {{ t('admin.empty') }}
    </p>
    <div v-else-if="members" class="border-line mt-4 overflow-x-auto border bg-white">
      <table class="w-full min-w-[40rem] text-left text-sm">
        <thead class="text-muted border-line border-b text-xs">
          <tr>
            <th class="px-4 py-3 font-medium">{{ t('admin.name') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('admin.email') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('admin.role') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('admin.joined') }}</th>
            <th class="px-4 py-3 font-medium">{{ t('admin.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in members.items"
            :key="user.id"
            class="border-line border-b last:border-b-0"
          >
            <td class="px-4 py-3">
              <form class="flex items-center gap-2" @submit.prevent="saveName(user)">
                <input
                  v-model="names[user.id]"
                  type="text"
                  required
                  maxlength="60"
                  class="border-line focus:border-ink w-full min-w-32 rounded-sm border bg-white px-2 py-1.5 outline-none"
                  :disabled="busyId === user.id"
                  :aria-label="t('admin.name')"
                />
                <button
                  type="submit"
                  class="text-ink shrink-0 text-xs underline disabled:opacity-40"
                  :disabled="busyId === user.id || (names[user.id] ?? '').trim() === user.name"
                >
                  {{ t('admin.saveName') }}
                </button>
              </form>
            </td>
            <td class="text-muted px-4 py-3">{{ user.email }}</td>
            <td class="px-4 py-3">
              <select
                class="border-line focus:border-ink rounded-sm border bg-white px-2 py-1.5 outline-none disabled:opacity-60"
                :value="user.role"
                :disabled="user.id === currentId || busyId === user.id"
                :aria-label="t('admin.role')"
                @change="onRole(user, $event)"
              >
                <option v-for="role in USER_ROLES" :key="role" :value="role">
                  {{ role === 'admin' ? t('admin.roleAdmin') : t('admin.roleMember') }}
                </option>
              </select>
            </td>
            <td class="text-muted px-4 py-3 whitespace-nowrap">
              {{ formatJoined(user.createdAt) }}
            </td>
            <td class="px-4 py-3">
              <template v-if="user.id !== currentId">
                <button
                  v-if="pendingDeleteId !== user.id"
                  type="button"
                  class="text-xs text-red-700 underline disabled:opacity-40"
                  :disabled="busyId === user.id"
                  @click="pendingDeleteId = user.id"
                >
                  {{ t('admin.delete') }}
                </button>
                <span v-else class="flex items-center gap-2">
                  <button
                    type="button"
                    class="text-xs text-red-700 underline disabled:opacity-40"
                    :disabled="busyId === user.id"
                    @click="removeMember(user)"
                  >
                    {{ t('admin.confirmDelete') }}
                  </button>
                  <button
                    type="button"
                    class="text-muted text-xs underline"
                    @click="pendingDeleteId = null"
                  >
                    {{ t('admin.cancel') }}
                  </button>
                </span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="members && members.totalPages > 1" class="mt-4 flex items-center gap-3 text-sm">
      <button
        type="button"
        class="border-line rounded-sm border px-3 py-1.5 disabled:opacity-40"
        :disabled="page <= 1 || loading"
        @click="page -= 1"
      >
        {{ t('admin.prev') }}
      </button>
      <span class="text-muted">{{ t('admin.page', { page, total: members.totalPages }) }}</span>
      <button
        type="button"
        class="border-line rounded-sm border px-3 py-1.5 disabled:opacity-40"
        :disabled="page >= members.totalPages || loading"
        @click="page += 1"
      >
        {{ t('admin.next') }}
      </button>
    </div>
  </section>
</template>
