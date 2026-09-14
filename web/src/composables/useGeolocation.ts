export const SEOUL_CENTER = { lat: 37.5665, lng: 126.978 };

export async function resolveMapCenter(): Promise<{ lat: number; lng: number }> {
  if (!navigator.geolocation) {
    return SEOUL_CENTER;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: { lat: number; lng: number }): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(SEOUL_CENTER), 1500);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        finish({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        finish(SEOUL_CENTER);
      },
      { enableHighAccuracy: false, timeout: 1500, maximumAge: 60_000 },
    );
  });
}
