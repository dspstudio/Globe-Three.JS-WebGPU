import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import {
  pass,
  uniform,
  screenCoordinate,
  screenSize,
  time,
  vec2,
  vec3,
  mul,
} from "three/tsl";
import { PointsNodeMaterial } from "three/webgpu";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { smaa } from "three/examples/jsm/tsl/display/SMAANode.js";
import { chromaticAberration } from "three/examples/jsm/tsl/display/ChromaticAberrationNode.js";
import { film } from "three/examples/jsm/tsl/display/FilmNode.js";
import GUI from "lil-gui";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { CONSTANTS, CINEMATIC_LOCATIONS } from "../constants";
import { createEarth } from "./Earth";
import { createMoon, updateMoon } from "./Moon";
import { createSun } from "./Sun";
import {
  lensflareShader,
  ccShader,
  updateLensFlare,
  anamorphicShader,
} from "./LensFlare";
import { colorGradeShader, vignetteShader, gtUchimuraShader } from "./ColorGrading";
import { buildGui } from "./GUIBuilder";
import { BackgroundStars } from "./BackgroundStars";
import { CountryBorders } from "./CountryBorders";
import { CountryLabels } from "./CountryLabels";
import { Graticule } from "./Graticule";
import { ProjectedLocation, ProjectedCountryLabel } from "../types";

export class Engine {
  private canvas: HTMLCanvasElement;
  public renderer: any; // Using any for renderer to avoid TS errors with newest API mismatch
  private renderPipeline: any;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private animationId: number = 0;
  private root: THREE.Group;
  private textureLoader: THREE.TextureLoader;
  private gui: GUI;
  private stats: any;

  private sunMesh: THREE.Mesh;
  private sunUserData: any;
  private directionalLight: THREE.DirectionalLight;
  private moonMesh: THREE.Object3D;
  private moonSettings: {
    enabled: boolean;
    speed: number;
    distance: number;
    inclination: number;
    displacementScale: number;
    illumination: number;
    angle: number;
  };
  private sunDirUniform: any;
  private sunColorUniform: any;
  private moonPosUniform: any;
  private flarePosUniform: any;
  private flareIntensityUniform: any;
  private flareSettings: {
    enabled: boolean;
    intensity: number;
    enterDistance: number;
    leaveDistance: number;
    fadeDuration: number;
  };
  private anamorphicIntensityUniform: any;
  private anamorphicSizeUniform: any;
  private anamorphicThicknessUniform: any;
  private anamorphicColorUniform: any;

  // Pre-allocated temporary vectors for zero allocation animation loop
  private tempVec3 = new THREE.Vector3();
  private tempDirToAnchor = new THREE.Vector3();
  private tempTargetPos = new THREE.Vector3();
  private tempEarthCenter = new THREE.Vector3(0, 0, 0);
  private tempDirToCamera = new THREE.Vector3();
  private anamorphicSettings: {
    enabled: boolean;
    intensity: number;
    thickness: number;
    size: number;
    color: number;
    innerFade: number;
    outerFade: number;
  };
  private sunSettings: {
    autoRotate: boolean;
    speed: number;
    inclination: number;
    angle: number;
    intensity: number;
  };
  private caSettings: any;
  private filmSettings: any;
  private vignetteSettings: any;
  private earthSettings: { trueInclination: boolean; rotationSpeed: number };
  private renderSettings: { resolutionScale: number };
  private bloomSettings: {
    enabled: boolean;
    strength: number;
    radius: number;
    threshold: number;
  };
  private satelliteSettings!: {
    enabled: boolean;
    count: number;
    size: number;
    color: number;
    speedScale: number;
  };
  private satellitePoints: THREE.Points | null = null;
  private satelliteData: {
    radii: Float32Array;
    inclinations: Float32Array;
    ascendingNodes: Float32Array;
    angularVelocities: Float32Array;
    phases: Float32Array;
  } | null = null;
  private satSizeUniform!: any;
  private satColorUniform!: any;
  private backgroundStars: BackgroundStars | null = null;
  private backgroundStarsSettings!: {
    enabled: boolean;
    count: number;
    radius: number;
    seed: number;
    coolColor: string;
    warmColor: string;
  };
  private citiesSettings!: {
    enabled: boolean;
  };

  private earthGroup: THREE.Group | null = null;
  public countryBorders: CountryBorders | null = null;
  public countryLabels: CountryLabels | null = null;
  public graticule: Graticule | null = null;
  private locationAnchors: Map<string, THREE.Object3D> = new Map();
  public onLocationsUpdate: ((locations: ProjectedLocation[]) => void) | null = null;
  public onCountryLabelsUpdate: ((labels: ProjectedCountryLabel[]) => void) | null = null;
  public focusTargetAnchorId: string | null = null;

  private isDisposed: boolean = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Dynamic import or require might be needed, but 'three/webgpu' is standard syntax in r184
    // We will try dynamic mapping if it fails
  }

  public async init(onProgress?: (msg: string) => void) {
    if (onProgress) onProgress("Initializing WebGPU Renderer");
    const { WebGPURenderer } = await import("three/webgpu");
    if (this.isDisposed) return;

    this.renderer = new WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      forceWebGL: CONSTANTS.RENDER_TYPE === "webgl",
    });
    try {
      await this.renderer.init();
    } catch (err) {
      if (CONSTANTS.RENDER_TYPE === "webgpu") {
        console.warn("WebGPU initialization failed, falling back to WebGL:", err);
        CONSTANTS.RENDER_TYPE = "webgl";
        this.renderer = new WebGPURenderer({
          canvas: this.canvas,
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          forceWebGL: true,
        });
        await this.renderer.init();
      } else {
        throw err;
      }
    }
    if (this.isDisposed) return;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = false;

    // Set initial non-zero size right away on renderer
    this.handleResize();

    if (onProgress) onProgress("Setting up Scene & Camera");
    this.camera = new THREE.PerspectiveCamera(
      CONSTANTS.GUI.CAMERA.FOV,
      1,
      0.1,
      1000,
    );
    this.camera.position.set(
      CONSTANTS.GUI.CAMERA.POSITION.x,
      CONSTANTS.GUI.CAMERA.POSITION.y,
      CONSTANTS.GUI.CAMERA.POSITION.z,
    );

    this.scene = new THREE.Scene();

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = true;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    this.controls.minDistance = CONSTANTS.EARTH_RADIUS * 1.2;
    this.controls.maxDistance = CONSTANTS.EARTH_RADIUS * 10;
    this.controls.autoRotate = CONSTANTS.GUI.CAMERA.AUTO_ROTATE;
    this.controls.autoRotateSpeed = CONSTANTS.GUI.CAMERA.AUTO_ROTATE_SPEED;
    this.controls.target.set(
      CONSTANTS.GUI.CAMERA.TARGET.x,
      CONSTANTS.GUI.CAMERA.TARGET.y,
      CONSTANTS.GUI.CAMERA.TARGET.z,
    );
    this.controls.update();
    this.controls.saveState();

    this.controls.addEventListener("start", () => {
      this.focusTargetAnchorId = null;
    });

    this.textureLoader = new THREE.TextureLoader();

    this.stats = new Stats();
    this.stats.dom.style.position = "absolute";
    this.stats.dom.style.top = "0px";
    this.stats.dom.style.left = "0px";
    this.stats.dom.style.display = CONSTANTS.GUI.DEBUG.STATS ? "block" : "none";
    if (this.canvas.parentElement) {
      this.canvas.parentElement.appendChild(this.stats.dom);
    }

    if (onProgress) onProgress("Loading Celestial Objects");
    this.directionalLight = new THREE.DirectionalLight(
      CONSTANTS.GUI.SUN.COLOR,
      CONSTANTS.GUI.SUN.INTENSITY,
    );
    this.directionalLight.position.set(10, 5, 10);
    this.scene.add(this.directionalLight);

    const { mesh: sunMeshObj, userData: sunUserDataObj } = await createSun(this.textureLoader);
    this.sunMesh = sunMeshObj;
    this.sunUserData = sunUserDataObj;
    this.sunMesh.position.copy(
      this.directionalLight.position.clone().normalize().multiplyScalar(200),
    );
    this.scene.add(this.sunMesh);

    this.sunDirUniform = uniform(
      this.directionalLight.position.clone().normalize(),
    );
    this.sunColorUniform = uniform(this.directionalLight.color);
    this.moonPosUniform = uniform(new THREE.Vector3());

    this.sunSettings = {
      autoRotate: CONSTANTS.GUI.SUN.AUTO_ROTATE,
      speed: CONSTANTS.GUI.SUN.SPEED,
      inclination: CONSTANTS.GUI.SUN.INCLINATION,
      intensity: CONSTANTS.GUI.SUN.INTENSITY,
      angle: 0.0,
    };

    const maxAnisotropy = this.renderer.getMaxAnisotropy();

    this.moonSettings = {
      enabled: CONSTANTS.GUI.MOON.ENABLED,
      speed: CONSTANTS.GUI.MOON.SPEED,
      distance: CONSTANTS.GUI.MOON.DISTANCE,
      inclination: CONSTANTS.GUI.MOON.INCLINATION,
      displacementScale: CONSTANTS.GUI.MOON.DISPLACEMENT_SCALE,
      illumination: CONSTANTS.GUI.MOON.ILLUMINATION,
      angle: Math.PI,
    };
    this.moonMesh = await createMoon(this.textureLoader, maxAnisotropy);
    if (this.isDisposed) return;
    this.scene.add(this.moonMesh);
    this.moonMesh.position.set(0, 0, -100); // Initial background pos

    if (onProgress) onProgress("Loading Environment Map (PNG)");
    const starsTexture = await this.textureLoader.loadAsync(
      CONSTANTS.TEXTURES.STARS,
    );
    if (this.isDisposed) return;
    starsTexture.mapping = THREE.EquirectangularReflectionMapping;
    starsTexture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = starsTexture;
    this.scene.backgroundRotation.order = "YXZ"; // Better Euler order for Azimuth/Pitch
    this.scene.backgroundIntensity = CONSTANTS.GUI.ENVIRONMENT.SKYBOX_INTENSITY; // Default skybox intensity
    this.scene.backgroundRotation.y = CONSTANTS.GUI.ENVIRONMENT.SKYBOX_AZIMUTH; // Azimuth
    this.scene.backgroundRotation.x = CONSTANTS.GUI.ENVIRONMENT.SKYBOX_PITCH; // Pitch
    this.scene.backgroundRotation.z = CONSTANTS.GUI.ENVIRONMENT.SKYBOX_ROLL; // Roll

    if (onProgress) onProgress("Loading Earth Textures");
    const earth = await createEarth(
      this.textureLoader,
      this.sunDirUniform,
      this.moonPosUniform,
      maxAnisotropy,
    );
    if (this.isDisposed) return;
    this.root.add(earth);
    this.earthGroup = earth;

    // Listen for UI event to toggle or set cutaway
    window.addEventListener('toggle-cutaway', this.handleToggleCutaway);
    window.addEventListener('set-cutaway', this.handleSetCutaway as any);

    this.countryBorders = new CountryBorders(this.earthGroup);
    if (CONSTANTS.GUI.COUNTRY_BORDERS.ENABLED) {
      await this.countryBorders.init();
    }

    this.countryLabels = new CountryLabels(this.earthGroup);
    await this.countryLabels.init();

    this.graticule = new Graticule(this.earthGroup);

    this.initLocations();

    if (onProgress) onProgress("Building Render Pipeline");
    const { RenderPipeline } = await import("three/webgpu");
    if (this.isDisposed) return;
    this.renderPipeline = new RenderPipeline(this.renderer);

    const scenePass = pass(this.scene, this.camera);

    this.bloomSettings = {
      enabled: CONSTANTS.GUI.BLOOM.ENABLED,
      strength: CONSTANTS.GUI.BLOOM.STRENGTH,
      radius: CONSTANTS.GUI.BLOOM.RADIUS,
      threshold: CONSTANTS.GUI.BLOOM.THRESHOLD,
    };

    // bloom params: node, strength, radius, threshold
    const bloomPass = bloom(
      scenePass,
      this.bloomSettings.enabled ? this.bloomSettings.strength : 0.0,
      this.bloomSettings.radius,
      this.bloomSettings.threshold,
    );

    this.flarePosUniform = uniform(new THREE.Vector2(-99, -99));
    this.flareIntensityUniform = uniform(CONSTANTS.GUI.LENS_FLARE.INTENSITY); // Much lower default

    // uv ranges from -0.5 to 0.5
    const baseUv = screenCoordinate.div(screenSize).sub(vec2(0.5));
    const aspect = screenSize.x.div(screenSize.y);
    const flareUv = vec2(baseUv.x.mul(aspect), baseUv.y);

    this.anamorphicSettings = {
      enabled: CONSTANTS.GUI.ANAMORPHIC.ENABLED,
      intensity: CONSTANTS.GUI.ANAMORPHIC.INTENSITY,
      thickness: CONSTANTS.GUI.ANAMORPHIC.THICKNESS,
      size: CONSTANTS.GUI.ANAMORPHIC.SIZE,
      color: CONSTANTS.GUI.ANAMORPHIC.COLOR,
      innerFade: CONSTANTS.GUI.ANAMORPHIC.INNER_FADE,
      outerFade: CONSTANTS.GUI.ANAMORPHIC.OUTER_FADE,
    };
    this.anamorphicIntensityUniform = uniform(0.0);
    this.anamorphicSizeUniform = uniform(this.anamorphicSettings.size);
    this.anamorphicThicknessUniform = uniform(
      this.anamorphicSettings.thickness,
    );
    this.anamorphicColorUniform = uniform(
      new THREE.Color(this.anamorphicSettings.color),
    );

    const lF = lensflareShader({
      uv: flareUv,
      pos: this.flarePosUniform,
      iTime: time,
    } as any);
    const flareColorModified = this.sunColorUniform
      .mul(vec3(1.2, 1.2, 1.2))
      .mul(lF as any);
    const colorFlare = mul(
      ccShader({
        color: flareColorModified,
        factor: 0.5,
        factor2: 0.1,
      } as any) as any,
      this.flareIntensityUniform as any,
    );

    const aF = anamorphicShader({
      uv: flareUv,
      pos: this.flarePosUniform,
      size: this.anamorphicSizeUniform,
      thickness: this.anamorphicThicknessUniform,
    } as any);
    const colorAnamorphic = mul(
      this.anamorphicColorUniform.mul(aF as any),
      this.anamorphicIntensityUniform as any,
    );

    const cgSettings = {
      contrast: CONSTANTS.GUI.COLOR_GRADING.CONTRAST,
      saturation: CONSTANTS.GUI.COLOR_GRADING.SATURATION,
      blackLevel: CONSTANTS.GUI.COLOR_GRADING.BLACK_LEVEL,
      blueGreenBoost: CONSTANTS.GUI.COLOR_GRADING.BLUE_GREEN_BOOST,
    };
    const cgContrastUniform = uniform(cgSettings.contrast);
    const cgSaturationUniform = uniform(cgSettings.saturation);
    const cgBlackLevelUniform = uniform(cgSettings.blackLevel);
    const cgBlueGreenBoostUniform = uniform(cgSettings.blueGreenBoost);

    this.caSettings = {
      enabled: CONSTANTS.GUI.CHROMATIC_ABERRATION.ENABLED,
      strength: CONSTANTS.GUI.CHROMATIC_ABERRATION.STRENGTH,
      scale: CONSTANTS.GUI.CHROMATIC_ABERRATION.SCALE,
    };

    this.filmSettings = {
      enabled: CONSTANTS.GUI.FILM_GRAIN.ENABLED,
      intensity: CONSTANTS.GUI.FILM_GRAIN.INTENSITY,
    };

    this.vignetteSettings = {
      enabled: CONSTANTS.GUI.VIGNETTE.ENABLED,
      darkness: CONSTANTS.GUI.VIGNETTE.DARKNESS,
      offset: CONSTANTS.GUI.VIGNETTE.OFFSET,
    };

    // initial values based on enabled flag
    const caStrengthUniform = uniform(
      this.caSettings.enabled ? this.caSettings.strength : 0.0,
    );
    const caScaleUniform = uniform(this.caSettings.scale);
    const filmIntensityUniform = uniform(
      this.filmSettings.enabled ? this.filmSettings.intensity : 0.0,
    );

    const vignetteDarknessUniform = uniform(
      this.vignetteSettings.enabled ? this.vignetteSettings.darkness : 0.0,
    );
    const vignetteOffsetUniform = uniform(this.vignetteSettings.offset);

    const tmSettings = {
      mode: CONSTANTS.GUI.TONE_MAPPING.MODE,
      exposure: CONSTANTS.GUI.TONE_MAPPING.EXPOSURE,
      hdrPeakHighlights: CONSTANTS.GUI.TONE_MAPPING.HDR_PEAK_HIGHLIGHTS,
    };
    const tmExposureUniform = uniform(tmSettings.exposure);

    const rebuildPipeline = () => {
      // Single consolidated TSL pass starting from scene + bloom + lens flares
      const sceneWithFlares = scenePass
        .add(bloomPass)
        .add(colorFlare as any)
        .add(colorAnamorphic as any);

      const graded = colorGradeShader({
        color: sceneWithFlares,
        contrast: cgContrastUniform,
        saturation: cgSaturationUniform,
        blackLevel: cgBlackLevelUniform,
        blueGreenBoost: cgBlueGreenBoostUniform,
      } as any);

      let toneMapped: any;
      const modeNum = Number(tmSettings.mode);
      if (modeNum === 99) {
        toneMapped = gtUchimuraShader({
          color: graded,
          exposure: tmExposureUniform,
        } as any);
      } else if (modeNum === THREE.NoToneMapping) {
        toneMapped = graded;
      } else {
        toneMapped = graded.toneMapping(modeNum as THREE.ToneMapping, tmExposureUniform);
      }

      const vignetted = vignetteShader({
        color: toneMapped,
        uv: screenCoordinate.div(screenSize),
        darkness: vignetteDarknessUniform,
        offset: vignetteOffsetUniform,
      } as any);

      const ca = chromaticAberration(
        vignetted,
        caStrengthUniform,
        vec2(0.5, 0.5),
        caScaleUniform,
      );

      const filmed = film(ca, filmIntensityUniform);
      
      this.renderPipeline.outputNode = smaa(filmed);
      this.renderPipeline.needsUpdate = true;
      if (!this.isDisposed && this.renderer) {
        this.renderer.compileAsync(this.scene, this.camera);
      }
    };

    rebuildPipeline();

    this.flareSettings = {
      enabled: CONSTANTS.GUI.LENS_FLARE.ENABLED,
      intensity: CONSTANTS.GUI.LENS_FLARE.INTENSITY,
      enterDistance: CONSTANTS.GUI.LENS_FLARE.ENTER_DISTANCE ?? 0.0,
      leaveDistance: CONSTANTS.GUI.LENS_FLARE.LEAVE_DISTANCE ?? 0.0,
      fadeDuration: CONSTANTS.GUI.LENS_FLARE.FADE_DURATION ?? 0.0,
    };

    this.earthSettings = {
      trueInclination: CONSTANTS.GUI.EARTH.TRUE_INCLINATION || false,
      rotationSpeed: CONSTANTS.GUI.EARTH.ROTATION_SPEED || 0.0005,
    };

    this.renderSettings = {
      resolutionScale: CONSTANTS.GUI.DEBUG.RESOLUTION_SCALE || 1.0,
    };

    this.satelliteSettings = {
      enabled: CONSTANTS.GUI.SATELLITES.ENABLED,
      count: CONSTANTS.GUI.SATELLITES.COUNT,
      size: CONSTANTS.GUI.SATELLITES.SIZE,
      color: CONSTANTS.GUI.SATELLITES.COLOR,
      speedScale: CONSTANTS.GUI.SATELLITES.SPEED_SCALE,
    };

    this.initSatellites();

    this.backgroundStarsSettings = {
      enabled: CONSTANTS.GUI.BACKGROUND_STARS.ENABLED,
      count: CONSTANTS.GUI.BACKGROUND_STARS.COUNT,
      radius: CONSTANTS.GUI.BACKGROUND_STARS.RADIUS,
      seed: CONSTANTS.GUI.BACKGROUND_STARS.SEED,
      coolColor: CONSTANTS.GUI.BACKGROUND_STARS.COOL_COLOR,
      warmColor: CONSTANTS.GUI.BACKGROUND_STARS.WARM_COLOR,
    };

    this.backgroundStars = new BackgroundStars({
      count: this.backgroundStarsSettings.count,
      radius: this.backgroundStarsSettings.radius,
      seed: this.backgroundStarsSettings.seed,
      coolColor: this.backgroundStarsSettings.coolColor,
      warmColor: this.backgroundStarsSettings.warmColor,
    });
    this.backgroundStars.mesh.visible = this.backgroundStarsSettings.enabled;
    this.scene.add(this.backgroundStars.mesh);

    this.citiesSettings = {
      enabled: CONSTANTS.GUI.CITIES?.ENABLED !== undefined ? CONSTANTS.GUI.CITIES.ENABLED : false,
    };

    this.gui = new GUI({ title: "Engine Settings" });
    if (!CONSTANTS.GUI.SHOW) {
      this.gui.hide();
    }

    const debugSettings = { stats: CONSTANTS.GUI.DEBUG.STATS };
    this.stats.dom.style.display = debugSettings.stats ? "block" : "none";

    buildGui(this.gui, {
      tmSettings,
      tmExposureUniform,
      rebuildPipeline,
      cgSettings,
      cgUniforms: {
        contrast: cgContrastUniform,
        saturation: cgSaturationUniform,
        blackLevel: cgBlackLevelUniform,
        blueGreenBoost: cgBlueGreenBoostUniform,
      },
      moonSettings: this.moonSettings,
      moonMesh: this.moonMesh,
      flareSettings: this.flareSettings,
      anamorphicSettings: this.anamorphicSettings,
      bloomSettings: this.bloomSettings,
      bloomPass,
      caSettings: this.caSettings,
      caUniforms: {
        strength: caStrengthUniform,
        scale: caScaleUniform,
      },
      filmSettings: this.filmSettings,
      filmUniforms: {
        intensity: filmIntensityUniform,
      },
      vignetteSettings: this.vignetteSettings,
      vignetteUniforms: {
        darkness: vignetteDarknessUniform,
        offset: vignetteOffsetUniform,
      },
      earth,
      controls: this.controls,
      camera: this.camera,
      scene: this.scene,
      directionalLight: this.directionalLight,
      sunMaterial: this.sunMesh.material as THREE.MeshBasicMaterial,
      sunUserData: this.sunUserData,
      sunSettings: this.sunSettings,
      debugSettings,
      statsDom: this.stats.dom,
      earthSettings: this.earthSettings,
      renderSettings: this.renderSettings,
      onResize: this.handleResize,
      renderer: this.renderer,
      canvas: this.canvas,
      renderPipeline: this.renderPipeline,
      satelliteSettings: this.satelliteSettings,
      satellitePoints: this.satellitePoints,
      backgroundStarsSettings: this.backgroundStarsSettings,
      backgroundStars: this.backgroundStars,
      citiesSettings: this.citiesSettings,
      countryBorders: this.countryBorders,
      countryLabels: this.countryLabels,
      graticule: this.graticule,
    });

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    if (this.canvas.parentElement && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }

    if (onProgress) onProgress("Compiling Shaders (Warmup)");
    // Warmup render to compile shader pipelines asynchronously before returning from init
    if (this.renderer && !this.isDisposed) {
      await this.renderer.compileAsync(this.scene, this.camera);
    }

    if (!this.isDisposed) {
      this.start();
    }
  }

  private handleResize = () => {
    if (!this.renderer) return;
    const parent = this.canvas.parentElement;
    const width = Math.max(1, Math.floor(parent?.clientWidth || window.innerWidth || 800));
    const height = Math.max(1, Math.floor(parent?.clientHeight || window.innerHeight || 600));

    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    const scale = this.renderSettings
      ? this.renderSettings.resolutionScale
      : 1.0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * scale);
    this.renderer.setSize(width, height);

    if (this.backgroundStars && this.camera) {
      const pPU = height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
      this.backgroundStars.setPixelsPerUnit(pPU);
    }
  };

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    // Smooth camera transition to focused anchor
    if (this.focusTargetAnchorId) {
      const anchor = this.locationAnchors.get(this.focusTargetAnchorId);
      if (anchor) {
        anchor.getWorldPosition(this.tempVec3);
        this.tempDirToAnchor.copy(this.tempVec3).normalize();
        
        const currentDistance = this.camera.position.length();
        const targetDistance = Math.max(CONSTANTS.EARTH_RADIUS * 1.5, Math.min(currentDistance, CONSTANTS.EARTH_RADIUS * 2.5));
        
        this.tempTargetPos.copy(this.tempDirToAnchor).multiplyScalar(targetDistance);
        this.camera.position.lerp(this.tempTargetPos, 0.08);
        
        if (this.camera.position.distanceTo(this.tempTargetPos) < 0.05) {
          this.camera.position.copy(this.tempTargetPos);
          this.focusTargetAnchorId = null;
        }
      }
    }

    this.controls.update();

    // Update Sun Position
    if (this.sunSettings.autoRotate) {
      this.sunSettings.angle += 0.01 * this.sunSettings.speed;
      if (this.sunSettings.angle > Math.PI * 2)
        this.sunSettings.angle -= Math.PI * 2;
    }

    const sunDist = 200;
    const sa = this.sunSettings.angle;
    const si = this.sunSettings.inclination;

    this.directionalLight.position.set(
      Math.cos(sa) * sunDist,
      Math.sin(si) * sunDist,
      Math.sin(sa) * sunDist,
    );
    this.sunMesh.position.copy(this.directionalLight.position);
    this.sunMesh.rotation.y += 0.001;
    this.sunDirUniform.value.copy(this.directionalLight.position).normalize();

    // Rotate Earth
    this.root.rotation.y += this.earthSettings.rotationSpeed;
    this.root.rotation.z = this.earthSettings.trueInclination
      ? 23.44 * (Math.PI / 180)
      : 0;

    this.root.traverse((child) => {
      // Clouds rotate slightly faster
      if (child.name === "clouds") {
        child.rotation.y += this.earthSettings.rotationSpeed * 0.2;
      }
    });

    if (this.earthGroup && this.earthGroup.userData.cloudRotationY) {
      this.earthGroup.userData.cloudRotationY.value += this.earthSettings.rotationSpeed * 0.2;
    }

    // Occlusion & sub-layer visibility management for Earth inner cutaway layers
    if (this.earthGroup && this.earthGroup.userData.innerLayers && this.earthGroup.userData.cutawayProgress) {
      const p = this.earthGroup.userData.cutawayProgress.value;
      const inner = this.earthGroup.userData.innerLayers;
      if (inner.userData.updateSubLayerVisibilities) {
        inner.userData.updateSubLayerVisibilities(p);
      } else {
        inner.visible = p > 0.0001;
      }
    }

    // Toggle layer visibility to bypass rendering when disabled
    if (this.countryBorders && this.countryBorders.mesh) {
      this.countryBorders.mesh.visible = this.countryBorders.settings.enabled;
    }
    if (this.graticule && this.graticule.mesh) {
      this.graticule.mesh.visible = this.graticule.settings.enabled;
    }

    if (this.moonMesh) {
      this.moonMesh.visible = this.moonSettings.enabled;
      if (this.moonSettings.enabled) {
        this.moonSettings.angle += this.moonSettings.speed;
        updateMoon(this.moonMesh, this.sunMesh, this.camera, this.moonSettings);
        this.moonPosUniform.value.copy(this.moonMesh.position);
      }
    }

    // Update Satellites Positions if enabled
    if (this.satellitePoints) {
      this.satellitePoints.visible = this.satelliteSettings.enabled;
      if (this.satelliteSettings.enabled && this.satelliteData) {
        const count = this.satelliteSettings.count;
        const posAttr = this.satellitePoints.geometry.attributes.position as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;
        const { radii, inclinations, ascendingNodes, angularVelocities, phases } = this.satelliteData;
        const speedScale = this.satelliteSettings.speedScale;

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

    this.anamorphicSizeUniform.value = this.anamorphicSettings.size;
    this.anamorphicThicknessUniform.value = this.anamorphicSettings.thickness;
    this.anamorphicColorUniform.value.setHex(this.anamorphicSettings.color);

    // Update flare pos
    updateLensFlare(
      this.sunMesh,
      this.camera,
      this.flarePosUniform,
      this.flareIntensityUniform,
      this.flareSettings,
      this.moonMesh,
      this.moonSettings,
      this.anamorphicIntensityUniform,
      this.anamorphicSettings,
    );

    this.updateProjectedLocations();
    this.updateProjectedCountryLabels();

    if (this.renderer && this.renderPipeline) {
      this.renderPipeline.render();
    }

    if (this.stats) {
      this.stats.update();
    }
  };

  private initSatellites() {
    const count = this.satelliteSettings.count;
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
        const node = (p / shell.planes) * Math.PI * 2 + (Math.random() * 0.02);
        for (let s = 0; s < satsPerPlane; s++) {
          if (idx >= count) break;
          radii[idx] = shell.r;
          inclinations[idx] = shell.inc;
          ascendingNodes[idx] = node;
          angularVelocities[idx] = 0.003 * Math.pow(10.6 / shell.r, 1.5);
          phases[idx] = (s / satsPerPlane) * Math.PI * 2 + (Math.random() * 0.05);
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
    const geoCount = Math.floor(count * 0.10);
    const geoTarget = idx + geoCount;
    const geoRadius = 24.0;
    for (let i = 0; idx < geoTarget && idx < count; i++) {
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

    this.satelliteData = { radii, inclinations, ascendingNodes, angularVelocities, phases };

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

    this.satSizeUniform = uniform(this.satelliteSettings.size);
    this.satColorUniform = uniform(new THREE.Color(this.satelliteSettings.color));

    const material = new PointsNodeMaterial({
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    material.sizeNode = this.satSizeUniform;
    material.colorNode = this.satColorUniform;

    this.satellitePoints = new THREE.Points(geometry, material);
    this.satellitePoints.visible = this.satelliteSettings.enabled;
    this.satellitePoints.userData = {
      sizeUniform: this.satSizeUniform,
      colorUniform: this.satColorUniform,
    };
    this.root.add(this.satellitePoints);
  }

  public start() {
    this.animate();
  }

  private handleToggleCutaway = () => {
    this.toggleCutaway();
  };

  private handleSetCutaway = (e: CustomEvent<{ value: number }>) => {
    if (e && e.detail && typeof e.detail.value === 'number') {
      this.setCutawayProgress(e.detail.value);
    }
  };

  public toggleCutaway(): number {
    if (this.earthGroup && this.earthGroup.userData.cutawayProgress) {
      const current = this.earthGroup.userData.cutawayProgress.value;
      const target = current > 0.5 ? 0.0 : 1.0;
      this.earthGroup.userData.cutawayProgress.value = target;
      if (this.earthGroup.userData.innerLayers) {
        this.earthGroup.userData.innerLayers.visible = target > 0.0001;
      }
      if (this.gui) {
        this.gui.controllersRecursive().forEach((c) => c.updateDisplay());
      }
      window.dispatchEvent(new CustomEvent('cutaway-changed', { detail: { value: target } }));
      return target;
    }
    return 0;
  }

  public setCutawayProgress(value: number) {
    if (this.earthGroup && this.earthGroup.userData.cutawayProgress) {
      this.earthGroup.userData.cutawayProgress.value = value;
      if (this.earthGroup.userData.innerLayers) {
        this.earthGroup.userData.innerLayers.visible = value > 0.0001;
      }
      if (this.gui) {
        this.gui.controllersRecursive().forEach((c) => c.updateDisplay());
      }
      window.dispatchEvent(new CustomEvent('cutaway-changed', { detail: { value } }));
    }
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.animationId);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("toggle-cutaway", this.handleToggleCutaway);
    window.removeEventListener("set-cutaway", this.handleSetCutaway as any);
    if (this.gui) {
      this.gui.destroy();
    }
    if (this.stats && this.stats.dom && this.stats.dom.parentElement) {
      this.stats.dom.parentElement.removeChild(this.stats.dom);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.backgroundStars) {
      this.backgroundStars.dispose();
    }
    if (this.countryBorders) {
      this.countryBorders.dispose();
    }
    if (this.countryLabels) {
      this.countryLabels.dispose();
    }
    if (this.graticule) {
      this.graticule.dispose();
    }
  }

  private initLocations() {
    if (!this.earthGroup) return;
    const radius = CONSTANTS.EARTH_RADIUS + 0.1; // Slightly float above surface

    for (const loc of CINEMATIC_LOCATIONS) {
      const phi = (90 - loc.lat) * (Math.PI / 180);
      const theta = (loc.lng + 180) * (Math.PI / 180);

      const x = -radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(theta) * Math.sin(phi);

      const anchor = new THREE.Object3D();
      anchor.position.set(x, y, z);
      this.earthGroup.add(anchor);
      this.locationAnchors.set(loc.id, anchor);
    }
  }

  private updateProjectedLocations() {
    if (!this.onLocationsUpdate || this.locationAnchors.size === 0) return;

    if (this.citiesSettings && !this.citiesSettings.enabled) {
      this.onLocationsUpdate([]);
      return;
    }

    const projected: ProjectedLocation[] = [];

    const width = this.canvas.parentElement ? this.canvas.parentElement.clientWidth : window.innerWidth;
    const height = this.canvas.parentElement ? this.canvas.parentElement.clientHeight : window.innerHeight;

    this.tempDirToCamera.copy(this.camera.position).sub(this.tempEarthCenter).normalize();

    for (const [id, anchor] of this.locationAnchors.entries()) {
      anchor.getWorldPosition(this.tempVec3);

      // Distance check is useful to make sure they scale nicely
      const distanceToCamera = this.camera.position.distanceTo(this.tempVec3);

      // Check horizon visibility based on dot product of anchor direction and camera direction
      this.tempDirToAnchor.copy(this.tempVec3).sub(this.tempEarthCenter).normalize();
      const dot = this.tempDirToAnchor.dot(this.tempDirToCamera);

      // Dot product > 0.0 means front-facing. We transition opacity down as it reaches the limb.
      const visible = dot > -0.05;
      let opacity = 0.0;
      if (dot > 0.0) {
        opacity = Math.min(1.0, dot / 0.2); // Fades from dot=0.2 to dot=0
      }

      // Project 3D vector to 2D NDC
      this.tempVec3.project(this.camera);

      // Convert NDC to screen pixels
      const x = (this.tempVec3.x * 0.5 + 0.5) * width;
      const y = (this.tempVec3.y * -0.5 + 0.5) * height;

      // Find original location info
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

  private updateProjectedCountryLabels() {
    if (!this.onCountryLabelsUpdate || !this.countryLabels || !this.countryLabels.isLoaded) return;

    const width = this.canvas.parentElement ? this.canvas.parentElement.clientWidth : window.innerWidth;
    const height = this.canvas.parentElement ? this.canvas.parentElement.clientHeight : window.innerHeight;

    const projected = this.countryLabels.getProjectedLabels(this.camera, width, height);
    this.onCountryLabelsUpdate(projected);
  }

  public focusOnLocation(id: string) {
    this.focusTargetAnchorId = id;
  }
}
