// Check device capability
export const isMobileOrTablet = () => {
  if (typeof window === "undefined") return false;
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  return isMobile || window.innerWidth < 1024;
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

export const CONSTANTS = {
  RENDER_TYPE: "webgpu", // 'webgpu' or 'webgl'
  EARTH_RADIUS: 10,
  ATMOSPHERE_RADIUS: 10.2,
  SEGMENTS: use2k ? 64 : 256, // Less segments for lower-end devices
  TEXTURES: {
    ALBEDO: use2k ? "./2k_earth_daymap.jpg" : "./8k_earth_daymap.jpg",
    NIGHT: use2k ? "./2k_earth_nightmap.jpg" : "./8k_earth_nightmap.jpg",
    SPECULAR: use2k
      ? "./2k_earth_specular_map.jpg"
      : "./8k_earth_specular_map.jpg",
    NORMAL: use2k ? "./8k_earth_normal_map.jpg" : "./8k_earth_normal_map.jpg",
    CLOUDS: use2k ? "./2k_earth_clouds.jpg" : "./8k_earth_clouds.jpg",
    STARS: use2k ? "./starmap_2k.jpg" : "./starmap_8k.jpg",
    MOON_ALBEDO: use2k ? "./2k_moon.jpg" : "./8k_moon.jpg",
    MOON_DISPLACEMENT: use2k ? "./ldem_4.png" : "./ldem_4.png",
  },
  GUI: {
    SHOW: import.meta.env.DEV,
    BLOOM: {
      ENABLED: true,
      STRENGTH: 0.1,
      RADIUS: 0.3,
      THRESHOLD: 0.9,
    },
    COLOR_GRADING: {
      CONTRAST: 1.0,
      SATURATION: 1.5,
      BLACK_LEVEL: 0.015,
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
    },
    ANAMORPHIC: {
      ENABLED: false,
      INTENSITY: 0.5,
      THICKNESS: 2,
      SIZE: 0.1,
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
      ENABLED: true,
      STRENGTH: 0.25,
      SCALE: 0.5,
    },
    FILM_GRAIN: {
      ENABLED: false,
      INTENSITY: 0.25,
    },
    ATMOSPHERE: {
      MODE: "Scattering",
      DENSITY: 20.0,
      RAYLEIGH_INTENSITY: 1.0,
      RAYLEIGH_COLOR: 0x3377ff,
      MIE_COLOR: 0x0d374a,
      TWILIGHT_COLOR: 0xff5533,
      AIRGLOW_COLOR: 0x44ff55,
    },
    CLOUD_SHADOWS: {
      DISTANCE: 1.2,
      INTENSITY: 0.8,
      COLOR: 0x334059,
    },
    OCEAN: {
      ROUGHNESS: 0.4,
      METALNESS: 0.05,
    },
    EARTH: {
      ROTATION_SPEED: 0.0005,
      BUMP_SCALE: 5.0,
      TERRAIN_SHADOW_INTENSITY: 1.0,
      TERRAIN_SHADOW_OFFSET: 0.002,
      TRUE_INCLINATION: false,
    },
    CAMERA: {
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
  },
};
