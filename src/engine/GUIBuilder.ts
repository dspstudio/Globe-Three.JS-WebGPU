import GUI from "lil-gui";
import * as THREE from "three";
import { CONSTANTS } from "../constants";
import { CountryBorders } from "./CountryBorders";
import { CountryLabels } from "./CountryLabels";
import { Graticule } from "./Graticule";

export interface GuiOptions {
  tmSettings?: {
    mode: number;
    exposure: number;
    hdrPeakHighlights: boolean;
  };
  tmExposureUniform?: any;
  rebuildPipeline?: () => void;
  cgSettings: {
    contrast: number;
    saturation: number;
    blackLevel: number;
    blueGreenBoost: number;
  };
  cgUniforms: {
    contrast: any;
    saturation: any;
    blackLevel: any;
    blueGreenBoost: any;
  };
  caSettings: { enabled: boolean; strength: number; scale: number };
  caUniforms: { strength: any; scale: any };
  filmSettings: { enabled: boolean; intensity: number };
  filmUniforms: { intensity: any };
  vignetteSettings: { enabled: boolean; darkness: number; offset: number };
  vignetteUniforms: { darkness: any; offset: any };
  moonSettings: {
    enabled: boolean;
    speed: number;
    distance: number;
    inclination: number;
    displacementScale: number;
    illumination: number;
    angle: number;
  };
  moonMesh: THREE.Object3D;
  flareSettings: {
    enabled: boolean;
    intensity: number;
    enterDistance: number;
    leaveDistance: number;
    fadeDuration: number;
  };
  anamorphicSettings: {
    enabled: boolean;
    intensity: number;
    thickness: number;
    size: number;
    color: number;
    innerFade: number;
    outerFade: number;
  };
  bloomPass: any;
  bloomSettings: {
    enabled: boolean;
    strength: number;
    radius: number;
    threshold: number;
  };
  earth: THREE.Group;
  controls: any;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  directionalLight: THREE.DirectionalLight;
  sunMaterial: THREE.MeshBasicMaterial;
  sunUserData?: {
    useTexture?: any;
    textureBlend?: any;
    noiseStrength?: any;
    glowIntensity?: any;
    emissiveBoost?: any;
    sunColor?: any;
  };
  sunSettings: {
    autoRotate: boolean;
    speed: number;
    inclination: number;
    angle: number;
    intensity: number;
  };
  debugSettings: { stats: boolean };
  statsDom: HTMLElement;
  earthSettings: { trueInclination: boolean; rotationSpeed: number };
  renderSettings: { resolutionScale: number };
  onResize: () => void;
  renderer?: any;
  canvas?: HTMLCanvasElement;
  renderPipeline?: any;
  satelliteSettings?: {
    enabled: boolean;
    count: number;
    size: number;
    color: number;
    speedScale: number;
  };
  satellitePoints?: THREE.Points | null;
  backgroundStarsSettings?: {
    enabled: boolean;
    count: number;
    radius: number;
    seed: number;
    coolColor: string;
    warmColor: string;
  };
  backgroundStars?: any;
  citiesSettings?: {
    enabled: boolean;
  };
  countryBorders?: CountryBorders | null;
  countryLabels?: CountryLabels | null;
  graticule?: Graticule | null;
}

export function buildGui(gui: GUI, options: GuiOptions) {
  const {
    cgSettings,
    cgUniforms,
    caSettings,
    caUniforms,
    filmSettings,
    filmUniforms,
    vignetteSettings,
    vignetteUniforms,
    moonSettings,
    moonMesh,
    flareSettings,
    anamorphicSettings,
    bloomPass,
    bloomSettings,
    earth,
    controls,
    camera,
    scene,
    directionalLight,
    sunMaterial,
    sunSettings,
    debugSettings,
    statsDom,
    earthSettings,
    satelliteSettings,
    satellitePoints,
    canvas,
    renderer,
    renderPipeline,
    backgroundStarsSettings,
    backgroundStars,
    citiesSettings,
  } = options;


  // ==========================================
  // GROUP 1: EARTH & SURFACE
  // ==========================================
  const earthGroup = gui.addFolder("Earth & Surface");

  earthGroup.add(earthSettings, "trueInclination").name("True Inclination");
  earthGroup
    .add(earthSettings, "rotationSpeed", 0.0, 0.01)
    .name("Rotation Speed")
    .step(0.0001);

  const terrainFolder = earthGroup.addFolder("Terrain Settings");
  const terrainSettings = {
    bumpScale: CONSTANTS.GUI.EARTH.BUMP_SCALE,
  };
  terrainFolder
    .add(terrainSettings, "bumpScale", 0.0, 10.0)
    .name("Bump Map Scale")
    .onChange((v: number) => {
      earth.userData.bumpScale.value.set(v, v);
    });
  if (earth.userData.displacementScale) {
    terrainFolder
      .add(earth.userData.displacementScale, "value", 0.0, 0.2)
      .step(0.005)
      .name("Displacement Scale");
  }
  if (earth.userData.landRoughness) {
    terrainFolder
      .add(earth.userData.landRoughness, "value", 0.0, 1.0)
      .step(0.01)
      .name("Land Roughness");
  }
  if (earth.userData.ndviEnhance) {
    terrainFolder
      .add(earth.userData.ndviEnhance, "value", 0.0, 1.0)
      .step(0.02)
      .name("Vegetation Boost (NDVI)");
  }
  terrainFolder
    .add(earth.userData.terrainShadowIntensity, "value", 0.0, 5.0)
    .name("Self-Shadow Intensity");
  terrainFolder
    .add(earth.userData.terrainShadowOffset, "value", 0.0001, 0.01)
    .name("Self-Shadow Offset");

  const oceanFolder = earthGroup.addFolder("Ocean Settings");

  // Subfolder 1: Surface & Optics
  const opticsFolder = oceanFolder.addFolder("Surface & Optics");
  opticsFolder
    .add(earth.userData.waterRoughness, "value", 0.0, 1.0)
    .name("Water Roughness");
  opticsFolder
    .add(earth.userData.waterMetalness, "value", 0.0, 1.0)
    .name("Water Metalness");
  if (earth.userData.waterIor) {
    opticsFolder
      .add(earth.userData.waterIor, "value", 1.0, 2.0)
      .step(0.01)
      .name("Index of Refraction (IOR)");
  }
  const oceanColors = {
    shallow: earth.userData.oceanShallowColor ? earth.userData.oceanShallowColor.value.getHex() : CONSTANTS.GUI.OCEAN.SHALLOW_COLOR,
    deep: earth.userData.oceanDeepColor ? earth.userData.oceanDeepColor.value.getHex() : CONSTANTS.GUI.OCEAN.DEEP_COLOR,
    fresnel: earth.userData.fresnelColor ? earth.userData.fresnelColor.value.getHex() : CONSTANTS.GUI.OCEAN.FRESNEL_COLOR,
    sss: earth.userData.sssColor ? earth.userData.sssColor.value.getHex() : CONSTANTS.GUI.OCEAN.SSS_COLOR,
  };

  if (earth.userData.fresnelStrength) {
    opticsFolder
      .add(earth.userData.fresnelStrength, "value", 0.0, 3.0)
      .step(0.05)
      .name("Fresnel Strength");
  }
  if (earth.userData.fresnelExponent) {
    opticsFolder
      .add(earth.userData.fresnelExponent, "value", 1.0, 10.0)
      .step(0.2)
      .name("Fresnel Falloff Exponent");
  }
  if (earth.userData.fresnelColor) {
    opticsFolder
      .addColor(oceanColors, "fresnel")
      .name("Fresnel Glint Color")
      .onChange((c: any) => {
        earth.userData.fresnelColor.value.set(c);
      });
  }

  // Subfolder 2: Color & Bathymetry
  const colorFolder = oceanFolder.addFolder("Color & Bathymetry");

  if (earth.userData.oceanShallowColor) {
    colorFolder
      .addColor(oceanColors, "shallow")
      .name("Shallow Water Color")
      .onChange((c: any) => {
        earth.userData.oceanShallowColor.value.set(c);
      });
  }
  if (earth.userData.oceanDeepColor) {
    colorFolder
      .addColor(oceanColors, "deep")
      .name("Deep Water Color")
      .onChange((c: any) => {
        earth.userData.oceanDeepColor.value.set(c);
      });
  }
  if (earth.userData.waterClarity) {
    colorFolder
      .add(earth.userData.waterClarity, "value", 0.0, 1.0)
      .step(0.01)
      .name("Water Clarity");
  }
  if (earth.userData.bathymetryIntensity) {
    colorFolder
      .add(earth.userData.bathymetryIntensity, "value", 0.0, 2.0)
      .step(0.01)
      .name("Bathymetry Detail");
  }

  // Subfolder 3: Subsurface Scattering (SSS)
  const sssFolder = oceanFolder.addFolder("Subsurface Scattering");
  if (earth.userData.sssColor) {
    sssFolder
      .addColor(oceanColors, "sss")
      .name("SSS Color")
      .onChange((c: any) => {
        earth.userData.sssColor.value.set(c);
      });
  }
  if (earth.userData.sssIntensity) {
    sssFolder
      .add(earth.userData.sssIntensity, "value", 0.0, 2.0)
      .step(0.05)
      .name("SSS Intensity");
  }

  // Subfolder 4: Procedural Waves
  const wavesFolder = oceanFolder.addFolder("Procedural Waves");
  if (earth.userData.wavesEnabled) {
    const waveState = { enabled: earth.userData.wavesEnabled.value > 0.5 };
    wavesFolder
      .add(waveState, "enabled")
      .name("Show Waves")
      .onChange((v: boolean) => {
        earth.userData.wavesEnabled.value = v ? 1.0 : 0.0;
      });
  }
  if (earth.userData.waveHeight) {
    wavesFolder
      .add(earth.userData.waveHeight, "value", 0.0, 0.3)
      .step(0.005)
      .name("Wave Height");
  }
  if (earth.userData.waveScale) {
    wavesFolder
      .add(earth.userData.waveScale, "value", 1.0, 50.0)
      .step(0.5)
      .name("Wave Scale");
  }
  if (earth.userData.waveSpeed) {
    wavesFolder
      .add(earth.userData.waveSpeed, "value", 0.0, 5.0)
      .step(0.05)
      .name("Wave Speed");
  }
  if (earth.userData.waveSparkle) {
    wavesFolder
      .add(earth.userData.waveSparkle, "value", 0.0, 2.0)
      .step(0.05)
      .name("Wave Sparkle");
  }

  // Subfolder 5: Foam & Shoreline
  const foamFolder = oceanFolder.addFolder("Foam & Shoreline");
  if (earth.userData.foamThreshold) {
    foamFolder
      .add(earth.userData.foamThreshold, "value", 0.0, 1.0)
      .step(0.01)
      .name("Foam Threshold");
  }
  if (earth.userData.foamIntensity) {
    foamFolder
      .add(earth.userData.foamIntensity, "value", 0.0, 1.0)
      .step(0.01)
      .name("Foam Intensity");
  }
  if (earth.userData.coastalFadeDistance) {
    foamFolder
      .add(earth.userData.coastalFadeDistance, "value", 0.001, 0.5)
      .step(0.005)
      .name("Coastal Fade Distance");
  }

  const atmosFolder = earthGroup.addFolder("Atmosphere");
  const atmosConfig = {
    mode: CONSTANTS.GUI.ATMOSPHERE.MODE,
  };
  atmosFolder
    .add(atmosConfig, "mode", ["Scattering", "Airglow"])
    .name("Mode")
    .onChange((m: string) => {
      earth.userData.atmosMode.value = m === "Scattering" ? 0.0 : 1.0;
    });

  const atmosColors = {
    rayleigh: earth.userData.rayleighColor.value.getHex(),
    mie: earth.userData.mieColor.value.getHex(),
    twilight: earth.userData.twilightColor.value.getHex(),
    airglow: earth.userData.airglowColor.value.getHex(),
  };
  atmosFolder
    .addColor(atmosColors, "rayleigh")
    .name("Rayleigh Color")
    .onChange((c: number) => {
      earth.userData.rayleighColor.value.setHex(c);
    });
  atmosFolder
    .addColor(atmosColors, "mie")
    .name("Mie Color")
    .onChange((c: number) => {
      earth.userData.mieColor.value.setHex(c);
    });
  atmosFolder
    .addColor(atmosColors, "twilight")
    .name("Twilight Color")
    .onChange((c: number) => {
      earth.userData.twilightColor.value.setHex(c);
    });
  atmosFolder
    .addColor(atmosColors, "airglow")
    .name("Airglow Color")
    .onChange((c: number) => {
      earth.userData.airglowColor.value.setHex(c);
    });
  atmosFolder
    .add(earth.userData.atmosDensity, "value", 0.1, 100.0)
    .name("Density");
  atmosFolder
    .add(earth.userData.rayleighIntensity, "value", 0.0, 5.0)
    .step(0.1)
    .name("Rayleigh Intensity");
  atmosFolder
    .add(earth.userData.darkSideBrightness, "value", 0.0, 0.5)
    .step(0.001)
    .name("Overall Dark Side");
  atmosFolder
    .add(earth.userData.cityLights, "value", 0.0, 20.0)
    .step(0.1)
    .name("City Lights");

  const shadowFolder = earthGroup.addFolder("Cloud Shadows");
  const shadowSettings = {
    color: earth.userData.shadowColor.value.getHex(),
  };
  shadowFolder.add(earth.userData.shadowDist, "value", 0.01, 0.5, 0.005).name("Altitude Offset");
  shadowFolder
    .add(earth.userData.shadowIntensity, "value", 0, 1)
    .name("Intensity");
  shadowFolder
    .addColor(shadowSettings, "color")
    .name("Color")
    .onChange((c: number) => {
      earth.userData.shadowColor.value.setHex(c);
    });

  if (earth.userData.cutawayProgress) {
    const cutawayFolder = earthGroup.addFolder("Cross-Section (Inner Core)");
    const cutawayConfig = {
      progress: earth.userData.cutawayProgress.value,
      showHud: false,
      toggleCutaway: () => {
        const current = earth.userData.cutawayProgress.value;
        const target = current > 0.5 ? 0.0 : 1.0;
        earth.userData.cutawayProgress.value = target;
        if (earth.userData.innerLayers) {
          const inner = earth.userData.innerLayers;
          if (inner.userData.updateSubLayerVisibilities) {
            inner.userData.updateSubLayerVisibilities(target);
          } else {
            inner.visible = target > 0.0001;
          }
        }
        cutawayConfig.progress = target;
        window.dispatchEvent(new CustomEvent('cutaway-changed', { detail: { value: target } }));
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
      }
    };

    cutawayFolder
      .add(cutawayConfig, "showHud")
      .name("Show Layer HUD")
      .onChange((visible: boolean) => {
        window.dispatchEvent(new CustomEvent("toggle-layer-hud", { detail: { visible } }));
      });

    cutawayFolder
      .add(cutawayConfig, "progress", 0.0, 1.0, 0.01)
      .name("Cutaway Depth")
      .onChange((v: number) => {
        earth.userData.cutawayProgress.value = v;
        if (earth.userData.innerLayers) {
          const inner = earth.userData.innerLayers;
          if (inner.userData.updateSubLayerVisibilities) {
            inner.userData.updateSubLayerVisibilities(v);
          } else {
            inner.visible = v > 0.0001;
          }
        }
      });
    cutawayFolder
      .add(cutawayConfig, "toggleCutaway")
      .name("Toggle Cutaway");

    window.addEventListener("layer-hud-changed", (e: any) => {
      if (e && e.detail && typeof e.detail.visible === "boolean") {
        cutawayConfig.showHud = e.detail.visible;
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
      }
    });
  }

  // ==========================================
  // GROUP 2: MAP & DATA OVERLAYS
  // ==========================================
  const mapGroup = gui.addFolder("Map & Data Overlays");

  if (citiesSettings) {
    mapGroup.add(citiesSettings, "enabled").name("Show Cities");
  }

  if (options.countryBorders) {
    const borders = options.countryBorders;
    const bordersFolder = mapGroup.addFolder("Country Borders");
    bordersFolder
      .add(borders.settings, "enabled")
      .name("Show Wireframe")
      .onChange((v: boolean) => {
        borders.setEnabled(v);
      });
    bordersFolder
      .addColor(borders.settings, "color")
      .name("Line Color")
      .onChange((c: number) => {
        borders.setColor(c);
      });
    bordersFolder
      .add(borders.settings, "opacity", 0.01, 1.0, 0.01)
      .name("Opacity")
      .onChange((v: number) => {
        borders.setOpacity(v);
      });
  }

  if (options.countryLabels) {
    const labels = options.countryLabels;
    const labelsFolder = mapGroup.addFolder("Country Labels");
    labelsFolder.add(labels.settings, "enabled").name("Show Names");
    labelsFolder.add(labels.settings, "maxVisible", 10, 100, 1).name("Max On Screen");
    labelsFolder.add(labels.settings, "fadeDistanceFar", 25, 50, 1).name("Far Reveal Zoom");
    labelsFolder.add(labels.settings, "fadeDistanceMid", 18, 35, 1).name("Mid Reveal Zoom");
    labelsFolder.add(labels.settings, "fadeDistanceClose", 12, 25, 1).name("Close Reveal Zoom");
  }

  if (options.graticule) {
    const graticule = options.graticule;
    const gridFolder = mapGroup.addFolder("Lat / Lon Grid");
    gridFolder
      .add(graticule.settings, "enabled")
      .name("Show Grid")
      .onChange((v: boolean) => {
        graticule.setEnabled(v);
      });
    gridFolder
      .add(graticule.settings, "step", { "5°": 5, "10°": 10, "15°": 15, "30°": 30, "45°": 45 })
      .name("Interval")
      .onChange((v: any) => {
        graticule.setStep(Number(v));
      });
    gridFolder
      .addColor(graticule.settings, "color")
      .name("Line Color")
      .onChange((c: number) => {
        graticule.setColor(c);
      });
    gridFolder
      .add(graticule.settings, "opacity", 0.01, 1.0, 0.01)
      .name("Opacity")
      .onChange((v: number) => {
        graticule.setOpacity(v);
      });
  }

  if (earth.userData.gibsEnabled && earth.userData.gibsOpacity) {
    const gibsFolder = mapGroup.addFolder("GIBS Data Overlays");
    const gibsState = {
      enabled: earth.userData.gibsEnabled.value > 0.5,
      layer: earth.userData.gibsLayer.value > 0.5 ? "MODIS Terra NDVI 8-Day" : "Sea Surface Temp Anomalies"
    };
    
    gibsFolder
      .add(gibsState, "layer", ["Sea Surface Temp Anomalies", "MODIS Terra NDVI 8-Day"])
      .name("Layer")
      .onChange((v: string) => {
        earth.userData.gibsLayer.value = v === "MODIS Terra NDVI 8-Day" ? 1.0 : 0.0;
      });

    gibsFolder
      .add(gibsState, "enabled")
      .name("Show Overlay")
      .onChange((v: boolean) => {
        earth.userData.gibsEnabled.value = v ? 1.0 : 0.0;
      });

    gibsFolder
      .add(earth.userData.gibsOpacity, "value", 0.0, 1.0)
      .step(0.05)
      .name("Opacity");
  }

  if (satelliteSettings) {
    const satGroup = mapGroup.addFolder("Satellites");
    
    satGroup.add(satelliteSettings, "enabled").name("Show Satellites").onChange((val: boolean) => {
      if (satellitePoints) {
        satellitePoints.visible = val;
      }
    });

    const satColorObj = { color: satelliteSettings.color };
    satGroup.addColor(satColorObj, "color").name("Color").onChange((val: number) => {
      if (satellitePoints && satellitePoints.userData.colorUniform) {
        satellitePoints.userData.colorUniform.value.setHex(val);
      }
    });

    satGroup.add(satelliteSettings, "speedScale", 0.0, 5.0).step(0.1).name("Orbit Speed");
  }

  // ==========================================
  // GROUP 3: ENVIRONMENT & SPACE
  // ==========================================
  const envGroup = gui.addFolder("Environment & Space");

  const sunFolder = envGroup.addFolder("Sun & Lighting");
  const sunVisualSettings = {
    color: directionalLight.color.getHex(),
  };
  sunFolder
    .add(sunSettings, "intensity", 0.0, 10.0)
    .name("Light Intensity")
    .onChange((v: number) => {
      directionalLight.intensity = v;
    });
  sunFolder
    .addColor(sunVisualSettings, "color")
    .name("Color")
    .onChange((c: number) => {
      directionalLight.color.setHex(c);
      if (options.sunUserData && options.sunUserData.sunColor) {
        options.sunUserData.sunColor.value.setHex(c);
      } else if (sunMaterial && sunMaterial.color) {
        sunMaterial.color.setHex(c);
        sunMaterial.color.multiplyScalar(2.0);
      }
    });

  if (options.sunUserData) {
    const su = options.sunUserData;
    if (su.useTexture) {
      const texState = { enabled: su.useTexture.value > 0.5 };
      sunFolder
        .add(texState, "enabled")
        .name("Enable Texture")
        .onChange((v: boolean) => {
          su.useTexture.value = v ? 1.0 : 0.0;
        });
    }
    if (su.textureBlend) {
      sunFolder
        .add(su.textureBlend, "value", 0.0, 1.0)
        .step(0.01)
        .name("Texture Blend");
    }
    if (su.noiseStrength) {
      sunFolder
        .add(su.noiseStrength, "value", 0.0, 1.0)
        .step(0.01)
        .name("Granulation Noise");
    }
    if (su.glowIntensity) {
      sunFolder
        .add(su.glowIntensity, "value", 0.0, 5.0)
        .step(0.1)
        .name("Coronal Glow");
    }
    if (su.emissiveBoost) {
      sunFolder
        .add(su.emissiveBoost, "value", 0.1, 10.0)
        .step(0.1)
        .name("Emissive Brightness");
    }
  }

  sunFolder.add(sunSettings, "autoRotate").name("Auto Rotate");
  sunFolder.add(sunSettings, "speed", 0.0, 5.0).name("Speed");
  sunFolder.add(sunSettings, "inclination", -1.0, 1.0).name("Inclination");
  sunFolder
    .add(sunSettings, "angle", 0.0, Math.PI * 2.0)
    .name("Manual Angle")
    .listen();

  const lensFlaresGroup = sunFolder.addFolder("Lens Flares");
  const flareFolder = lensFlaresGroup.addFolder("Solar Lens Flare");
  flareFolder.add(flareSettings, "enabled").name("Enabled");
  flareFolder.add(flareSettings, "intensity", 0.0, 1.0).name("Intensity");
  flareFolder
    .add(flareSettings, "enterDistance", -5.0, 5.0)
    .step(0.01)
    .name("Enter Distance");
  flareFolder
    .add(flareSettings, "leaveDistance", -5.0, 5.0)
    .step(0.01)
    .name("Leave Distance");
  flareFolder
    .add(flareSettings, "fadeDuration", 0.0, 3.0)
    .step(0.05)
    .name("Fade Duration (s)");

  const anaFolder = lensFlaresGroup.addFolder("Anamorphic Eclipse Flare");
  anaFolder.add(anamorphicSettings, "enabled").name("Enabled");
  anaFolder.add(anamorphicSettings, "intensity", 0.0, 2.0).name("Intensity");
  anaFolder.add(anamorphicSettings, "thickness", 0.1, 2.0).name("Thickness");
  anaFolder.add(anamorphicSettings, "size", 0.1, 5.0).name("Size");
  anaFolder
    .add(anamorphicSettings, "innerFade", 0.001, 1.0)
    .name("Inner Fade")
    .step(0.001);
  anaFolder
    .add(anamorphicSettings, "outerFade", 0.01, 1.0)
    .name("Outer Fade")
    .step(0.01);
  const aColor = { hex: anamorphicSettings.color };
  anaFolder
    .addColor(aColor, "hex")
    .name("Color")
    .onChange((c: number) => {
      anamorphicSettings.color = c;
    });

  const moonFolder = envGroup.addFolder("Moon");
  moonFolder
    .add(moonSettings, "enabled")
    .name("Show Moon")
    .onChange((v: boolean) => {
      moonMesh.visible = v;
    });
  moonFolder.add(moonSettings, "speed", 0.0, 0.01).name("Speed");
  moonFolder.add(moonSettings, "distance", 20, 150).name("Distance");
  moonFolder.add(moonSettings, "inclination", -1.5, 1.5).name("Inclination");
  moonFolder
    .add(moonSettings, "displacementScale", 0.0, 0.2)
    .name("Displacement")
    .onChange((v: number) => {
      const target = moonMesh as any;
      if (
        target.material &&
        target.material.displacementScale !== undefined
      ) {
        target.material.displacementScale = v;
      } else {
        target.traverse((child: any) => {
          if (
            child.material &&
            child.material.displacementScale !== undefined
          ) {
            child.material.displacementScale = v;
          }
        });
      }
    });
  moonFolder
    .add(moonSettings, "illumination", 0.0, 1.0)
    .name("Illumination")
    .onChange((v: number) => {
      const target = moonMesh as any;
      if (
        target.material &&
        target.material.emissiveIntensity !== undefined
      ) {
        target.material.emissiveIntensity = v;
      } else {
        target.traverse((child: any) => {
          if (
            child.material &&
            child.material.emissiveIntensity !== undefined
          ) {
            child.material.emissiveIntensity = v;
          }
        });
      }
    });

  const skyFolder = envGroup.addFolder("Background & Stars");
  skyFolder
    .add(scene, "backgroundIntensity", 0.0, 5.0)
    .name("Skybox Intensity");
  skyFolder
    .add(scene.backgroundRotation, "y", 0.0, Math.PI * 2.0)
    .step(0.01)
    .name("Yaw / Longitude (Y)");
  skyFolder
    .add(scene.backgroundRotation, "x", 0.0, Math.PI * 2.0)
    .step(0.01)
    .name("Pitch / Latitude (X)");
  skyFolder
    .add(scene.backgroundRotation, "z", 0.0, Math.PI * 2.0)
    .step(0.01)
    .name("Roll (Z)");

  if (backgroundStarsSettings && backgroundStars) {
    skyFolder
      .add(backgroundStarsSettings, "enabled")
      .name("Show Generated Stars")
      .onChange((v: boolean) => {
        backgroundStars.mesh.visible = v;
      });
    skyFolder
      .add(backgroundStarsSettings, "count", 0, 20000, 100)
      .name("Generated Stars Count")
      .onChange((v: number) => {
        backgroundStars.setCount(v);
      });
  }

  // ==========================================
  // GROUP 4: POST-PROCESSING & LENS EFFECTS
  // ==========================================
  const postGroup = gui.addFolder("Post-Processing & Lens Effects");

  const tmFolder = postGroup.addFolder("Tone Mapping & HDR");
  if (options.tmSettings && options.rebuildPipeline && options.tmExposureUniform) {
    const tmSettings = options.tmSettings;
    const rebuildPipeline = options.rebuildPipeline;
    const tmExposureUniform = options.tmExposureUniform;

    const modes = {
      "None": THREE.NoToneMapping,
      "ACES Filmic": THREE.ACESFilmicToneMapping,
      "AgX": THREE.AgXToneMapping,
      "Neutral": THREE.NeutralToneMapping,
      "Reinhard": THREE.ReinhardToneMapping,
      "Cineon": THREE.CineonToneMapping
    };

    tmFolder.add(tmSettings, "mode", modes)
      .name("Tone Mapping Mode")
      .onChange((v: any) => {
        tmSettings.mode = Number(v);
        rebuildPipeline();
      });

    tmFolder.add(tmSettings, "exposure", 0.1, 5.0).step(0.01)
      .name("Exposure")
      .onChange((v: number) => {
        tmExposureUniform.value = v;
      });

    tmFolder.add(tmSettings, "hdrPeakHighlights")
      .name("HDR Display Mode")
      .onChange((v: boolean) => {
        if (v) {
          options.sunSettings.intensity = 4.5;
          options.bloomSettings.strength = 0.2;
          tmExposureUniform.value = 1.25;
          tmSettings.exposure = 1.25;
        } else {
          options.sunSettings.intensity = CONSTANTS.GUI.SUN.INTENSITY;
          options.bloomSettings.strength = CONSTANTS.GUI.BLOOM.STRENGTH;
          tmExposureUniform.value = CONSTANTS.GUI.TONE_MAPPING.EXPOSURE;
          tmSettings.exposure = CONSTANTS.GUI.TONE_MAPPING.EXPOSURE;
        }
        
        options.sunMaterial.color = new THREE.Color(CONSTANTS.GUI.SUN.COLOR).multiplyScalar(options.sunSettings.intensity);
        if (options.bloomPass) {
          options.bloomPass.strength.value = options.bloomSettings.enabled ? options.bloomSettings.strength : 0.0;
        }
        
        gui.controllersRecursive().forEach((c) => {
          c.updateDisplay();
        });
      });
  }

  const ccFolder = postGroup.addFolder("Color Grading");
  ccFolder
    .add(cgSettings, "contrast", 0.5, 2.0)
    .name("Contrast")
    .onChange((v: number) => {
      cgUniforms.contrast.value = v;
    });
  ccFolder
    .add(cgSettings, "saturation", 0.0, 2.0)
    .name("Saturation")
    .onChange((v: number) => {
      cgUniforms.saturation.value = v;
    });
  ccFolder
    .add(cgSettings, "blackLevel", 0.0, 0.5)
    .name("Black Level")
    .onChange((v: number) => {
      cgUniforms.blackLevel.value = v;
    });
  ccFolder
    .add(cgSettings, "blueGreenBoost", 0.0, 1.0)
    .name("Blue/Green Boost")
    .onChange((v: number) => {
      cgUniforms.blueGreenBoost.value = v;
    });

  const bloomFolder = postGroup.addFolder("Bloom");
  bloomFolder
    .add(bloomSettings, "enabled")
    .name("Enabled")
    .onChange((v: boolean) => {
      bloomPass.strength.value = v ? bloomSettings.strength : 0.0;
    });
  bloomFolder
    .add(bloomSettings, "strength", 0, 5)
    .name("Strength")
    .onChange((v: number) => {
      if (bloomSettings.enabled) bloomPass.strength.value = v;
    });
  bloomFolder.add(bloomPass.radius, "value", 0, 1).name("Radius");
  bloomFolder.add(bloomPass.threshold, "value", 0, 1).name("Threshold");

  const lensFxGroup = postGroup.addFolder("Camera Lens FX");
  const caFolder = lensFxGroup.addFolder("Chromatic Aberration");
  caFolder
    .add(caSettings, "enabled")
    .name("Enabled")
    .onChange((v: boolean) => {
      caUniforms.strength.value = v ? caSettings.strength : 0.0;
    });
  caFolder
    .add(caSettings, "strength", 0.0, 5.0)
    .name("Strength")
    .onChange((v: number) => {
      if (caSettings.enabled) caUniforms.strength.value = v;
    });
  caFolder
    .add(caSettings, "scale", 0.5, 2.0)
    .name("Scale")
    .onChange((v: number) => {
      caUniforms.scale.value = v;
    });

  const filmFolder = lensFxGroup.addFolder("Film Grain");
  filmFolder
    .add(filmSettings, "enabled")
    .name("Enabled")
    .onChange((v: boolean) => {
      filmUniforms.intensity.value = v ? filmSettings.intensity : 0.0;
    });
  filmFolder
    .add(filmSettings, "intensity", 0.0, 1.0)
    .name("Intensity")
    .onChange((v: number) => {
      if (filmSettings.enabled) filmUniforms.intensity.value = v;
    });

  const vignetteFolder = lensFxGroup.addFolder("Vignette");
  vignetteFolder
    .add(vignetteSettings, "enabled")
    .name("Enabled")
    .onChange((v: boolean) => {
      vignetteUniforms.darkness.value = v ? vignetteSettings.darkness : 0.0;
    });
  vignetteFolder
    .add(vignetteSettings, "darkness", 0.0, 5.0)
    .step(0.1)
    .name("Darkness")
    .onChange((v: number) => {
      if (vignetteSettings.enabled) vignetteUniforms.darkness.value = v;
    });
  vignetteFolder
    .add(vignetteSettings, "offset", 0.0, 2.0)
    .step(0.01)
    .name("Offset")
    .onChange((v: number) => {
      vignetteUniforms.offset.value = v;
    });

  // ==========================================
  // GROUP 5: CAMERA & CONTROLS
  // ==========================================
  const cameraFolder = gui.addFolder("Camera & Controls");
  cameraFolder
    .add(camera, "fov", 5, 120, 1)
    .name("Field of View")
    .listen()
    .onChange(() => {
      camera.updateProjectionMatrix();
    });
  cameraFolder.add(controls, "autoRotate").name("Auto Rotate");
  cameraFolder.add(controls, "autoRotateSpeed", 0.1, 5.0).name("Rotate Speed");

  const posFolder = cameraFolder.addFolder("Position (Current)");
  posFolder.add(camera.position, "x").name("X").decimals(2).listen().disable();
  posFolder.add(camera.position, "y").name("Y").decimals(2).listen().disable();
  posFolder.add(camera.position, "z").name("Z").decimals(2).listen().disable();

  const targetFolder = cameraFolder.addFolder("Target (Current)");
  targetFolder
    .add(controls.target, "x")
    .name("X")
    .decimals(2)
    .listen()
    .disable();
  targetFolder
    .add(controls.target, "y")
    .name("Y")
    .decimals(2)
    .listen()
    .disable();
  targetFolder
    .add(controls.target, "z")
    .name("Z")
    .decimals(2)
    .listen()
    .disable();

  const camActions = {
    reset: () => {
      options.controls.reset();
      options.camera.fov = CONSTANTS.GUI.CAMERA.FOV;
      options.camera.updateProjectionMatrix();
    },
  };
  cameraFolder.add(camActions, "reset").name("Reset View");

  // ==========================================
  // GROUP 6: ENGINE & DEBUG
  // ==========================================
  const debugFolder = gui.addFolder("Engine & Debug");
  const renderTypeController = {
    renderType: CONSTANTS.RENDER_TYPE,
  };
  debugFolder
    .add(renderTypeController, "renderType", { WebGPU: "webgpu", WebGL: "webgl" })
    .name("Renderer Backend")
    .onChange((value: "webgpu" | "webgl") => {
      CONSTANTS.RENDER_TYPE = value;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("preferred_render_type", value);
        } catch (e) {
          // ignore
        }
        window.location.reload();
      }
    });
  debugFolder
    .add(debugSettings, "stats")
    .name("Show Stats")
    .onChange((v: boolean) => {
      statsDom.style.display = v ? "block" : "none";
    });
  debugFolder
    .add(options.renderSettings, "resolutionScale", 0.1, 2.0)
    .step(0.01)
    .name("Resolution Scale")
    .onChange(() => options.onResize());

  const debugActions = {
    exportConstants: () => {
      const exported = {
        SHOW: true,
        COLOR_GRADING: {
          CONTRAST: cgSettings.contrast,
          SATURATION: cgSettings.saturation,
          BLACK_LEVEL: cgSettings.blackLevel,
          BLUE_GREEN_BOOST: cgSettings.blueGreenBoost,
        },
        MOON: {
          ENABLED: moonSettings.enabled,
          SPEED: moonSettings.speed,
          DISTANCE: moonSettings.distance,
          INCLINATION: moonSettings.inclination,
        },
        LENS_FLARE: {
          ENABLED: flareSettings.enabled,
          INTENSITY: flareSettings.intensity,
          ENTER_DISTANCE: flareSettings.enterDistance,
          LEAVE_DISTANCE: flareSettings.leaveDistance,
          FADE_DURATION: flareSettings.fadeDuration,
        },
        ANAMORPHIC: {
          ENABLED: anamorphicSettings.enabled,
          INTENSITY: anamorphicSettings.intensity,
          THICKNESS: anamorphicSettings.thickness,
          SIZE: anamorphicSettings.size,
          COLOR: anamorphicSettings.color,
          INNER_FADE: anamorphicSettings.innerFade,
          OUTER_FADE: anamorphicSettings.outerFade,
        },
        TONE_MAPPING: {
          MODE: options.tmSettings ? options.tmSettings.mode : CONSTANTS.GUI.TONE_MAPPING.MODE,
          EXPOSURE: options.tmSettings ? options.tmSettings.exposure : CONSTANTS.GUI.TONE_MAPPING.EXPOSURE,
          HDR_PEAK_HIGHLIGHTS: options.tmSettings ? options.tmSettings.hdrPeakHighlights : CONSTANTS.GUI.TONE_MAPPING.HDR_PEAK_HIGHLIGHTS,
        },
        BLOOM: {
          ENABLED: bloomSettings.enabled,
          STRENGTH: bloomSettings.strength,
          RADIUS: bloomPass.radius.value,
          THRESHOLD: bloomPass.threshold.value,
        },
        VIGNETTE: {
          ENABLED: vignetteSettings.enabled,
          DARKNESS: vignetteSettings.darkness,
          OFFSET: vignetteSettings.offset,
        },
        CHROMATIC_ABERRATION: {
          ENABLED: caSettings.enabled,
          STRENGTH: caSettings.strength,
          SCALE: caSettings.scale,
        },
        FILM_GRAIN: {
          ENABLED: filmSettings.enabled,
          INTENSITY: filmSettings.intensity,
        },
        ATMOSPHERE: {
          MODE:
            earth.userData.atmosMode.value === 0.0 ? "Scattering" : "Airglow",
          DENSITY: earth.userData.atmosDensity.value,
          RAYLEIGH_COLOR: earth.userData.rayleighColor.value.getHex(),
          MIE_COLOR: earth.userData.mieColor.value.getHex(),
          TWILIGHT_COLOR: earth.userData.twilightColor.value.getHex(),
          AIRGLOW_COLOR: earth.userData.airglowColor.value.getHex(),
        },
        CLOUD_SHADOWS: {
          DISTANCE: earth.userData.shadowDist.value,
          INTENSITY: earth.userData.shadowIntensity.value,
          COLOR: earth.userData.shadowColor.value.getHex(),
        },
        OCEAN: {
          ROUGHNESS: earth.userData.waterRoughness.value,
          METALNESS: earth.userData.waterMetalness.value,
          BATHYMETRY_INTENSITY: earth.userData.bathymetryIntensity ? earth.userData.bathymetryIntensity.value : CONSTANTS.GUI.OCEAN.BATHYMETRY_INTENSITY,
          SHALLOW_COLOR: earth.userData.oceanShallowColor ? earth.userData.oceanShallowColor.value.getHex() : CONSTANTS.GUI.OCEAN.SHALLOW_COLOR,
          DEEP_COLOR: earth.userData.oceanDeepColor ? earth.userData.oceanDeepColor.value.getHex() : CONSTANTS.GUI.OCEAN.DEEP_COLOR,
          WATER_CLARITY: earth.userData.waterClarity ? earth.userData.waterClarity.value : CONSTANTS.GUI.OCEAN.WATER_CLARITY,
          IOR: earth.userData.waterIor ? earth.userData.waterIor.value : CONSTANTS.GUI.OCEAN.IOR,
          FRESNEL_STRENGTH: earth.userData.fresnelStrength ? earth.userData.fresnelStrength.value : CONSTANTS.GUI.OCEAN.FRESNEL_STRENGTH,
          FRESNEL_COLOR: earth.userData.fresnelColor ? earth.userData.fresnelColor.value.getHex() : CONSTANTS.GUI.OCEAN.FRESNEL_COLOR,
          FRESNEL_EXPONENT: earth.userData.fresnelExponent ? earth.userData.fresnelExponent.value : CONSTANTS.GUI.OCEAN.FRESNEL_EXPONENT,
          SSS_COLOR: earth.userData.sssColor ? earth.userData.sssColor.value.getHex() : CONSTANTS.GUI.OCEAN.SSS_COLOR,
          SSS_INTENSITY: earth.userData.sssIntensity ? earth.userData.sssIntensity.value : CONSTANTS.GUI.OCEAN.SSS_INTENSITY,
          FOAM_THRESHOLD: earth.userData.foamThreshold ? earth.userData.foamThreshold.value : CONSTANTS.GUI.OCEAN.FOAM_THRESHOLD,
          FOAM_INTENSITY: earth.userData.foamIntensity ? earth.userData.foamIntensity.value : CONSTANTS.GUI.OCEAN.FOAM_INTENSITY,
          COASTAL_FADE_DISTANCE: earth.userData.coastalFadeDistance ? earth.userData.coastalFadeDistance.value : CONSTANTS.GUI.OCEAN.COASTAL_FADE_DISTANCE,
          WAVES_ENABLED: earth.userData.wavesEnabled ? earth.userData.wavesEnabled.value > 0.5 : true,
          WAVE_HEIGHT: earth.userData.waveHeight ? earth.userData.waveHeight.value : CONSTANTS.GUI.OCEAN.WAVE_HEIGHT,
          WAVE_SCALE: earth.userData.waveScale ? earth.userData.waveScale.value : CONSTANTS.GUI.OCEAN.WAVE_SCALE,
          WAVE_SPEED: earth.userData.waveSpeed ? earth.userData.waveSpeed.value : CONSTANTS.GUI.OCEAN.WAVE_SPEED,
          WAVE_SPARKLE: earth.userData.waveSparkle ? earth.userData.waveSparkle.value : CONSTANTS.GUI.OCEAN.WAVE_SPARKLE,
        },
        EARTH: {
          ROTATION_SPEED: earthSettings.rotationSpeed,
          BUMP_SCALE: terrainSettings.bumpScale,
          TERRAIN_SHADOW_INTENSITY: earth.userData.terrainShadowIntensity.value,
          TERRAIN_SHADOW_OFFSET: earth.userData.terrainShadowOffset.value,
          TRUE_INCLINATION: earthSettings.trueInclination,
        },
        CAMERA: {
          FOV: camera.fov,
          POSITION: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          TARGET: {
            x: controls.target.x,
            y: controls.target.y,
            z: controls.target.z,
          },
          AUTO_ROTATE: controls.autoRotate,
          AUTO_ROTATE_SPEED: controls.autoRotateSpeed,
        },
        ENVIRONMENT: {
          SKYBOX_INTENSITY: scene.backgroundIntensity,
          SKYBOX_AZIMUTH: scene.backgroundRotation.y,
          SKYBOX_PITCH: scene.backgroundRotation.x,
          SKYBOX_ROLL: scene.backgroundRotation.z,
          DARK_SIDE_BRIGHTNESS: earth.userData.darkSideBrightness.value,
          CITY_LIGHTS: earth.userData.cityLights.value,
        },
        DEBUG: {
          STATS: debugSettings.stats,
          RESOLUTION_SCALE: options.renderSettings.resolutionScale,
        },
        SUN: {
          INTENSITY: sunSettings.intensity,
          COLOR: directionalLight.color.getHex(),
          AUTO_ROTATE: sunSettings.autoRotate,
          SPEED: sunSettings.speed,
          INCLINATION: sunSettings.inclination,
        },
        COUNTRY_BORDERS: {
          ENABLED: options.countryBorders ? options.countryBorders.settings.enabled : CONSTANTS.GUI.COUNTRY_BORDERS.ENABLED,
          COLOR: options.countryBorders ? options.countryBorders.settings.color : CONSTANTS.GUI.COUNTRY_BORDERS.COLOR,
          OPACITY: options.countryBorders ? options.countryBorders.settings.opacity : CONSTANTS.GUI.COUNTRY_BORDERS.OPACITY,
          ELEVATION: options.countryBorders ? options.countryBorders.settings.elevation : CONSTANTS.GUI.COUNTRY_BORDERS.ELEVATION,
        },
        COUNTRY_LABELS: {
          ENABLED: options.countryLabels ? options.countryLabels.settings.enabled : CONSTANTS.GUI.COUNTRY_LABELS.ENABLED,
          MAX_VISIBLE: options.countryLabels ? options.countryLabels.settings.maxVisible : CONSTANTS.GUI.COUNTRY_LABELS.MAX_VISIBLE,
          FADE_DISTANCE_FAR: options.countryLabels ? options.countryLabels.settings.fadeDistanceFar : CONSTANTS.GUI.COUNTRY_LABELS.FADE_DISTANCE_FAR,
          FADE_DISTANCE_MID: options.countryLabels ? options.countryLabels.settings.fadeDistanceMid : CONSTANTS.GUI.COUNTRY_LABELS.FADE_DISTANCE_MID,
          FADE_DISTANCE_CLOSE: options.countryLabels ? options.countryLabels.settings.fadeDistanceClose : CONSTANTS.GUI.COUNTRY_LABELS.FADE_DISTANCE_CLOSE,
        },
        GRATICULE: {
          ENABLED: options.graticule ? options.graticule.settings.enabled : CONSTANTS.GUI.GRATICULE.ENABLED,
          STEP: options.graticule ? options.graticule.settings.step : CONSTANTS.GUI.GRATICULE.STEP,
          COLOR: options.graticule ? options.graticule.settings.color : CONSTANTS.GUI.GRATICULE.COLOR,
          OPACITY: options.graticule ? options.graticule.settings.opacity : CONSTANTS.GUI.GRATICULE.OPACITY,
          ELEVATION: options.graticule ? options.graticule.settings.elevation : CONSTANTS.GUI.GRATICULE.ELEVATION,
        },
      };

      const formatHex = (key: string, val: any) => {
        if (typeof val === "number" && key.includes("COLOR")) {
          return `0x${val.toString(16).padStart(6, "0")}`;
        }
        return val;
      };

      let jsonStr = "GUI: " + JSON.stringify(exported, formatHex, 4);
      jsonStr = jsonStr.replace(/"(0x[0-9a-fA-F]+)"/g, "$1");

      navigator.clipboard
        .writeText(jsonStr)
        .then(() => {
          console.log("Exported CONSTANTS.GUI:\n", jsonStr);
        })
        .catch((err) => {
          console.error("Clipboard copy failed:", err);
          console.log("Exported CONSTANTS.GUI:\n", jsonStr);
        });
    },
    takeScreenshot: () => {
      if (!canvas || !renderer || !renderPipeline) {
        console.warn("Screenshot components not fully initialized.");
        return;
      }
      
      const oldScale = options.renderSettings.resolutionScale;
      const parentWidth = canvas.parentElement ? canvas.parentElement.clientWidth : canvas.width;
      const dpr = window.devicePixelRatio || 1;
      const currentWidthWithDpr = parentWidth * Math.min(dpr, 2);
      
      // Calculate multiplier to target a high quality 4K resolution (approx 3840px width)
      const scaleFactor = Math.min(6.0, Math.max(2.0, 3840 / currentWidthWithDpr));
      
      options.renderSettings.resolutionScale = scaleFactor;
      options.onResize();
      
      // Render frame with target resolution
      renderPipeline.render();
      
      // Immediately extract data URL before WebGPU backbuffer is presented/cleared
      const dataUrl = canvas.toDataURL("image/png");
      
      options.renderSettings.resolutionScale = oldScale;
      options.onResize();
      
      const link = document.createElement("a");
      const finalWidth = Math.round(parentWidth * Math.min(dpr, 2) * scaleFactor);
      const finalHeight = Math.round(canvas.height);
      link.download = `earth_atmosphere_screenshot_${finalWidth}x${finalHeight}.png`;
      link.href = dataUrl;
      link.click();
    },
  };
  debugFolder.add(debugActions, "exportConstants").name("Copy GUI Constants");
  debugFolder.add(debugActions, "takeScreenshot").name("Take 4K Screenshot");

  // Close all folders recursively so they start minimized/collapsed
  const closeAll = (f: any) => {
    if (typeof f.close === "function") {
      f.close();
    }
    if (Array.isArray(f.folders)) {
      f.folders.forEach((sub: any) => closeAll(sub));
    }
  };
  closeAll(gui);
}
