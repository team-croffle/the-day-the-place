import type { KakaoMapsNamespace } from '@/types/kakao';

const SCRIPT_ID = 'kakao-map-sdk';

export function loadKakaoMaps(): Promise<KakaoMapsNamespace> {
  const appkey = import.meta.env.VITE_KAKAO_MAP_KEY;
  if (!appkey) {
    return Promise.reject(new Error('missing_key'));
  }

  if (window.kakao?.maps?.Map) {
    return Promise.resolve(window.kakao.maps);
  }

  return new Promise((resolve, reject) => {
    const finish = (): void => {
      const sdk = window.kakao?.maps;
      if (!sdk) {
        reject(new Error('sdk_missing'));
        return;
      }
      sdk.load(() => {
        const loaded = window.kakao?.maps;
        if (!loaded) {
          reject(new Error('sdk_missing'));
          return;
        }
        resolve(loaded);
      });
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      if (window.kakao?.maps) {
        finish();
      } else {
        existing.addEventListener('load', finish);
        existing.addEventListener('error', () => reject(new Error('sdk_load_failed')));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false`;
    script.async = true;
    script.addEventListener('load', finish);
    script.addEventListener('error', () => reject(new Error('sdk_load_failed')));
    document.head.append(script);
  });
}
