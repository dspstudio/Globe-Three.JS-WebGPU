import { LocationInfo } from "./types";

// Check device capability
export const isMobileOrTablet = () => {
  if (typeof window === "undefined") return false;
  const isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(
      navigator.userAgent,
    );
  const isIPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isCoarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const isSmallScreen = window.innerWidth < 1024 || window.innerHeight < 768;

  return isMobileUA || isIPadOS || isSmallScreen || isCoarsePointer;
};

const getInitialResolutionScale = () => {
  if (typeof document === "undefined") return 1.0;
  if (isMobileOrTablet()) return 0.5;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl");
    if (!gl) return 0.5;
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return 0.5;
    const renderer = (
      gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ""
    ).toLowerCase();

    const isNvidia =
      renderer.includes("nvidia") ||
      renderer.includes("rtx") ||
      renderer.includes("gtx");
    const isAmdDedicated =
      renderer.includes("radeon") &&
      (renderer.includes("rx ") || renderer.includes("pro "));
    const isAppleM = renderer.includes("apple");

    if (isNvidia || isAmdDedicated || isAppleM) {
      return 1.0;
    }
    return 0.5;
  } catch (e) {
    return 0.5;
  }
};

const use2k =
  typeof window !== "undefined" &&
  (isMobileOrTablet() || getInitialResolutionScale() < 1.0);

const detectRenderType = (): "webgpu" | "webgl" => {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("preferred_render_type");
      if (saved === "webgpu" || saved === "webgl") {
        return saved;
      }
    } catch (e) {
      // ignore
    }
  }
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "webgpu";
  }
  return "gpu" in navigator && !!(navigator as any).gpu ? "webgpu" : "webgl";
};

export const CONSTANTS = {
  RENDER_TYPE: detectRenderType() as "webgpu" | "webgl",
  EARTH_RADIUS: 10,
  ATMOSPHERE_RADIUS: 10.2,
  SEGMENTS: use2k ? 64 : 256, // Less segments for lower-end devices
  TEXTURES: {
    ALBEDO: use2k ? "./2k_earth_daymap.jpg" : "./8k_earth_daymap.jpg",
    NIGHT: use2k ? "./2k_earth_nightmap.jpg" : "./8k_earth_nightmap.jpg",
    SPECULAR: use2k
      ? "./2k_earth_specular_map.png"
      : "./8k_earth_specular_map.png",
    NORMAL: use2k ? "./2k_earth_normal_map.png" : "./8k_earth_normal_map.png",
    BUMP: use2k ? "./2k_earth_bump_map.png" : "./8k_earth_bump_map.png",
    CLOUDS: use2k ? "./2k_earth_clouds.jpg" : "./8k_earth_clouds.jpg",
    BATHYMETRY: "./gebco_08_rev_bath_5400x2700.png",
    SST_ANOMALIES: "./GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies.png",
    MODIS_NDVI: "./MODIS_Terra_NDVI_8Day.png",
    STARS: use2k ? "./starmap_2k.jpg" : "./starmap_8k.jpg",
    MOON_ALBEDO: use2k ? "./2k_moon.jpg" : "./8k_moon.jpg",
    MOON_DISPLACEMENT: use2k ? "./ldem_4.png" : "./ldem_4.png",
    SUN: "./sun_texture.jpg",
  },
  GUI: {
    SHOW: typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("settings") !== "false") : true,
    TONE_MAPPING: {
      MODE: 4, // 4 = ACESFilmicToneMapping
      EXPOSURE: 1,
      HDR_PEAK_HIGHLIGHTS: false,
    },
    BLOOM: {
      ENABLED: true,
      STRENGTH: 0.08,
      RADIUS: 0.3,
      THRESHOLD: 0.92,
    },
    COLOR_GRADING: {
      CONTRAST: 1,
      SATURATION: 1,
      BLACK_LEVEL: 0,
      BLUE_GREEN_BOOST: 0.0,
    },
    MOON: {
      ENABLED: true,
      SPEED: 0.0002,
      DISTANCE: 50,
      INCLINATION: 0,
      DISPLACEMENT_SCALE: 0,
      ILLUMINATION: 0.02,
    },
    LENS_FLARE: {
      ENABLED: true,
      INTENSITY: 0.15,
      ENTER_DISTANCE: -0.8,
      LEAVE_DISTANCE: -1,
      FADE_DURATION: 0.0,
    },
    ANAMORPHIC: {
      ENABLED: false,
      INTENSITY: 0.5,
      THICKNESS: 2,
      SIZE: 0.2,
      COLOR: 0xFFFFFF,
      INNER_FADE: 0.08,
      OUTER_FADE: 0.08,
    },
    VIGNETTE: {
      ENABLED: true,
      DARKNESS: 1,
      OFFSET: 0.5,
    },
    CHROMATIC_ABERRATION: {
      ENABLED: false,
      STRENGTH: 0.25,
      SCALE: 0.5,
    },
    FILM_GRAIN: {
      ENABLED: false,
      INTENSITY: 0.25,
    },
    ATMOSPHERE: {
      MODE: "Scattering",
      DENSITY: 5.0,
      RAYLEIGH_INTENSITY: 1.0,
      RAYLEIGH_COLOR: 0x3377ff,
      MIE_COLOR: 0x0d374a,
      TWILIGHT_COLOR: 0xff5533,
      AIRGLOW_COLOR: 0x44ff55,
    },
    CLOUD_SHADOWS: {
      DISTANCE: 0.08,
      INTENSITY: 0.65,
      COLOR: 0x223048,
    },
    OCEAN: {
      ROUGHNESS: 0.4,
      METALNESS: 0.2,
      BATHYMETRY_INTENSITY: 0.6,
      SHALLOW_COLOR: 0x0f8be3,
      DEEP_COLOR: 0x02164f,
      WATER_CLARITY: 0.7,
      IOR: 1.333,
      FRESNEL_STRENGTH: 0.1,
      SSS_COLOR: 0x00d0ff,
      SSS_INTENSITY: 0.25,
      FOAM_THRESHOLD: 0.95,
      FOAM_INTENSITY: 0.2,
      COASTAL_FADE_DISTANCE: 0.1,
    },
    EARTH: {
      ROTATION_SPEED: 0.0001,
      BUMP_SCALE: 2.0,
      DISPLACEMENT_SCALE: 0.02,
      LAND_ROUGHNESS: 1,
      NDVI_ENHANCE_STRENGTH: 0.3,
      GIBS_ENABLED: false,
      GIBS_LAYER: "Sea Surface Temp Anomalies",
      GIBS_OPACITY: 0.8,
      TERRAIN_SHADOW_INTENSITY: 1.0,
      TERRAIN_SHADOW_OFFSET: 0.002,
      TRUE_INCLINATION: false,
      CUTAWAY: 0.0, // 0.0 = Whole Earth, 1.0 = Cut in half showing inner layers
      CUTAWAY_ANIMATE: false,
    },
    CAMERA: {
      FOV: 45,
      POSITION: { x: 0, y: 0, z: 50 },
      TARGET: { x: 0, y: 0, z: 0 },
      AUTO_ROTATE: false,
      AUTO_ROTATE_SPEED: 0.5,
    },
    ENVIRONMENT: {
      SKYBOX_INTENSITY: 0.5,
      SKYBOX_AZIMUTH: 1.75,
      SKYBOX_PITCH: 0.0,
      SKYBOX_ROLL: 0.0,
      DARK_SIDE_BRIGHTNESS: 0.055,
      CITY_LIGHTS: 2.0,
    },
    DEBUG: {
      STATS: false,
      RESOLUTION_SCALE: getInitialResolutionScale(),
    },
    SUN: {
      INTENSITY: 2.5,
      COLOR: 0xffffff,
      AUTO_ROTATE: true,
      SPEED: 0.05,
      INCLINATION: 0.3,
      USE_TEXTURE: true,
      TEXTURE_BLEND: 0,
      NOISE_STRENGTH: 0.35,
      GLOW_INTENSITY: 1.8,
      EMISSIVE_BOOST: 10,
    },
    SATELLITES: {
      ENABLED: false,
      COUNT: 20000,
      SIZE: 0.05,
      COLOR: 0x5cd6ff,
      SPEED_SCALE: 1.0,
    },
    BACKGROUND_STARS: {
      ENABLED: false,
      COUNT: 4000,
      RADIUS: 140,
      SEED: 0,
      COOL_COLOR: "#9db6ff",
      WARM_COLOR: "#ffd9b0",
    },
    CITIES: {
      ENABLED: false,
    },
    COUNTRY_BORDERS: {
      ENABLED: false,
      COLOR: 0xffffff,
      OPACITY: 0.05,
      ELEVATION: 0.015,
    },
    COUNTRY_LABELS: {
      ENABLED: false,
      MAX_VISIBLE: 45,
      FADE_DISTANCE_FAR: 36,
      FADE_DISTANCE_MID: 27,
      FADE_DISTANCE_CLOSE: 19,
    },
    GRATICULE: {
      ENABLED: false,
      STEP: 15,
      COLOR: 0x00d2ff,
      OPACITY: 0.15,
      ELEVATION: 0.012,
    },
  },
};

export const CINEMATIC_LOCATIONS: LocationInfo[] = [
  {
    id: "bucharest",
    name: "Bucharest, Romania",
    lat: 44.4268,
    lng: 26.1025
  },
  {
    id: "london",
    name: "London, United Kingdom",
    lat: 51.5074,
    lng: -0.1278
  },
  {
    id: "paris",
    name: "Paris, France",
    lat: 48.8566,
    lng: 2.3522
  },
  {
    id: "berlin",
    name: "Berlin, Germany",
    lat: 52.52,
    lng: 13.405
  },
  {
    id: "rome",
    name: "Rome, Italy",
    lat: 41.9028,
    lng: 12.4964
  },
  {
    id: "madrid",
    name: "Madrid, Spain",
    lat: 40.4168,
    lng: -3.7038
  },
  {
    id: "new_york",
    name: "New York, USA",
    lat: 40.7128,
    lng: -74.0060
  },
  {
    id: "los_angeles",
    name: "Los Angeles, USA",
    lat: 34.0522,
    lng: -118.2437
  },
  {
    id: "chicago",
    name: "Chicago, USA",
    lat: 41.8781,
    lng: -87.6298
  },
  {
    id: "tokyo",
    name: "Tokyo, Japan",
    lat: 35.6762,
    lng: 139.6503
  },
  {
    id: "sydney",
    name: "Sydney, Australia",
    lat: -33.8688,
    lng: 151.2093
  },
  {
    id: "shanghai",
    name: "Shanghai, China",
    lat: 31.2304,
    lng: 121.4737
  },
  {
    id: "dubai",
    name: "Dubai, UAE",
    lat: 25.2048,
    lng: 55.2708
  },
  {
    id: "vienna",
    name: "Vienna, Austria",
    lat: 48.2082,
    lng: 16.3738
  },
  {
    id: "athens",
    name: "Athens, Greece",
    lat: 37.9838,
    lng: 23.7275
  },
  {
    id: "amsterdam",
    name: "Amsterdam, Netherlands",
    lat: 52.3676,
    lng: 4.9041
  }
];
