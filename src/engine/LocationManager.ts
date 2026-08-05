import * as THREE from "three";
import { CONSTANTS, CINEMATIC_LOCATIONS } from "../constants";
import { ProjectedLocation } from "../types";

export class LocationManager {
  public anchors: Map<string, THREE.Object3D> = new Map();
  public onLocationsUpdate: ((locations: ProjectedLocation[]) => void) | null = null;
  public focusTargetAnchorId: string | null = null;

  private tempVec3 = new THREE.Vector3();
  private tempDirToAnchor = new THREE.Vector3();
  private tempTargetPos = new THREE.Vector3();
  private tempEarthCenter = new THREE.Vector3(0, 0, 0);
  private tempDirToCamera = new THREE.Vector3();

  public init(earthGroup: THREE.Group) {
    const radius = CONSTANTS.EARTH_RADIUS + 0.1;

    for (const loc of CINEMATIC_LOCATIONS) {
      const phi = (90 - loc.lat) * (Math.PI / 180);
      const theta = (loc.lng + 180) * (Math.PI / 180);

      const x = -radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(theta) * Math.sin(phi);

      const anchor = new THREE.Object3D();
      anchor.position.set(x, y, z);
      earthGroup.add(anchor);
      this.anchors.set(loc.id, anchor);
    }
  }

  public updateFocus(camera: THREE.PerspectiveCamera) {
    if (!this.focusTargetAnchorId) return;

    const anchor = this.anchors.get(this.focusTargetAnchorId);
    if (!anchor) return;

    anchor.getWorldPosition(this.tempVec3);
    this.tempDirToAnchor.copy(this.tempVec3).normalize();

    const currentDistance = camera.position.length();
    const targetDistance = Math.max(
      CONSTANTS.EARTH_RADIUS * 1.5,
      Math.min(currentDistance, CONSTANTS.EARTH_RADIUS * 2.5)
    );

    this.tempTargetPos.copy(this.tempDirToAnchor).multiplyScalar(targetDistance);
    camera.position.lerp(this.tempTargetPos, 0.08);

    if (camera.position.distanceTo(this.tempTargetPos) < 0.05) {
      camera.position.copy(this.tempTargetPos);
      this.focusTargetAnchorId = null;
    }
  }

  public updateProjectedLocations(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    citiesEnabled: boolean
  ) {
    if (!this.onLocationsUpdate || this.anchors.size === 0) return;

    if (!citiesEnabled) {
      this.onLocationsUpdate([]);
      return;
    }

    const projected: ProjectedLocation[] = [];
    const parent = canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;

    this.tempDirToCamera.copy(camera.position).sub(this.tempEarthCenter).normalize();

    for (const [id, anchor] of this.anchors.entries()) {
      anchor.getWorldPosition(this.tempVec3);

      const distanceToCamera = camera.position.distanceTo(this.tempVec3);

      this.tempDirToAnchor.copy(this.tempVec3).sub(this.tempEarthCenter).normalize();
      const dot = this.tempDirToAnchor.dot(this.tempDirToCamera);

      const visible = dot > -0.05;
      let opacity = 0.0;
      if (dot > 0.0) {
        opacity = Math.min(1.0, dot / 0.2);
      }

      this.tempVec3.project(camera);

      const x = (this.tempVec3.x * 0.5 + 0.5) * width;
      const y = (this.tempVec3.y * -0.5 + 0.5) * height;

      const info = CINEMATIC_LOCATIONS.find((l) => l.id === id);
      if (info) {
        projected.push({
          id,
          name: info.name,
          lat: info.lat,
          lng: info.lng,
          x,
          y,
          visible,
          opacity,
          distanceToCamera,
        });
      }
    }

    this.onLocationsUpdate(projected);
  }
}
