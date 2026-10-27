import { createAuthClient } from 'better-auth/vue';

const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;

/** 같은 출처(/api 프록시)면 비운다. 다른 출처면 API 호스트만 남긴다. */
function serverOrigin(): string | undefined {
  if (!apiBase || apiBase.startsWith('/')) return undefined;
  return apiBase.replace(/\/api\/?$/, '');
}

export const authClient = createAuthClient({
  baseURL: serverOrigin(),
  fetchOptions: {
    credentials: 'include',
  },
});

export function authErrorCode(error: { code?: string } | null): string | undefined {
  return error?.code;
}
