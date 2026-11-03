export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      url.hostname = 'api.dayplace.croffledev.kr';
      url.protocol = 'https:';
      url.port = '';

      return fetch(new Request(url, request), { redirect: 'manual' });
    }

    return env.ASSETS.fetch(request);
  },
};
