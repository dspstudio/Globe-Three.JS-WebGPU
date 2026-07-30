import * as THREE from "three";
import {
  texture,
  uniform,
  vec3,
  float,
  mix,
  pow,
  clamp,
  dot,
  transformedNormalView,
  positionLocal,
  uv,
  Fn,
  time,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { CONSTANTS } from "../constants";

// Procedural 3D Simplex-like noise for solar granulation & surface plasma turbulence
const hashSun = Fn(([p]: [any]) => {
  const p1 = vec3(p.mul(0.3183099).add(0.1).fract()).mul(17.0);
  return p1.x.mul(p1.y).mul(p1.z).mul(p1.x.add(p1.y).add(p1.z)).fract();
});

const noiseSun = Fn(([x]: [any]) => {
  const i = x.floor();
  const f = vec3(x.fract());
  const f2 = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

  const h000 = hashSun(i.add(vec3(0, 0, 0)));
  const h100 = hashSun(i.add(vec3(1, 0, 0)));
  const h010 = hashSun(i.add(vec3(0, 1, 0)));
  const h110 = hashSun(i.add(vec3(1, 1, 0)));
  const h001 = hashSun(i.add(vec3(0, 0, 1)));
  const h101 = hashSun(i.add(vec3(1, 0, 1)));
  const h011 = hashSun(i.add(vec3(0, 1, 1)));
  const h111 = hashSun(i.add(vec3(1, 1, 1)));

  const m00 = mix(h000, h100, f2.x);
  const m10 = mix(h010, h110, f2.x);
  const m0 = mix(m00, m10, f2.y);

  const m01 = mix(h001, h101, f2.x);
  const m11 = mix(h011, h111, f2.x);
  const m1 = mix(m01, m11, f2.y);

  return mix(m0, m1, f2.z);
});

const fbmSun = Fn(([p]: [any]) => {
  const v = float(0.0).toVar();
  const a = float(0.5).toVar();
  const curP = vec3(p).toVar();

  v.addAssign(a.mul(noiseSun(curP)));
  curP.assign(curP.mul(2.02));
  a.assign(a.mul(0.5));

  v.addAssign(a.mul(noiseSun(curP)));

  return v;
});

export async function createSun(textureLoader: THREE.TextureLoader): Promise<{
  mesh: THREE.Mesh;
  material: MeshBasicNodeMaterial;
  userData: {
    useTexture: any;
    textureBlend: any;
    noiseStrength: any;
    glowIntensity: any;
    emissiveBoost: any;
    sunColor: any;
  };
}> {
  const sunTextureMap = await textureLoader.loadAsync(CONSTANTS.TEXTURES.SUN);
  sunTextureMap.colorSpace = THREE.SRGBColorSpace;
  sunTextureMap.minFilter = THREE.LinearMipmapLinearFilter;

  const sunGeometry = new THREE.SphereGeometry(6, 32, 32);

  // Uniforms
  const useTexture = uniform(CONSTANTS.GUI.SUN.USE_TEXTURE !== false ? 1.0 : 0.0);
  const textureBlend = uniform(CONSTANTS.GUI.SUN.TEXTURE_BLEND ?? 0.75);
  const noiseStrength = uniform(CONSTANTS.GUI.SUN.NOISE_STRENGTH ?? 0.35);
  const glowIntensity = uniform(CONSTANTS.GUI.SUN.GLOW_INTENSITY ?? 1.8);
  const emissiveBoost = uniform(CONSTANTS.GUI.SUN.EMISSIVE_BOOST ?? 2.0);
  const sunColor = uniform(new THREE.Color(CONSTANTS.GUI.SUN.COLOR));

  // Animated procedural solar surface plasma turbulence
  const animPos = positionLocal
    .mul(1.8)
    .add(vec3(time.mul(0.08), time.mul(0.05), time.mul(0.03)));
  const noiseVal = fbmSun(animPos);

  // Solar procedural color spectrum: deep orange core, gold plasma, white hot flares
  const deepSunColor = vec3(1.0, 0.35, 0.05);
  const brightSunColor = vec3(1.0, 0.85, 0.3);
  const flareSunColor = vec3(1.0, 1.0, 0.95);

  const proceduralSolarColor = mix(
    mix(deepSunColor, brightSunColor, noiseVal),
    flareSunColor,
    pow(noiseVal, float(2.5))
  );

  // 8K Sun texture sampling
  const texColor = texture(sunTextureMap, uv()).rgb;

  // Animated granulation modulation on top of texture
  const noiseModulation = float(1.0).add(
    noiseVal.sub(0.5).mul(noiseStrength)
  );
  const modulatedTex = texColor.mul(noiseModulation);

  // Effective blend factor (0 if useTexture disabled)
  const effectiveBlend = textureBlend.mul(useTexture);

  // Blend between procedural plasma shader and texture
  const baseSunColor = mix(proceduralSolarColor, modulatedTex, effectiveBlend);

  // Limb darkening (edges slightly warmer/darker)
  const viewDot = clamp(
    dot(transformedNormalView, vec3(0.0, 0.0, 1.0)),
    float(0.0),
    float(1.0)
  );
  const limbFactor = pow(viewDot, float(0.4));
  const darkenedSun = baseSunColor.mul(mix(float(0.75), float(1.15), limbFactor));

  // Coronal Fresnel Glow around limb
  const fresnelEdge = pow(float(1.0).sub(viewDot), float(3.0));
  const coronalGlowColor = vec3(1.0, 0.7, 0.3)
    .mul(fresnelEdge)
    .mul(glowIntensity);

  // Final solar output
  const finalSunNode = darkenedSun
    .add(coronalGlowColor)
    .mul(sunColor)
    .mul(emissiveBoost);

  const material = new MeshBasicNodeMaterial();
  material.colorNode = finalSunNode;

  const mesh = new THREE.Mesh(sunGeometry, material);

  return {
    mesh,
    material,
    userData: {
      useTexture,
      textureBlend,
      noiseStrength,
      glowIntensity,
      emissiveBoost,
      sunColor,
    },
  };
}
