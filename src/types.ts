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
