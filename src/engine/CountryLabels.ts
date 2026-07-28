import * as THREE from "three";
import { CONSTANTS } from "../constants";
import { ProjectedCountryLabel, CountryLabelsSettings } from "../types";

export interface RawCountryData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tier: 1 | 2 | 3;
  pop: number;
  vector: THREE.Vector3;
}

export class CountryLabels {
  private earthGroup: THREE.Group;
  public settings: CountryLabelsSettings = {
    enabled: CONSTANTS.GUI.COUNTRY_LABELS.ENABLED,
    maxVisible: CONSTANTS.GUI.COUNTRY_LABELS.MAX_VISIBLE,
    fadeDistanceFar: CONSTANTS.GUI.COUNTRY_LABELS.FADE_DISTANCE_FAR,
    fadeDistanceMid: CONSTANTS.GUI.COUNTRY_LABELS.FADE_DISTANCE_MID,
    fadeDistanceClose: CONSTANTS.GUI.COUNTRY_LABELS.FADE_DISTANCE_CLOSE,
  };

  private countriesData: RawCountryData[] = [];
  public isLoaded = false;
  private isLoading = false;

  private tempV = new THREE.Vector3();
  private dirToCamera = new THREE.Vector3();
  private dirToAnchor = new THREE.Vector3();
  private earthCenter = new THREE.Vector3(0, 0, 0);

  constructor(earthGroup: THREE.Group) {
    this.earthGroup = earthGroup;
  }

  public async init() {
    if (this.isLoaded || this.isLoading) return;
    this.isLoading = true;

    try {
      let geojson: any = null;

      try {
        const res = await fetch("/countries.json");
        if (res.ok) {
          geojson = await res.json();
        }
      } catch (e) {
        console.warn("Failed local countries.json fetch for labels, trying fallback CDN...", e);
      }

      if (!geojson) {
        const res = await fetch(
          "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson"
        );
        geojson = await res.json();
      }

      if (!geojson || !geojson.features) {
        throw new Error("Invalid GeoJSON for country labels");
      }

      const parsed: RawCountryData[] = [];
      const radius = CONSTANTS.EARTH_RADIUS + 0.08;

      for (const feature of geojson.features) {
        if (!feature.properties) continue;
        const props = feature.properties;
        const name = props.NAME || props.NAME_LONG || props.ADMIN;
        if (!name) continue;

        let lat = props.LABEL_Y;
        let lng = props.LABEL_X;

        // Fallback to bounding box center if label coords not defined
        if (typeof lat !== "number" || typeof lng !== "number") {
          if (props.bbox && Array.isArray(props.bbox) && props.bbox.length >= 4) {
            lng = (props.bbox[0] + props.bbox[2]) / 2;
            lat = (props.bbox[1] + props.bbox[3]) / 2;
          } else {
            continue;
          }
        }

        const pop = props.POP_EST || 0;
        const labelRank = props.LABELRANK || 5;

        let bboxArea = 0;
        if (props.bbox && Array.isArray(props.bbox) && props.bbox.length >= 4) {
          bboxArea = Math.abs((props.bbox[2] - props.bbox[0]) * (props.bbox[3] - props.bbox[1]));
        }

        // Major big country names
        const majorBigList = new Set([
          "United States of America", "United States", "China", "Russia", "Brazil",
          "Canada", "Australia", "India", "Argentina", "Kazakhstan", "Algeria", "Mexico",
          "Sudan", "Saudi Arabia", "Greenland", "Indonesia", "Iran", "Mongolia", "Peru",
          "Chad", "Niger", "Angola", "Mali", "South Africa", "Colombia", "Ethiopia"
        ]);

        let tier: 1 | 2 | 3 = 3;
        if (majorBigList.has(name) || bboxArea > 90 || pop > 50000000 || labelRank <= 2) {
          tier = 1; // Big
        } else if (bboxArea > 16 || pop > 10000000 || labelRank <= 4) {
          tier = 2; // Medium
        } else {
          tier = 3; // Small
        }

        const vector = this.latLngToVector3(lat, lng, radius);

        const isoId = (props.ISO_A3 || props.ADM0_A3 || props.ISO_A2 || name)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");

        parsed.push({
          id: `cntry-${isoId}`,
          name,
          lat,
          lng,
          tier,
          pop,
          vector,
        });
      }

      this.countriesData = parsed;
      this.isLoaded = true;
    } catch (err) {
      console.error("Failed to load country labels:", err);
    } finally {
      this.isLoading = false;
    }
  }

  public getProjectedLabels(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ): ProjectedCountryLabel[] {
    if (!this.settings.enabled || !this.isLoaded || this.countriesData.length === 0) {
      return [];
    }

    const camDist = camera.position.length();

    // Zoom Tier Reveal logic:
    // Distance 50 (far zoomed out) -> hide or show very subtle tier 1
    // As camera moves closer (camDist decreases):
    // camDist > fadeDistanceFar (36): Reveal Tier 1 (Big)
    // camDist <= fadeDistanceFar && camDist > fadeDistanceMid (27): Reveal Tier 1 & Tier 2 (Medium)
    // camDist <= fadeDistanceMid: Reveal Tier 1, Tier 2, Tier 3 (Small)
    let maxVisibleTier: 1 | 2 | 3 = 1;
    let tier1OpacityFactor = 0;
    let tier2OpacityFactor = 0;
    let tier3OpacityFactor = 0;

    // Smooth fade factor based on camera distance
    if (camDist > 45) {
      tier1OpacityFactor = 0.0;
    } else if (camDist > this.settings.fadeDistanceFar) {
      // Zooming in from 45 to 36 reveals Tier 1
      tier1OpacityFactor = (45 - camDist) / (45 - this.settings.fadeDistanceFar);
      maxVisibleTier = 1;
    } else if (camDist > this.settings.fadeDistanceMid) {
      // Tier 1 fully visible (1.0), Zooming in from 36 to 27 reveals Tier 2
      tier1OpacityFactor = 1.0;
      tier2OpacityFactor = (this.settings.fadeDistanceFar - camDist) / (this.settings.fadeDistanceFar - this.settings.fadeDistanceMid);
      maxVisibleTier = 2;
    } else {
      // Tier 1 and 2 fully visible, Zooming in from 27 to 19 reveals Tier 3
      tier1OpacityFactor = 1.0;
      tier2OpacityFactor = 1.0;
      tier3OpacityFactor = (this.settings.fadeDistanceMid - camDist) / (this.settings.fadeDistanceMid - this.settings.fadeDistanceClose);
      tier3OpacityFactor = Math.min(1.0, Math.max(0.0, tier3OpacityFactor));
      maxVisibleTier = 3;
    }

    tier1OpacityFactor = Math.min(1.0, Math.max(0.0, tier1OpacityFactor));
    tier2OpacityFactor = Math.min(1.0, Math.max(0.0, tier2OpacityFactor));

    if (tier1OpacityFactor <= 0.01) {
      return [];
    }

    this.dirToCamera.copy(camera.position).sub(this.earthCenter).normalize();

    const candidates: {
      data: RawCountryData;
      x: number;
      y: number;
      opacity: number;
      distToCam: number;
      centerDist: number;
    }[] = [];

    const halfW = width * 0.5;
    const halfH = height * 0.5;

    for (let i = 0; i < this.countriesData.length; i++) {
      const country = this.countriesData[i];

      // Tier filter
      if (country.tier > maxVisibleTier) continue;

      let tierFactor = 1.0;
      if (country.tier === 1) tierFactor = tier1OpacityFactor;
      else if (country.tier === 2) tierFactor = tier2OpacityFactor;
      else if (country.tier === 3) tierFactor = tier3OpacityFactor;

      if (tierFactor <= 0.02) continue;

      // Transform world position
      this.tempV.copy(country.vector).applyMatrix4(this.earthGroup.matrixWorld);

      // Horizon culling
      this.dirToAnchor.copy(this.tempV).sub(this.earthCenter).normalize();
      const dot = this.dirToAnchor.dot(this.dirToCamera);

      if (dot <= -0.05) continue; // Behind sphere horizon

      const horizonFade = Math.min(1.0, Math.max(0.0, dot / 0.18));
      const opacity = horizonFade * tierFactor;

      if (opacity <= 0.02) continue;

      const distToCam = camera.position.distanceTo(this.tempV);

      // Project to NDC
      this.tempV.project(camera);

      // Screen bounds culling (with padding)
      if (
        this.tempV.x < -1.25 ||
        this.tempV.x > 1.25 ||
        this.tempV.y < -1.25 ||
        this.tempV.y > 1.25
      ) {
        continue;
      }

      const x = (this.tempV.x * 0.5 + 0.5) * width;
      const y = (this.tempV.y * -0.5 + 0.5) * height;

      // Distance to screen center (used for density sorting)
      const dx = x - halfW;
      const dy = y - halfH;
      const centerDist = dx * dx + dy * dy;

      candidates.push({
        data: country,
        x,
        y,
        opacity,
        distToCam,
        centerDist,
      });
    }

    // Sort by priority (tier 1 first, then higher population / closer to view center)
    candidates.sort((a, b) => {
      if (a.data.tier !== b.data.tier) {
        return a.data.tier - b.data.tier;
      }
      return a.centerDist - b.centerDist;
    });

    const maxCount = Math.min(candidates.length, this.settings.maxVisible);
    const result: ProjectedCountryLabel[] = [];

    for (let i = 0; i < maxCount; i++) {
      const c = candidates[i];
      result.push({
        id: c.data.id,
        name: c.data.name,
        tier: c.data.tier,
        x: c.x,
        y: c.y,
        visible: true,
        opacity: c.opacity,
        distanceToCamera: c.distToCam,
      });
    }

    return result;
  }

  private latLngToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(theta) * Math.sin(phi);

    return new THREE.Vector3(x, y, z);
  }

  public dispose() {
    this.countriesData = [];
    this.isLoaded = false;
  }
}
