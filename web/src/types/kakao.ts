export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoLatLngBounds {
  getSouthWest(): KakaoLatLng;
  getNorthEast(): KakaoLatLng;
}

export interface KakaoPoint {
  x: number;
  y: number;
}

export interface KakaoMapProjection {
  pointFromCoords(latlng: KakaoLatLng): KakaoPoint;
  containerPointFromCoords(latlng: KakaoLatLng): KakaoPoint;
}

export interface KakaoOverlayPanels {
  overlayLayer: HTMLElement;
}

export interface KakaoAbstractOverlay {
  setMap(map: KakaoMapInstance | null): void;
  getPanels(): KakaoOverlayPanels;
  getProjection(): KakaoMapProjection;
}

export interface KakaoMapInstance {
  getBounds(): KakaoLatLngBounds;
  getLevel(): number;
  setLevel(level: number): void;
  setCenter(latlng: KakaoLatLng): void;
  getProjection(): KakaoMapProjection;
  getNode(): HTMLElement;
  relayout(): void;
}

export interface KakaoMapsNamespace {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMapInstance;
  AbstractOverlay: new () => KakaoAbstractOverlay;
  event: {
    addListener: (target: object, type: string, handler: () => void) => void;
    removeListener: (target: object, type: string, handler: () => void) => void;
  };
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsNamespace };
  }
}
