import * as THREE from "three";
import { uniform } from "three/tsl";
import { PointsNodeMaterial } from "three/webgpu";

export interface SatelliteSettings {
  enabled: boolean;
  count: number;
  size: number;
  color: number;
  speedScale: number;
}

export interface SatelliteData {
  radii: Float32Array;
  inclinations: Float32Array;
  ascendingNodes: Float32Array;
  angularVelocities: Float32Array;
  phases: Float32Array;
}

export class Satellites {
  public points: THREE.Points | null = null;
  public settings: SatelliteSettings;
  private data: SatelliteData | null = null;
  private sizeUniform: any;
  private colorUniform: any;

  constructor(settings: SatelliteSettings) {
    this.settings = settings;
  }

  public init(parentGroup: THREE.Group) {
    const count = this.settings.count;
    const radii = new Float32Array(count);
    const inclinations = new Float32Array(count);
    const ascendingNodes = new Float32Array(count);
    const angularVelocities = new Float32Array(count);
    const phases = new Float32Array(count);

    let idx = 0;

    // 1. LEO Shells (65%)
    const leoCount = Math.floor(count * 0.65);
    const shells = [
      { r: 10.6, inc: 53 * (Math.PI / 180), planes: 12 },
      { r: 10.9, inc: 70 * (Math.PI / 180), planes: 8 },
      { r: 11.3, inc: 97.6 * (Math.PI / 180), planes: 10 },
      { r: 11.7, inc: 53 * (Math.PI / 180), planes: 8 },
    ];

    let shellIdx = 0;
    while (idx < leoCount && idx < count) {
      const shell = shells[shellIdx % shells.length];
      shellIdx++;

      const satsInShell = Math.floor(leoCount / shells.length);
      const satsPerPlane = Math.floor(satsInShell / shell.planes);

      for (let p = 0; p < shell.planes; p++) {
        const node = (p / shell.planes) * Math.PI * 2 + Math.random() * 0.02;
        for (let s = 0; s < satsPerPlane; s++) {
          if (idx >= count) break;
          radii[idx] = shell.r;
          inclinations[idx] = shell.inc;
          ascendingNodes[idx] = node;
          angularVelocities[idx] = 0.003 * Math.pow(10.6 / shell.r, 1.5);
          phases[idx] = (s / satsPerPlane) * Math.PI * 2 + Math.random() * 0.05;
          idx++;
        }
      }
    }

    // 2. MEO GPS Constellations (15%)
    const meoCount = Math.floor(count * 0.15);
    const meoTarget = idx + meoCount;
    const meoPlanes = 6;
    const meoSatsPerPlane = Math.floor(meoCount / meoPlanes);
    const meoRadius = 16.5;
    const meoInc = 55 * (Math.PI / 180);

    for (let p = 0; p < meoPlanes; p++) {
      const node = (p / meoPlanes) * Math.PI * 2;
      for (let s = 0; s < meoSatsPerPlane; s++) {
        if (idx >= count || idx >= meoTarget) break;
        radii[idx] = meoRadius + (Math.random() * 0.4 - 0.2);
        inclinations[idx] = meoInc + (Math.random() * 0.02 - 0.01);
        ascendingNodes[idx] = node;
        angularVelocities[idx] = 0.003 * Math.pow(10.6 / meoRadius, 1.5);
        phases[idx] = (s / meoSatsPerPlane) * Math.PI * 2;
        idx++;
      }
    }

    // 3. GEO equatorial belt (10%)
    const geoCount = Math.floor(count * 0.1);
    const geoTarget = idx + geoCount;
    const geoRadius = 24.0;
    for (; idx < geoTarget && idx < count; ) {
      radii[idx] = geoRadius + (Math.random() * 0.2 - 0.1);
      inclinations[idx] = 0.0 + (Math.random() * 0.01 - 0.005);
      ascendingNodes[idx] = Math.random() * Math.PI * 2;
      angularVelocities[idx] = 0.003 * Math.pow(10.6 / geoRadius, 1.5);
      phases[idx] = Math.random() * Math.PI * 2;
      idx++;
    }

    // 4. Debris / Random orbits (remaining %)
    while (idx < count) {
      const r = 10.5 + Math.random() * 18.0;
      radii[idx] = r;
      inclinations[idx] = Math.random() * Math.PI;
      ascendingNodes[idx] = Math.random() * Math.PI * 2;
      angularVelocities[idx] = 0.003 * Math.pow(10.6 / r, 1.5);
      phases[idx] = Math.random() * Math.PI * 2;
      idx++;
    }

    this.data = { radii, inclinations, ascendingNodes, angularVelocities, phases };

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = radii[i];
      const theta = phases[i];
      const inc = inclinations[i];
      const node = ascendingNodes[i];

      const x0 = r * Math.cos(theta);
      const z0 = r * Math.sin(theta);

      const x1 = x0 * Math.cos(inc);
      const y1 = x0 * Math.sin(inc);
      const z1 = z0;

      const x2 = x1 * Math.cos(node) + z1 * Math.sin(node);
      const y2 = y1;
      const z2 = -x1 * Math.sin(node) + z1 * Math.cos(node);

      const i3 = i * 3;
      positions[i3] = x2;
      positions[i3 + 1] = y2;
      positions[i3 + 2] = z2;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    this.sizeUniform = uniform(this.settings.size);
    this.colorUniform = uniform(new THREE.Color(this.settings.color));

    const material = new PointsNodeMaterial({
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    material.sizeNode = this.sizeUniform;
    material.colorNode = this.colorUniform;

    this.points = new THREE.Points(geometry, material);
    this.points.visible = this.settings.enabled;
    this.points.userData = {
      sizeUniform: this.sizeUniform,
      colorUniform: this.colorUniform,
    };
    parentGroup.add(this.points);
  }

  public update() {
    if (!this.points || !this.settings.enabled || !this.data) {
      if (this.points) this.points.visible = false;
      return;
    }

    this.points.visible = true;
    const count = this.settings.count;
    const posAttr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const { radii, inclinations, ascendingNodes, angularVelocities, phases } = this.data;
    const speedScale = this.settings.speedScale;

    for (let i = 0; i < count; i++) {
      phases[i] += angularVelocities[i] * speedScale;
      if (phases[i] > Math.PI * 2) phases[i] -= Math.PI * 2;

      const r = radii[i];
      const theta = phases[i];
      const inc = inclinations[i];
      const node = ascendingNodes[i];

      const x0 = r * Math.cos(theta);
      const z0 = r * Math.sin(theta);

      const x1 = x0 * Math.cos(inc);
      const y1 = x0 * Math.sin(inc);
      const z1 = z0;

      const x2 = x1 * Math.cos(node) + z1 * Math.sin(node);
      const y2 = y1;
      const z2 = -x1 * Math.sin(node) + z1 * Math.cos(node);

      const i3 = i * 3;
      positions[i3] = x2;
      positions[i3 + 1] = y2;
      positions[i3 + 2] = z2;
    }

    posAttr.needsUpdate = true;
  }
}
