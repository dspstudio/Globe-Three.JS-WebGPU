import * as THREE from "three";
import { CONSTANTS } from "../constants";

export class CountryBorders {
  public mesh: THREE.LineSegments | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.LineBasicMaterial | null = null;
  private earthGroup: THREE.Group;
  public settings = {
    enabled: CONSTANTS.GUI.COUNTRY_BORDERS.ENABLED,
    color: CONSTANTS.GUI.COUNTRY_BORDERS.COLOR,
    opacity: CONSTANTS.GUI.COUNTRY_BORDERS.OPACITY,
    elevation: CONSTANTS.GUI.COUNTRY_BORDERS.ELEVATION,
  };
  private isLoaded = false;
  private isLoading = false;

  constructor(earthGroup: THREE.Group) {
    this.earthGroup = earthGroup;
  }

  public async init() {
    if (this.isLoaded || this.isLoading) return;
    this.isLoading = true;

    try {
      let geojson: any = null;

      // First attempt to load local public file
      try {
        const res = await fetch("/countries.json");
        if (res.ok) {
          geojson = await res.json();
        }
      } catch (e) {
        console.warn("Failed to fetch local countries.json, trying fallback CDN...", e);
      }

      // Fallback to CDN if local fetch failed
      if (!geojson) {
        const res = await fetch(
          "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson"
        );
        geojson = await res.json();
      }

      if (!geojson || !geojson.features) {
        throw new Error("Invalid GeoJSON structure");
      }

      const positions: number[] = [];
      const radius = CONSTANTS.EARTH_RADIUS + this.settings.elevation;

      for (const feature of geojson.features) {
        if (!feature.geometry) continue;
        const geom = feature.geometry;
        if (geom.type === "Polygon") {
          for (const ring of geom.coordinates) {
            this.processRing(ring, radius, positions);
          }
        } else if (geom.type === "MultiPolygon") {
          for (const poly of geom.coordinates) {
            for (const ring of poly) {
              this.processRing(ring, radius, positions);
            }
          }
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
      this.mesh.name = "country_borders";
      this.mesh.visible = this.settings.enabled;

      this.earthGroup.add(this.mesh);
      this.isLoaded = true;
    } catch (err) {
      console.error("Failed to load country borders GeoJSON:", err);
    } finally {
      this.isLoading = false;
    }
  }

  public setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    if (enabled && !this.isLoaded && !this.isLoading) {
      this.init().then(() => {
        if (this.mesh) this.mesh.visible = true;
      });
    } else if (this.mesh) {
      this.mesh.visible = enabled;
    }
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

  private processRing(ring: number[][], radius: number, positions: number[]) {
    for (let i = 0; i < ring.length - 1; i++) {
      const pt1 = ring[i];
      const pt2 = ring[i + 1];
      if (!pt1 || !pt2) continue;
      const v1 = this.latLngToVector3(pt1[1], pt1[0], radius);
      const v2 = this.latLngToVector3(pt2[1], pt2[0], radius);
      this.addSubdividedSegment(v1, v2, radius, positions);
    }
  }

  private latLngToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(theta) * Math.sin(phi);

    return new THREE.Vector3(x, y, z);
  }

  private addSubdividedSegment(v1: THREE.Vector3, v2: THREE.Vector3, radius: number, positions: number[]) {
    const angle = v1.angleTo(v2);
    const maxAngle = 0.05; // Subdivide long lines to conform smoothly to sphere
    if (angle > maxAngle) {
      const steps = Math.ceil(angle / maxAngle);
      let prev = v1.clone();
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const next = v1.clone().lerp(v2, t).normalize().multiplyScalar(radius);
        positions.push(prev.x, prev.y, prev.z, next.x, next.y, next.z);
        prev = next;
      }
    } else {
      positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }
  }

  public dispose() {
    if (this.mesh && this.earthGroup) {
      this.earthGroup.remove(this.mesh);
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
  }
}
