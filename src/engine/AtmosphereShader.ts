import * as THREE from "three";
import {
  normalize,
  positionWorld,
  cameraPosition,
  dot,
  uniform,
  pow,
  smoothstep,
  mix,
  Fn,
  Discard,
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { CONSTANTS } from "../constants";

export interface AtmosphereUniforms {
  rayleighColor: any;
  rayleighIntensity: any;
  mieColor: any;
  airglowColor: any;
  airglowSecondaryColor: any;
  atmosMode: any;
  atmosDensity: any;
  outerGlowPower: any;
  outerGlowIntensity: any;
}

export function createAtmosphereMeshes(
  sunDir: any,
  cutDiscard: any,
  groupUserData: Record<string, any>
): {
  highGroupMeshes: THREE.Mesh[];
  medGroupMeshes: THREE.Mesh[];
  lowGroupMeshes: THREE.Mesh[];
} {
  const atmosGeoHigh = new THREE.SphereGeometry(
    CONSTANTS.ATMOSPHERE_RADIUS,
    CONSTANTS.SEGMENTS,
    CONSTANTS.SEGMENTS
  );
  const atmosGeoMed = new THREE.SphereGeometry(
    CONSTANTS.ATMOSPHERE_RADIUS,
    Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)),
    Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2))
  );
  const atmosGeoLow = new THREE.SphereGeometry(
    CONSTANTS.ATMOSPHERE_RADIUS,
    Math.max(24, Math.floor(CONSTANTS.SEGMENTS / 4)),
    Math.max(24, Math.floor(CONSTANTS.SEGMENTS / 4))
  );

  const atmosMaterial = new MeshBasicNodeMaterial();
  atmosMaterial.transparent = true;
  atmosMaterial.side = THREE.BackSide;
  atmosMaterial.depthWrite = false;
  atmosMaterial.blending = THREE.AdditiveBlending;

  const dirToFrag = normalize(positionWorld.sub(cameraPosition));
  const worldNormal = normalize(positionWorld);
  const v = dot(dirToFrag, worldNormal).clamp(0.0, 1.0);

  const rayleighColorUniform = uniform(
    new THREE.Color(CONSTANTS.GUI.ATMOSPHERE.RAYLEIGH_COLOR)
  );
  const rayleighIntensityUniform = uniform(
    CONSTANTS.GUI.ATMOSPHERE.RAYLEIGH_INTENSITY
  );
  const mieColorUniform = uniform(
    new THREE.Color(CONSTANTS.GUI.ATMOSPHERE.MIE_COLOR)
  );
  const airglowColorUniform = uniform(
    new THREE.Color(CONSTANTS.GUI.ATMOSPHERE.AIRGLOW_COLOR)
  );
  const airglowSecondaryColorUniform = uniform(
    new THREE.Color(
      CONSTANTS.GUI.ATMOSPHERE.AIRGLOW_SECONDARY_COLOR || 0x3377ff
    )
  );
  const atmosModeUniform = uniform(
    CONSTANTS.GUI.ATMOSPHERE.MODE === "Scattering" ? 0.0 : 1.0
  );
  const atmosDensityUniform = uniform(CONSTANTS.GUI.ATMOSPHERE.DENSITY);
  const outerGlowPowerUniform = uniform(
    CONSTANTS.GUI.ATMOSPHERE.OUTER_GLOW_POWER || 2.5
  );
  const outerGlowIntensityUniform = uniform(
    CONSTANTS.GUI.ATMOSPHERE.OUTER_GLOW_INTENSITY || 1.0
  );

  groupUserData.rayleighColor = rayleighColorUniform;
  groupUserData.rayleighIntensity = rayleighIntensityUniform;
  groupUserData.mieColor = mieColorUniform;
  groupUserData.airglowColor = airglowColorUniform;
  groupUserData.airglowSecondaryColor = airglowSecondaryColorUniform;
  groupUserData.atmosMode = atmosModeUniform;
  groupUserData.atmosDensity = atmosDensityUniform;
  groupUserData.outerGlowPower = outerGlowPowerUniform;
  groupUserData.outerGlowIntensity = outerGlowIntensityUniform;

  const sunDotAtmos = dot(worldNormal, sunDir);
  const cosTheta = dot(dirToFrag, sunDir);

  const normalizedV = v.mul(5.0);
  const opticalDepth = pow(
    normalizedV.clamp(0.00001, 1.0),
    outerGlowPowerUniform
  ).mul(outerGlowIntensityUniform);

  const rayleighPhase = cosTheta
    .mul(cosTheta)
    .add(1.0)
    .mul(3.0 / (16.0 * Math.PI));
  const rayleighScattering = rayleighColorUniform
    .mul(rayleighPhase)
    .mul(atmosDensityUniform)
    .mul(rayleighIntensityUniform);

  const g = 0.76;
  const g2 = g * g;
  const miePhaseBase = cosTheta.mul(-2.0 * g).add(1.0 + g2);
  const miePhaseCoeff = (3.0 * (1.0 - g2)) / (8.0 * Math.PI * (2.0 + g2));
  const miePhase = cosTheta
    .mul(cosTheta)
    .add(1.0)
    .mul(miePhaseCoeff)
    .div(pow(miePhaseBase, 1.5));
  const mieScattering = mieColorUniform.mul(miePhase).mul(atmosDensityUniform);

  const intensityPhase = smoothstep(-0.2, 0.2, sunDotAtmos);
  const scatteredLight = rayleighScattering
    .add(mieScattering)
    .mul(intensityPhase);

  const greenBand = smoothstep(0.06, 0.02, v).mul(smoothstep(0.0, 0.04, v));
  const blueBand = smoothstep(0.15, 0.05, v).mul(smoothstep(0.03, 0.1, v));

  const airglowLight = airglowColorUniform
    .mul(greenBand)
    .mul(4.0)
    .add(airglowSecondaryColorUniform.mul(blueBand).mul(1.5))
    .mul(intensityPhase);

  const finalScattering = scatteredLight.mul(opticalDepth);
  const finalAirglow = airglowLight.add(finalScattering.mul(0.1));

  const atmosBaseColor = mix(finalScattering, finalAirglow, atmosModeUniform);
  atmosMaterial.colorNode = Fn(() => {
    Discard(cutDiscard);
    return atmosBaseColor;
  })() as any;

  const atmosHigh = new THREE.Mesh(atmosGeoHigh, atmosMaterial);
  const atmosMed = new THREE.Mesh(atmosGeoMed, atmosMaterial);
  const atmosLow = new THREE.Mesh(atmosGeoLow, atmosMaterial);

  // Inner Surface Glow
  const innerAtmosGeoHigh = new THREE.SphereGeometry(
    CONSTANTS.EARTH_RADIUS + 0.02,
    CONSTANTS.SEGMENTS,
    CONSTANTS.SEGMENTS
  );
  const innerAtmosGeoMed = new THREE.SphereGeometry(
    CONSTANTS.EARTH_RADIUS + 0.02,
    Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)),
    Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2))
  );
  const innerAtmosGeoLow = new THREE.SphereGeometry(
    CONSTANTS.EARTH_RADIUS + 0.02,
    Math.max(24, Math.floor(CONSTANTS.SEGMENTS / 4)),
    Math.max(24, Math.floor(CONSTANTS.SEGMENTS / 4))
  );
  const innerAtmosMaterial = new MeshBasicNodeMaterial();
  innerAtmosMaterial.transparent = true;
  innerAtmosMaterial.side = THREE.FrontSide;
  innerAtmosMaterial.depthWrite = false;
  innerAtmosMaterial.blending = THREE.AdditiveBlending;

  const viewDir = normalize(cameraPosition.sub(positionWorld));
  const innerDot = dot(viewDir, worldNormal).clamp(0.0, 1.0);
  const invDot = innerDot.oneMinus();
  const innerOpticalDepth = pow(invDot.clamp(0.0001, 1.0), 6.0).mul(1.5);

  const innerFinalScattering = scatteredLight.mul(innerOpticalDepth);
  const innerFinalAirglow = innerFinalScattering
    .mul(0.5)
    .add(
      airglowColorUniform
        .mul(innerOpticalDepth)
        .mul(0.5)
        .mul(intensityPhase)
    );

  const innerAtmosBaseColor = mix(
    innerFinalScattering,
    innerFinalAirglow,
    atmosModeUniform
  );
  innerAtmosMaterial.colorNode = Fn(() => {
    Discard(cutDiscard);
    return innerAtmosBaseColor;
  })() as any;

  const innerAtmosHigh = new THREE.Mesh(innerAtmosGeoHigh, innerAtmosMaterial);
  const innerAtmosMed = new THREE.Mesh(innerAtmosGeoMed, innerAtmosMaterial);
  const innerAtmosLow = new THREE.Mesh(innerAtmosGeoLow, innerAtmosMaterial);

  return {
    highGroupMeshes: [atmosHigh, innerAtmosHigh],
    medGroupMeshes: [atmosMed, innerAtmosMed],
    lowGroupMeshes: [atmosLow, innerAtmosLow],
  };
}
