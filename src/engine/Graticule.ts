import * as THREE from "three";
import { CONSTANTS } from "../constants";

export interface GraticuleSettings {
  enabled: boolean;
  step: number;
  color: number;
  opacity: number;
  elevation: number;
}

export class Graticule {
  public mesh: THREE.LineSegments | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.LineBasicMaterial | null = null;
  private earthGroup: THREE.Group;

  public settings: GraticuleSettings = {
    enabled: CONSTANTS.GUI.GRATICULE.ENABLED,
    step: CONSTANTS.GUI.GRATICULE.STEP,
    color: CONSTANTS.GUI.GRATICULE.COLOR,
    opacity: CONSTANTS.GUI.GRATICULE.OPACITY,
    elevation: CONSTANTS.GUI.GRATICULE.ELEVATION,
  };

  constructor(earthGroup: THREE.Group) {
    this.earthGroup = earthGroup;
    this.createGrid();
  }

  public createGrid() {
    this.disposeMesh();

    const radius = CONSTANTS.EARTH_RADIUS + this.settings.elevation;
    const step = Math.max(1, Math.min(90, Number(this.settings.step) || 15));
    this.settings.step = step;
    const positions: number[] = [];

    // Latitude lines (Parallels)
    for (let lat = -90 + step; lat < 90; lat += step) {
      const segs = 72;
      let prev = this.latLngToVector3(lat, -180, radius);
      for (let i = 1; i <= segs; i++) {
        const lon = -180 + (i * 360) / segs;
        const curr = this.latLngToVector3(lat, lon, radius);
        positions.push(prev.x, prev.y, prev.z, curr.x, curr.y, curr.z);
        prev = curr;
      }
    }

    // Longitude lines (Meridians)
    for (let lon = -180; lon < 180; lon += step) {
      const segs = 36;
      let prev = this.latLngToVector3(-90, lon, radius);
      for (let i = 1; i <= segs; i++) {
        const lat = -90 + (i * 180) / segs;
        const curr = this.latLngToVector3(lat, lon, radius);
        positions.push(prev.x, prev.y, prev.z, curr.x, curr.y, curr.z);
        prev = curr;
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    this.material = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.settings.color),
      transparent: true,
      opacity: this.settings.opacity,
      depthWrite: false,
    });

    this.mesh = new THREE.LineSegments(this.geometry, this.material);
    this.mesh.name = "lat_lon_grid";
    this.mesh.visible = this.settings.enabled;

    this.earthGroup.add(this.mesh);
  }

  private latLngToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(theta) * Math.sin(phi);

    return new THREE.Vector3(x, y, z);
  }

  public setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    if (this.mesh) {
      this.mesh.visible = enabled;
    }
  }

  public setStep(step: number | string) {
    const numStep = Number(step);
    if (isNaN(numStep) || numStep <= 0) return;
    this.settings.step = numStep;
    this.createGrid();
  }

  public setColor(hex: number) {
    this.settings.color = hex;
    if (this.material) {
      this.material.color.setHex(hex);
    }
  }

  public setOpacity(opacity: number) {
    this.settings.opacity = opacity;
    if (this.material) {
      this.material.opacity = opacity;
    }
  }

  private disposeMesh() {
    if (this.mesh && this.earthGroup) {
      this.earthGroup.remove(this.mesh);
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    this.mesh = null;
  }

  public dispose() {
    this.disposeMesh();
  }
}
