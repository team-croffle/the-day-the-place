import type { KakaoMapsNamespace } from '@/types/kakao';

const LOAD_MS = 12_000;

export function isKakaoMapsReady(
  maps: KakaoMapsNamespace | undefined = window.kakao?.maps,
): maps is KakaoMapsNamespace {
  return typeof maps?.LatLng === 'function' && typeof maps?.Map === 'function';
}

export function loadKakaoMaps(): Promise<KakaoMapsNamespace> {
  if (!import.meta.env.VITE_KAKAO_MAP_KEY) {
    return Promise.reject(new Error('missing_key'));
  }

  const ready = window.kakao?.maps;
  if (isKakaoMapsReady(ready)) {
    return Promise.resolve(ready);
  }

  const sdk = window.kakao?.maps;
  if (!sdk || typeof sdk.load !== 'function') {
    return Promise.reject(new Error('sdk_missing'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('sdk_load_failed'));
      }
    }, LOAD_MS);

    sdk.load(() => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      const loaded = window.kakao?.maps;
      if (!isKakaoMapsReady(loaded)) {
        reject(new Error('sdk_missing'));
        return;
      }
      resolve(loaded);
    });
  });
}
