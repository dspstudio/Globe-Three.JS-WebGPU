export interface LocationInfo {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface ProjectedLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  x: number; // Screen pixel X
  y: number; // Screen pixel Y
  visible: boolean; // Front-facing check
  opacity: number; // Faded at the horizon edge
  distanceToCamera: number;
}

export interface ProjectedCountryLabel {
  id: string;
  name: string;
  tier: 1 | 2 | 3; // 1 = Big, 2 = Medium, 3 = Small
  x: number;
  y: number;
  visible: boolean;
  opacity: number;
  distanceToCamera: number;
}

export interface CountryLabelsSettings {
  enabled: boolean;
  maxVisible: number;
  fadeDistanceFar: number;
  fadeDistanceMid: number;
  fadeDistanceClose: number;
}
