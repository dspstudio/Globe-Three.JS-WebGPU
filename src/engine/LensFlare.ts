import * as THREE from "three";
import { CONSTANTS } from "../constants";
import { wgslFn, glslFn } from "three/tsl";

// 1D Noise
const noise1DWgsl = wgslFn(`
fn noise1D(t: f32) -> f32 {
	return fract(sin(t * 12.9898) * 43758.5453);
}`);

const noise1DGlsl = glslFn(`
float noise1D(float t) {
	return fract(sin(t * 12.9898) * 43758.5453);
}`);

// 2D Noise
const noise2DWgsl = wgslFn(`
fn noise2D(t: vec2<f32>) -> f32 {
	return fract(sin(dot(t, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}`);

const noise2DGlsl = glslFn(`
float noise2D(vec2 t) {
	return fract(sin(dot(t, vec2(12.9898, 78.233))) * 43758.5453);
}`);

// Lensflare
const lensflareWgsl = wgslFn(
  `
fn lensflare(uv: vec2<f32>, pos: vec2<f32>, iTime: f32) -> vec3<f32> {
	var main: vec2<f32> = uv - pos;
	var uvd: vec2<f32> = uv * length(uv);
	
	var ang: f32 = atan2(main.y, main.x);
	var dist: f32 = length(main);
    dist = pow(dist, 0.1);

    var t: vec2<f32> = vec2<f32>((ang - iTime / 9.0) * 16.0, dist * 32.0);
	var n: f32 = noise2D(t + vec2<f32>(iTime, iTime));
	
	var f0: f32 = 1.0 / (length(uv - pos) * 16.0 + 1.0);
	
    var n2: f32 = noise1D(abs(ang) + n / 2.0);
	f0 = f0 + f0 * (sin((ang + iTime / 18.0 + n2 * 2.0) * 12.0) * 0.1 + dist * 0.1 + 0.8);

	var f2: f32  = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.8  * pos), 2.0)), 0.0) * 0.25;
	var f22: f32 = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.85 * pos), 2.0)), 0.0) * 0.23;
	var f23: f32 = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.9  * pos), 2.0)), 0.0) * 0.21;
	
	var uvx: vec2<f32> = mix(uv, uvd, vec2<f32>(-0.5, -0.5));
	
	var f4: f32  = max(0.01 - pow(length(uvx + 0.4  * pos), 2.4), 0.0) * 6.0;
	var f42: f32 = max(0.01 - pow(length(uvx + 0.45 * pos), 2.4), 0.0) * 5.0;
	var f43: f32 = max(0.01 - pow(length(uvx + 0.5  * pos), 2.4), 0.0) * 3.0;
	
	uvx = mix(uv, uvd, vec2<f32>(-0.4, -0.4));
	
	var f5: f32  = max(0.01 - pow(length(uvx + 0.2 * pos), 5.5), 0.0) * 2.0;
	var f52: f32 = max(0.01 - pow(length(uvx + 0.4 * pos), 5.5), 0.0) * 2.0;
	var f53: f32 = max(0.01 - pow(length(uvx + 0.6 * pos), 5.5), 0.0) * 2.0;
	
	uvx = mix(uv, uvd, vec2<f32>(-0.5, -0.5));
	
	var f6: f32  = max(0.01 - pow(length(uvx - 0.3   * pos), 1.6), 0.0) * 6.0;
	var f62: f32 = max(0.01 - pow(length(uvx - 0.325 * pos), 1.6), 0.0) * 3.0;
	var f63: f32 = max(0.01 - pow(length(uvx - 0.35  * pos), 1.6), 0.0) * 5.0;
	
	var c: vec3<f32> = vec3<f32>(f0, f0, f0);
	
	c.r += f2 + f4 + f5 + f6;
    c.g += f22 + f42 + f52 + f62;
    c.b += f23 + f43 + f53 + f63;
	
	return c;
}
`,
  [noise1DWgsl, noise2DWgsl] as any,
);

const lensflareGlsl = glslFn(
  `
vec3 lensflare(vec2 uv, vec2 pos, float iTime) {
	vec2 main = uv - pos;
	vec2 uvd = uv * length(uv);
	
	float ang = atan(main.y, main.x);
	float dist = length(main);
    dist = pow(dist, 0.1);

    vec2 t = vec2((ang - iTime / 9.0) * 16.0, dist * 32.0);
	float n = noise2D(t + vec2(iTime, iTime));
	
	float f0 = 1.0 / (length(uv - pos) * 16.0 + 1.0);
	
    float n2 = noise1D(abs(ang) + n / 2.0);
	f0 = f0 + f0 * (sin((ang + iTime / 18.0 + n2 * 2.0) * 12.0) * 0.1 + dist * 0.1 + 0.8);

	float f2  = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.8  * pos), 2.0)), 0.0) * 0.25;
	float f22 = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.85 * pos), 2.0)), 0.0) * 0.23;
	float f23 = max(1.0 / (1.0 + 32.0 * pow(length(uvd + 0.9  * pos), 2.0)), 0.0) * 0.21;
	
	vec2 uvx = mix(uv, uvd, vec2(-0.5, -0.5));
	
	float f4  = max(0.01 - pow(length(uvx + 0.4  * pos), 2.4), 0.0) * 6.0;
	float f42 = max(0.01 - pow(length(uvx + 0.45 * pos), 2.4), 0.0) * 5.0;
	float f43 = max(0.01 - pow(length(uvx + 0.5  * pos), 2.4), 0.0) * 3.0;
	
	uvx = mix(uv, uvd, vec2(-0.4, -0.4));
	
	float f5  = max(0.01 - pow(length(uvx + 0.2 * pos), 5.5), 0.0) * 2.0;
	float f52 = max(0.01 - pow(length(uvx + 0.4 * pos), 5.5), 0.0) * 2.0;
	float f53 = max(0.01 - pow(length(uvx + 0.6 * pos), 5.5), 0.0) * 2.0;
	
	uvx = mix(uv, uvd, vec2(-0.5, -0.5));
	
	float f6  = max(0.01 - pow(length(uvx - 0.3   * pos), 1.6), 0.0) * 6.0;
	float f62 = max(0.01 - pow(length(uvx - 0.325 * pos), 1.6), 0.0) * 3.0;
	float f63 = max(0.01 - pow(length(uvx - 0.35  * pos), 1.6), 0.0) * 5.0;
	
	vec3 c = vec3(f0, f0, f0);
	
	c.r += f2 + f4 + f5 + f6;
    c.g += f22 + f42 + f52 + f62;
    c.b += f23 + f43 + f53 + f63;
	
	return c;
}
`,
  [noise1DGlsl, noise2DGlsl] as any,
);

export function lensflareShader(args: any) {
  if (CONSTANTS.RENDER_TYPE === 'webgpu') {
    return lensflareWgsl(args as any);
  } else {
    return lensflareGlsl(args as any);
  }
}

// CC
const ccWgsl = wgslFn(`
fn cc(color: vec3<f32>, factor: f32, factor2: f32) -> vec3<f32> {
	var w: f32 = color.x + color.y + color.z;
	return mix(color, vec3<f32>(w, w, w) * factor, vec3<f32>(w * factor2, w * factor2, w * factor2));
}
`);

const ccGlsl = glslFn(`
vec3 cc(vec3 color, float factor, float factor2) {
	float w = color.x + color.y + color.z;
	return mix(color, vec3(w, w, w) * factor, vec3(w * factor2, w * factor2, w * factor2));
}
`);

export function ccShader(args: any) {
  if (CONSTANTS.RENDER_TYPE === 'webgpu') {
    return ccWgsl(args as any);
  } else {
    return ccGlsl(args as any);
  }
}

// Anamorphic
const anamorphicWgsl = wgslFn(`
fn anamorphic(uv: vec2<f32>, pos: vec2<f32>, size: f32, thickness: f32) -> f32 {
    let d: vec2<f32> = uv - pos;
    let x: f32 = abs(d.x);
    let y: f32 = abs(d.y);
    
    let w: f32 = max(size, 0.01);
    let h: f32 = max(thickness, 0.001);
    
    let coreIntensity: f32 = (h * 0.002) / max(y, 0.00001);
    let coreFade: f32 = exp(- (x * x) / (w * w * 0.5));
    
    let glowIntensity: f32 = (h * 0.02) / max(y, 0.0001);
    let glowFade: f32 = exp(- (x * x) / (w * w * 2.0));
    
    let flare: f32 = coreIntensity * coreFade * 0.8 + glowIntensity * glowFade * 0.2;
    return flare;
}
`);

const anamorphicGlsl = glslFn(`
float anamorphic(vec2 uv, vec2 pos, float size, float thickness) {
    vec2 d = uv - pos;
    float x = abs(d.x);
    float y = abs(d.y);
    
    float w = max(size, 0.01);
    float h = max(thickness, 0.001);
    
    float coreIntensity = (h * 0.002) / max(y, 0.00001);
    float coreFade = exp(- (x * x) / (w * w * 0.5));
    
    float glowIntensity = (h * 0.02) / max(y, 0.0001);
    float glowFade = exp(- (x * x) / (w * w * 2.0));
    
    float flare = coreIntensity * coreFade * 0.8 + glowIntensity * glowFade * 0.2;
    return flare;
}
`);

export function anamorphicShader(args: any) {
  if (CONSTANTS.RENDER_TYPE === 'webgpu') {
    return anamorphicWgsl(args as any);
  } else {
    return anamorphicGlsl(args as any);
  }
}



let lastDistToCenter: number | null = null;
let lastIsEntering = true;
let currentOcclusion = 1.0;
let lastOcclusionTime = performance.now();

export function updateLensFlare(
  sunMesh: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  flarePosUniform: any,
  flareIntensityUniform: any,
  flareSettings: {
    enabled: boolean;
    intensity: number;
    enterDistance?: number;
    leaveDistance?: number;
    fadeDuration?: number;
  },
  moonMesh?: THREE.Object3D,
  moonSettings?: { enabled: boolean },
  anamorphicIntensityUniform?: any,
  anamorphicSettings?: {
    enabled: boolean;
    intensity: number;
    innerFade: number;
    outerFade: number;
  },
) {
  if (
    !sunMesh ||
    !flarePosUniform ||
    !camera ||
    !flareIntensityUniform ||
    !flareSettings
  )
    return;

  const sunDist = sunMesh.position.distanceTo(camera.position);
  const sunDir = sunMesh.position.clone().sub(camera.position).normalize();
  const centerToRay = camera.position.clone().negate();
  const projectionLength = centerToRay.dot(sunDir);

  let occlusion = 1.0;
  let anamorphicOcclusionFactor = 0.0;
  let flarePoint = sunMesh.position.clone();

  // If projectionLength > 0, the earth is in front of the camera towards the sun
  if (projectionLength > 0 && projectionLength < sunDist) {
    const closestPoint = camera.position
      .clone()
      .add(sunDir.clone().multiplyScalar(projectionLength));
    const distToCenter = closestPoint.length();

    // Track direction of movement relative to Earth center (entering vs leaving)
    let isEntering = lastIsEntering;
    if (lastDistToCenter !== null) {
      const diff = distToCenter - lastDistToCenter;
      if (Math.abs(diff) > 0.00001) {
        isEntering = diff < 0; // Distance decreasing = entering behind Earth
        lastIsEntering = isEntering;
      }
    }
    lastDistToCenter = distToCenter;

    const baseRadius = CONSTANTS.EARTH_RADIUS * 1.02; // slight padding for atmosphere
    const distOffset = isEntering
      ? (flareSettings.enterDistance ?? 0.0)
      : (flareSettings.leaveDistance ?? 0.0);

    const radius = Math.max(0.1, baseRadius + distOffset);
    const fadeRange = baseRadius * 0.05;

    if (distToCenter < radius) {
      // Fully occluded
      occlusion = 0.0;
    } else if (distToCenter < radius + fadeRange) {
      // Fade out
      occlusion = (distToCenter - radius) / fadeRange;
    }

    // If sun is behind Earth's disk, clamp the flare origin to Earth's outer limb
    if (distToCenter < baseRadius && distToCenter > 0.0001) {
      flarePoint = closestPoint.clone().normalize().multiplyScalar(baseRadius);
    }

    // Anamorphic appears when sun is grazing the edge (diamond ring effect)
    // Calculate the horizontal distance to the earth's edge at this altitude
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    const sunY = Math.abs(closestPoint.dot(camUp));
    const sunX = Math.abs(closestPoint.dot(camRight));

    if (sunY >= radius) {
      anamorphicOcclusionFactor = 0.0;
    } else {
      const edgeX = Math.sqrt(Math.max(0, radius * radius - sunY * sunY));
      const horizontalDistToEdge = sunX - edgeX; // Negative if inside the circle, positive if outside

      const isInside = horizontalDistToEdge < 0;

      // Because the edge gets flatter at the poles, we need less fade distance there to look correct
      // normalize it relative to the arc width
      const edgeRatio = edgeX / radius;
      const adaptiveFactor = Math.max(0.1, edgeRatio);

      if (isInside) {
        const innerDist = -horizontalDistToEdge;
        const innerRange = radius * (anamorphicSettings?.innerFade ?? 0.02) * adaptiveFactor;
        if (innerDist < innerRange) {
          const boost = 1.0 - innerDist / innerRange;
          anamorphicOcclusionFactor = Math.pow(boost, 2.0) * 1.5;
        } else {
          anamorphicOcclusionFactor = 0.0;
        }
      } else {
        const outerDist = horizontalDistToEdge;
        const outerRange = radius * (anamorphicSettings?.outerFade ?? 0.4) * adaptiveFactor;
        if (outerDist < outerRange) {
          const boost = 1.0 - outerDist / outerRange;
          anamorphicOcclusionFactor = Math.pow(boost, 2.0) * 1.5;
        } else {
          anamorphicOcclusionFactor = 0.0;
        }
      }
    }
  }

  // Moon occlusion
  if (moonMesh && moonSettings && moonSettings.enabled) {
    const moonCenterToRay = camera.position
      .clone()
      .sub(moonMesh.position)
      .negate();
    const moonProjectionLength = moonCenterToRay.dot(sunDir);
    const moonDist = moonMesh.position.distanceTo(camera.position);

    if (moonProjectionLength > 0 && moonProjectionLength < sunDist) {
      const moonClosestPoint = camera.position
        .clone()
        .add(sunDir.clone().multiplyScalar(moonProjectionLength));
      const distToMoonCenter = moonClosestPoint.distanceTo(moonMesh.position);
      const moonRadius = 2.73; // Visual radius of the sphere

      if (distToMoonCenter < moonRadius) {
        occlusion = 0.0;
      } else if (distToMoonCenter < moonRadius * 1.5) {
        occlusion = Math.min(
          occlusion,
          (distToMoonCenter - moonRadius) / (moonRadius * 0.5),
        );
      }

      // Peak at moon edge
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      
      const vMoon = moonClosestPoint.clone().sub(moonMesh.position);
      const moonSunY = Math.abs(vMoon.dot(camUp));
      const moonSunX = Math.abs(vMoon.dot(camRight));

      if (moonSunY < moonRadius) {
        const moonEdgeX = Math.sqrt(Math.max(0, moonRadius * moonRadius - moonSunY * moonSunY));
        const horizontalDistToMoonEdge = moonSunX - moonEdgeX;
        
        const isMoonInside = horizontalDistToMoonEdge < 0;
        
        const moonEdgeRatio = moonEdgeX / moonRadius;
        const adaptiveMoonFactor = Math.max(0.1, moonEdgeRatio);

        if (isMoonInside) {
          const innerDist = -horizontalDistToMoonEdge;
          const innerRange = moonRadius * (anamorphicSettings?.innerFade ?? 0.02) * adaptiveMoonFactor;
          if (innerDist < innerRange) {
            const boost = 1.0 - innerDist / innerRange;
            anamorphicOcclusionFactor = Math.max(
              anamorphicOcclusionFactor,
              Math.pow(boost, 2.0) * 1.5,
            );
          } else {
            anamorphicOcclusionFactor = Math.max(anamorphicOcclusionFactor, 0.0);
          }
        } else {
          const outerDist = horizontalDistToMoonEdge;
          const outerRange = moonRadius * ((anamorphicSettings?.outerFade ?? 0.4) * 1.25) * adaptiveMoonFactor;
          if (outerDist < outerRange) {
            const boost = 1.0 - outerDist / outerRange;
            anamorphicOcclusionFactor = Math.max(
              anamorphicOcclusionFactor,
              Math.pow(boost, 2.0) * 1.5,
            );
          }
        }
      }
    }
  }

  const p = flarePoint.project(camera);

  if (p.z > 1.0) {
    flarePosUniform.value.set(-999, -999);
  } else {
    flarePosUniform.value.set(p.x * 0.5 * camera.aspect, -p.y * 0.5);
  }

  const now = performance.now();
  const dt = Math.min((now - lastOcclusionTime) / 1000.0, 0.1);
  lastOcclusionTime = now;

  let targetOcclusion = occlusion;
  if (!flareSettings.enabled) {
    targetOcclusion = 0.0;
  }

  const fadeDuration = flareSettings.fadeDuration ?? 0.0;
  if (fadeDuration <= 0.001) {
    currentOcclusion = targetOcclusion;
  } else {
    const factor = 1.0 - Math.exp(-dt / Math.max(0.01, fadeDuration * 0.5));
    currentOcclusion += (targetOcclusion - currentOcclusion) * Math.min(1.0, factor);
  }

  flareIntensityUniform.value = flareSettings.intensity * currentOcclusion;

  if (anamorphicIntensityUniform && anamorphicSettings) {
    if (!anamorphicSettings.enabled) {
      anamorphicIntensityUniform.value = 0.0;
    } else {
      anamorphicIntensityUniform.value =
        anamorphicSettings.intensity * anamorphicOcclusionFactor;
    }
  }
}
