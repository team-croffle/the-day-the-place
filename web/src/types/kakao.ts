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
  coordsFromContainerPoint(point: KakaoPoint): KakaoLatLng;
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

export interface KakaoMouseEvent {
  latLng: KakaoLatLng;
}

export interface KakaoMapsNamespace {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Point: new (x: number, y: number) => KakaoPoint;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMapInstance;
  event: {
    addListener: (target: object, type: string, handler: (event?: KakaoMouseEvent) => void) => void;
    removeListener: (
      target: object,
      type: string,
      handler: (event?: KakaoMouseEvent) => void,
    ) => void;
  };
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsNamespace };
  }
}
