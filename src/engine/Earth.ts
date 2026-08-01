import * as THREE from 'three';
import { texture, normalMap, mix, color, normalize, cross, cameraPosition, positionWorld, pow, dot, max, add, mul, vec3, vec2, smoothstep, uniform, equirectUV, positionLocal, modelWorldMatrixInverse, vec4, uv, distance, length, acos, asin, atan, sub, float, min, bumpMap, Discard, select, Fn, clamp, cos, sin, time, fract, floor, abs } from 'three/tsl';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { CONSTANTS } from '../constants';
import { createInnerLayers } from './InnerLayers';

// TSL Noise & FBM helpers for procedural ocean wave simulation
const hash2D = Fn(([p]: [any]) => {
    const pVec = vec2(p);
    const p1 = fract(pVec.mul(vec2(123.34, 456.21)));
    const d = dot(p1, p1.add(vec2(45.32)));
    const p2 = p1.add(vec2(d));
    return fract(p2.x.mul(p2.y));
});

const noise2D = Fn(([p]: [any]) => {
    const pVec = vec2(p);
    const i = floor(pVec);
    const f = fract(pVec);
    const a = hash2D(i);
    const b = hash2D(i.add(vec2(1.0, 0.0)));
    const c = hash2D(i.add(vec2(0.0, 1.0)));
    const d = hash2D(i.add(vec2(1.0, 1.0)));
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    const mixAB = mix(a, b, u.x);
    const mixCD = mix(c, d, u.x);
    return mix(mixAB, mixCD, u.y);
});

const fbm2D = Fn(([p]: [any]) => {
    const pVec = vec2(p);
    const n1 = noise2D(pVec).mul(0.65);
    const n2 = noise2D(pVec.mul(2.02)).mul(0.35);
    return n1.add(n2);
});

export async function createEarth(loader: THREE.TextureLoader, sunDirUniform: any, moonPosUniform: any, maxAnisotropy: number = 1): Promise<THREE.Group> {
    const group = new THREE.Group();
    
    // Cutaway uniform and discard node
    const cutawayProgressUniform = uniform(CONSTANTS.GUI.EARTH.CUTAWAY || 0.0);
    group.userData.cutawayProgress = cutawayProgressUniform;

    // Crust/Surface peels away first (0.0 -> 0.2 of cutaway slider)
    const pCrust = clamp(cutawayProgressUniform.div(0.2), float(0.0), float(1.0));
    const cutX = mix(float(15.0), float(0.0), pCrust);
    const cutDiscard = positionLocal.x.greaterThan(cutX);

    // Load textures
    const [colorMapTex, specularMapTex, normalMapTex, cloudsMapTex, nightMapTex, bumpMapTex, sstMapTex, ndviMapTex, bathymetryMapTex] = await Promise.all([
        loader.loadAsync(CONSTANTS.TEXTURES.ALBEDO),
        loader.loadAsync(CONSTANTS.TEXTURES.SPECULAR),
        loader.loadAsync(CONSTANTS.TEXTURES.NORMAL),
        loader.loadAsync(CONSTANTS.TEXTURES.CLOUDS),
        loader.loadAsync(CONSTANTS.TEXTURES.NIGHT),
        loader.loadAsync(CONSTANTS.TEXTURES.BUMP),
        loader.loadAsync(CONSTANTS.TEXTURES.SST_ANOMALIES).catch(() => null),
        loader.loadAsync(CONSTANTS.TEXTURES.MODIS_NDVI).catch(() => null),
        loader.loadAsync(CONSTANTS.TEXTURES.BATHYMETRY).catch(() => null)
    ]);

    colorMapTex.colorSpace = THREE.SRGBColorSpace;
    cloudsMapTex.colorSpace = THREE.SRGBColorSpace;
    nightMapTex.colorSpace = THREE.SRGBColorSpace;
    if (sstMapTex) {
        sstMapTex.colorSpace = THREE.SRGBColorSpace;
        sstMapTex.anisotropy = maxAnisotropy;
    }
    if (ndviMapTex) {
        ndviMapTex.colorSpace = THREE.SRGBColorSpace;
        ndviMapTex.anisotropy = maxAnisotropy;
    }
    if (bathymetryMapTex) {
        bathymetryMapTex.colorSpace = THREE.SRGBColorSpace;
        bathymetryMapTex.anisotropy = maxAnisotropy;
    }

    colorMapTex.anisotropy = maxAnisotropy;
    specularMapTex.anisotropy = maxAnisotropy;
    normalMapTex.anisotropy = maxAnisotropy;
    cloudsMapTex.anisotropy = maxAnisotropy;
    nightMapTex.anisotropy = maxAnisotropy;
    bumpMapTex.anisotropy = maxAnisotropy;

    // 1. Earth base
    const geoHigh = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS, CONSTANTS.SEGMENTS, CONSTANTS.SEGMENTS);
    const geoMed = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS, Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)), Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)));
    const geoLow = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS, Math.max(24, Math.floor(CONSTANTS.SEGMENTS / 4)), Math.max(24, Math.floor(CONSTANTS.SEGMENTS / 4)));
    const earthMaterial = new MeshPhysicalNodeMaterial();
    
    const sunDir = sunDirUniform;
    
    // Procedural shadow logic: 
    // Ray from surface fragment positionLocal along +sunDirLocal towards cloud sphere at radius Rc = Re + shadowDist
    const sunDirLocal = normalize(modelWorldMatrixInverse.mul(vec4(sunDir, 0.0)).xyz);
    
    const shadowDistUniform = uniform(CONSTANTS.GUI.CLOUD_SHADOWS.DISTANCE);
    const shadowIntensityUniform = uniform(CONSTANTS.GUI.CLOUD_SHADOWS.INTENSITY);
    const shadowColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.CLOUD_SHADOWS.COLOR)); // roughly 0.2, 0.25, 0.35
    const cloudRotationYUniform = uniform(0.0);

    group.userData.shadowDist = shadowDistUniform;
    group.userData.shadowIntensity = shadowIntensityUniform;
    group.userData.shadowColor = shadowColorUniform;
    group.userData.cloudRotationY = cloudRotationYUniform;

    // Ray-sphere intersection for cloud shadow projection
    const posL = positionLocal;
    const re = float(CONSTANTS.EARTH_RADIUS); // 10.0
    const rc = re.add(shadowDistUniform); // e.g. 10.08
    const deltaRc = rc.mul(rc).sub(re.mul(re)); // Rc^2 - Re^2
    const dotPS = dot(posL, sunDirLocal);
    
    // t = -dotPS + sqrt(dotPS^2 + deltaRc)
    const rayT = dotPS.negate().add(dotPS.mul(dotPS).add(deltaRc).max(0.0).sqrt());
    const shadowPosLocal = posL.add(sunDirLocal.mul(rayT));

    // Rotate shadowPosLocal around Y axis by -cloudRotationY to align with the cloud mesh's relative rotation
    const rotAngle = cloudRotationYUniform;
    const cosR = cos(rotAngle);
    const sinR = sin(rotAngle);
    const rotX = shadowPosLocal.x.mul(cosR).add(shadowPosLocal.z.mul(sinR));
    const rotZ = shadowPosLocal.x.mul(sinR).negate().add(shadowPosLocal.z.mul(cosR));
    const shadowPosRotated = vec3(rotX, shadowPosLocal.y, rotZ);

    // Map 3D unit direction on cloud sphere to exact SphereGeometry UVs
    const normP = normalize(shadowPosRotated);
    const angleU = atan(normP.z, normP.x.negate());
    const shadowU = angleU.div(Math.PI * 2.0).add(select(angleU.lessThan(0.0), 1.0, 0.0));
    const shadowV = asin(clamp(normP.y, -1.0, 1.0)).div(Math.PI).add(0.5);
    const shadowUv = vec2(shadowU, shadowV);

    const shadowOpacity = texture(cloudsMapTex, shadowUv).r;
    
    const waterRoughnessUniform = uniform(CONSTANTS.GUI.OCEAN.ROUGHNESS);
    const waterMetalnessUniform = uniform(CONSTANTS.GUI.OCEAN.METALNESS);
    const bathymetryIntensityUniform = uniform(CONSTANTS.GUI.OCEAN.BATHYMETRY_INTENSITY);
    const oceanShallowColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.OCEAN.SHALLOW_COLOR));
    const oceanDeepColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.OCEAN.DEEP_COLOR));
    const waterClarityUniform = uniform(CONSTANTS.GUI.OCEAN.WATER_CLARITY);
    const waterIorUniform = uniform(CONSTANTS.GUI.OCEAN.IOR);
    const fresnelStrengthUniform = uniform(CONSTANTS.GUI.OCEAN.FRESNEL_STRENGTH);
    const fresnelColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.OCEAN.FRESNEL_COLOR || 0x408ce6));
    const fresnelExponentUniform = uniform(CONSTANTS.GUI.OCEAN.FRESNEL_EXPONENT || 4.0);
    const sssColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.OCEAN.SSS_COLOR));
    const sssIntensityUniform = uniform(CONSTANTS.GUI.OCEAN.SSS_INTENSITY);
    const foamThresholdUniform = uniform(CONSTANTS.GUI.OCEAN.FOAM_THRESHOLD);
    const foamIntensityUniform = uniform(CONSTANTS.GUI.OCEAN.FOAM_INTENSITY);
    const coastalFadeDistanceUniform = uniform(CONSTANTS.GUI.OCEAN.COASTAL_FADE_DISTANCE);
    const wavesEnabledUniform = uniform(CONSTANTS.GUI.OCEAN.WAVES_ENABLED !== false ? 1.0 : 0.0);
    const waveHeightUniform = uniform(CONSTANTS.GUI.OCEAN.WAVE_HEIGHT || 0.05);
    const waveScaleUniform = uniform(CONSTANTS.GUI.OCEAN.WAVE_SCALE || 18.0);
    const waveSpeedUniform = uniform(CONSTANTS.GUI.OCEAN.WAVE_SPEED || 0.8);
    const sunGlintPowerUniform = uniform(CONSTANTS.GUI.OCEAN.SUN_GLINT_POWER ?? 1.5);
    const waveSparkleUniform = uniform(CONSTANTS.GUI.OCEAN.WAVE_SPARKLE || 0.4);

    group.userData.waterRoughness = waterRoughnessUniform;
    group.userData.waterMetalness = waterMetalnessUniform;
    group.userData.bathymetryIntensity = bathymetryIntensityUniform;
    group.userData.oceanShallowColor = oceanShallowColorUniform;
    group.userData.oceanDeepColor = oceanDeepColorUniform;
    group.userData.waterClarity = waterClarityUniform;
    group.userData.waterIor = waterIorUniform;
    group.userData.fresnelStrength = fresnelStrengthUniform;
    group.userData.fresnelColor = fresnelColorUniform;
    group.userData.fresnelExponent = fresnelExponentUniform;
    group.userData.sssColor = sssColorUniform;
    group.userData.sssIntensity = sssIntensityUniform;
    group.userData.foamThreshold = foamThresholdUniform;
    group.userData.foamIntensity = foamIntensityUniform;
    group.userData.coastalFadeDistance = coastalFadeDistanceUniform;
    group.userData.wavesEnabled = wavesEnabledUniform;
    group.userData.waveHeight = waveHeightUniform;
    group.userData.waveScale = waveScaleUniform;
    group.userData.waveSpeed = waveSpeedUniform;
    group.userData.sunGlintPower = sunGlintPowerUniform;
    group.userData.waveSparkle = waveSparkleUniform;
    
    // Calculate shadow dimmer mask
    const cloudShadow = mix(vec3(1.0), shadowColorUniform, shadowOpacity.mul(shadowIntensityUniform));
    
    // Light is at (10, 5, 10) in Engine.ts
    const sunDot = dot(normalize(positionWorld), sunDir);
    
    // Single unified fade from day to night across the terminator
    const nightFade = smoothstep(0.2, -0.2, sunDot);
    
    // Twilight terminator gradient (optional sunset tint)
    const twilightColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.ATMOSPHERE.TWILIGHT_COLOR));
    group.userData.twilightColor = twilightColorUniform;
    
    const darkSideBrightnessUniform = uniform(CONSTANTS.GUI.ENVIRONMENT.DARK_SIDE_BRIGHTNESS);
    group.userData.darkSideBrightness = darkSideBrightnessUniform;
    
    const cityLightsUniform = uniform(CONSTANTS.GUI.ENVIRONMENT.CITY_LIGHTS);
    group.userData.cityLights = cityLightsUniform;

    const twilight1 = smoothstep(0.0, 0.2, sunDot).oneMinus(); 
    const twilight2 = smoothstep(-0.2, 0.0, sunDot);           
    const twilightFactor = twilight1.mul(twilight2);
    
    // Only apply the twilight tint as a gentle additive glow or mix it softly
    const twilightTint = mix(vec3(1.0), twilightColorUniform, twilightFactor.mul(0.5));

    const spec = texture(specularMapTex).r;
    
    // Terrain Self-Shadowing (Occlusion from Sun using Normal Map)
    const terrainShadowIntensityUniform = uniform(CONSTANTS.GUI.EARTH.TERRAIN_SHADOW_INTENSITY);
    const terrainShadowOffsetUniform = uniform(CONSTANTS.GUI.EARTH.TERRAIN_SHADOW_OFFSET);
    group.userData.terrainShadowIntensity = terrainShadowIntensityUniform;
    group.userData.terrainShadowOffset = terrainShadowOffsetUniform;
    
    const surfaceNorm = normalize(positionLocal);
    // Rough tangent space from sphere
    const vTan = normalize(cross(vec3(0.0, 1.0, 0.0), surfaceNorm));
    const vBit = normalize(cross(surfaceNorm, vTan));
    
    // Current perturbed normal
    const nMap = texture(normalMapTex).xyz.mul(2.0).sub(1.0);
    const pNorm = normalize(vTan.mul(nMap.x).add(vBit.mul(nMap.y)).add(surfaceNorm.mul(nMap.z)));
    const terrainDot = max(0.0, dot(pNorm, sunDirLocal));
    
    // Offset UV towards the sun to read adjacent normal
    const sunProj = sunDirLocal.sub(surfaceNorm.mul(dot(sunDirLocal, surfaceNorm)));
    const sunT = normalize(sunProj.add(vec3(0.000001)));
    const offsetPos = normalize(positionLocal.add(sunT.mul(terrainShadowOffsetUniform)));
    const offsetUv = equirectUV(offsetPos);
    
    const offsetNMap = texture(normalMapTex, offsetUv).xyz.mul(2.0).sub(1.0);
    const pNormOffset = normalize(vTan.mul(offsetNMap.x).add(vBit.mul(offsetNMap.y)).add(surfaceNorm.mul(offsetNMap.z)));
    const offsetDot = max(0.0, dot(pNormOffset, sunDirLocal));
    
    // If the adjacent point towards the sun is facing the sun more than we are, it casts a shadow
    const occlusion = max(0.0, offsetDot.sub(terrainDot));
    const landMask = spec.oneMinus(); // Land has dark specular
    // Base shadow intensity multiplied by how much daylight we have
    const daylightMask = smoothstep(0.0, 0.2, dot(surfaceNorm, sunDirLocal));
    const selfShadowFactor = smoothstep(0.0, 0.3, occlusion).mul(landMask).mul(terrainShadowIntensityUniform).mul(daylightMask);
    
    // Apply a deep natural shadow color 
    const terrainShadowColor = mix(vec3(1.0), vec3(0.1, 0.15, 0.2), selfShadowFactor);
    
    // --- Real-time Moon Eclipse Shadow Calculation ---
    // Vector from current surface fragment to the moon
    const fragmentToMoon = sub(moonPosUniform, positionWorld);
    const distToMoon = length(fragmentToMoon);
    const dirFragmentToMoon = normalize(fragmentToMoon);
    
    // Angle between moon direction and sun direction
    // Clamp dot product to [-1.0, 1.0] to prevent acos(NaN)
    const thetaMoon = acos(max(float(-1.0), min(float(1.0), dot(dirFragmentToMoon, sunDir))));
    
    // Angular dimensions
    // For a realistic looking tight shadow (similar to real earth eclipses):
    const thetaM = float(0.024); 
    const sunAngularRadiusVal = float(0.02); 
    
    const penumbraOuter = thetaM.add(sunAngularRadiusVal);
    const umbraInner = max(float(0.0), thetaM.sub(sunAngularRadiusVal));
    
    // Smooth transition from full light (0) to deep umbra (1)
    const moonEclipseShadow = smoothstep(penumbraOuter, umbraInner, thetaMoon);
    const eclipseDimmer = mix(vec3(1.0), vec3(0.015, 0.02, 0.025), moonEclipseShadow);
    // --------------------------------------------------

    // --- Optical Ocean & Depth Gradient Shading ---
    const ndviEnhanceUniform = uniform(CONSTANTS.GUI.EARTH.NDVI_ENHANCE_STRENGTH || 0.3);
    group.userData.ndviEnhance = ndviEnhanceUniform;

    const baseDayTex = texture(colorMapTex);
    const ndviSample = ndviMapTex ? texture(ndviMapTex) : vec4(0.0);

    // Vegetation density from MODIS NDVI map (higher alpha/greenness on land = dense canopy)
    const vegFactor = ndviSample.a.mul(float(1.0).sub(spec));
    // Richer foliage tinting: boost lush green channel & contrast for vibrant vegetation
    const vegBoostColor = baseDayTex.mul(vec3(0.82, 1.25, 0.88));
    const landDayTex = mix(baseDayTex, vegBoostColor, vegFactor.mul(ndviEnhanceUniform));

    const bathymetrySample = bathymetryMapTex ? texture(bathymetryMapTex) : texture(bumpMapTex);
    
    // Depth factor from high-res GEBCO bathymetry map (gebco_08_rev_bath_5400x2700.png)
    const depthVal = bathymetrySample.r.add(bathymetrySample.g).add(bathymetrySample.b).div(3.0);
    const depthFactor = depthVal.mul(bathymetryIntensityUniform).clamp(0.0, 1.0);
    
    // Depth Gradient Color (Deep water vs Shallow water color)
    const oceanGradientColor = mix(oceanDeepColorUniform, oceanShallowColorUniform, depthFactor);
    
    // Water Clarity / Absorption: blend between pure depth gradient colors and underlying day satellite texture
    const oceanColor = mix(oceanGradientColor, landDayTex, waterClarityUniform);
    
    // Apply custom ocean colors only to ocean areas (where specular mask spec > 0)
    const oceanSurfaceTex = mix(landDayTex, oceanColor, spec);

    // --- Procedural Animated Wave Heights & Normal Perturbation ---
    // Triplanar FBM sampling avoids polar UV singularities
    const waveTime = time.mul(waveSpeedUniform);

    const getWaveHeightAt = Fn(([pPos]: [any]) => {
        const pNorm = normalize(vec3(pPos));
        const absN = abs(pNorm);
        const w = absN.div(absN.x.add(absN.y).add(absN.z).add(0.0001));

        const driftA = vec2(waveTime.mul(0.05), waveTime.mul(0.03));
        const driftB = vec2(waveTime.mul(-0.08), waveTime.mul(0.02));

        const uvX = vec2(pNorm.y, pNorm.z).mul(waveScaleUniform);
        const uvY = vec2(pNorm.x, pNorm.z).mul(waveScaleUniform);
        const uvZ = vec2(pNorm.x, pNorm.y).mul(waveScaleUniform);

        const wx = fbm2D(uvX.add(driftA)).mul(0.6).add(fbm2D(uvX.mul(2.02).add(driftB)).mul(0.4));
        const wy = fbm2D(uvY.add(driftA)).mul(0.6).add(fbm2D(uvY.mul(2.02).add(driftB)).mul(0.4));
        const wz = fbm2D(uvZ.add(driftA)).mul(0.6).add(fbm2D(uvZ.mul(2.02).add(driftB)).mul(0.4));

        return wx.mul(w.x).add(wy.mul(w.y)).add(wz.mul(w.z));
    });

    const computeWaveData = Fn(() => {
        const hWave0 = getWaveHeightAt(positionLocal);

        // Wave gradient finite differences
        const waveEps = float(0.015);
        const pLocNorm = normalize(positionLocal);
        const vTanL = normalize(cross(vec3(0.0, 1.0, 0.0), pLocNorm));
        const vBitL = normalize(cross(pLocNorm, vTanL));

        const pTanL = normalize(positionLocal.add(vTanL.mul(waveEps)));
        const pBitL = normalize(positionLocal.add(vBitL.mul(waveEps)));

        const hWaveTan = getWaveHeightAt(pTanL);
        const hWaveBit = getWaveHeightAt(pBitL);

        const dWaveTan = hWaveTan.sub(hWave0).div(waveEps);
        const dWaveBit = hWaveBit.sub(hWave0).div(waveEps);

        const waveGradLocal = vTanL.mul(dWaveTan).add(vBitL.mul(dWaveBit)).mul(waveHeightUniform);
        const normWorld = normalize(positionWorld);
        const waveNormWorld = normalize(normWorld.sub(waveGradLocal));
        return vec4(waveNormWorld, hWave0);
    });

    const normWorld = normalize(positionWorld);
    const waveData = wavesEnabledUniform.greaterThan(0.0).select(
        computeWaveData(),
        vec4(normWorld, float(0.0))
    );
    const waveNormWorld = waveData.xyz;
    const hWave0 = waveData.w;

    // Smoothly blend wave normal for ocean regions
    const oceanNormWorld = mix(normWorld, waveNormWorld, spec);

    // Fresnel reflection & View direction calculations
    const viewDirWorld = normalize(cameraPosition.sub(positionWorld));
    const cosViewWave = max(float(0.0), dot(oceanNormWorld, viewDirWorld));
    const fresnelVal = pow(float(1.0).sub(cosViewWave), fresnelExponentUniform).mul(fresnelStrengthUniform).mul(spec);
    const fresnelGlow = fresnelColorUniform.mul(fresnelVal);

    // Subsurface Scattering (sunlight scattering through ocean depth)
    const sunLight = max(float(0.0), dot(oceanNormWorld, sunDir));
    const forwardScatter = pow(max(float(0.0), dot(viewDirWorld, sunDir.negate())), float(3.0)).add(0.2);
    const sssGlow = sssColorUniform.mul(sssIntensityUniform).mul(sunLight).mul(forwardScatter).mul(depthFactor).mul(spec);

    // Specular Sun Glint & Wave Micro-Facet Sparkles
    const halfDirWorld = normalize(sunDir.add(viewDirWorld));
    const NdotH = max(float(0.0), dot(oceanNormWorld, halfDirWorld));
    
    // Direct physical specular sun reflection (sharp glint) independent of sparkle noise
    const sunGlint = pow(NdotH, float(120.0)).mul(sunGlintPowerUniform).mul(spec);
    // Broader wave micro-facet sparkle
    const waveSparkle = pow(NdotH, float(20.0)).mul(0.4).mul(spec).mul(waveSparkleUniform);
    const waveSparkleGlow = vec3(1.0, 0.95, 0.85).mul(sunGlint).add(vec3(0.5, 0.75, 1.0).mul(waveSparkle)).mul(sunLight).mul(wavesEnabledUniform);

    // Wave Crest Foam (foam along wave peaks on open ocean)
    const waveCrestFoam = smoothstep(0.62, 0.82, hWave0).mul(foamIntensityUniform).mul(spec).mul(0.6).mul(wavesEnabledUniform);
    const oceanSurfaceWithWaves = mix(oceanSurfaceTex, vec3(0.92, 0.96, 1.0), waveCrestFoam);

    // Coastal Shelf Foam (originates at continent shoreline and fades outward into ocean)
    const foamMin = foamThresholdUniform.sub(coastalFadeDistanceUniform).clamp(0.0, 1.0);
    const coastalFoamMask = smoothstep(foamMin, foamThresholdUniform, depthFactor).mul(pow(spec, float(2.0))).mul(0.5);
    const finalSurfaceTex = mix(oceanSurfaceWithWaves, vec3(0.90, 0.94, 0.98), coastalFoamMask.mul(foamIntensityUniform));

    // SST / GIBS Data Overlay
    const gibsEnabledUniform = uniform(CONSTANTS.GUI.EARTH.GIBS_ENABLED ? 1.0 : 0.0);
    const gibsOpacityUniform = uniform(CONSTANTS.GUI.EARTH.GIBS_OPACITY || 0.8);
    const gibsLayerUniform = uniform(CONSTANTS.GUI.EARTH.GIBS_LAYER === "MODIS Terra NDVI 8-Day" ? 1.0 : 0.0);
    group.userData.gibsEnabled = gibsEnabledUniform;
    group.userData.gibsOpacity = gibsOpacityUniform;
    group.userData.gibsLayer = gibsLayerUniform;

    const sstSample = sstMapTex ? texture(sstMapTex) : vec4(0.0);
    const gibsSample = mix(sstSample, ndviSample, gibsLayerUniform);
    const gibsFactor = gibsEnabledUniform.mul(gibsOpacityUniform).mul(gibsSample.a);

    const displacementScaleUniform = uniform(CONSTANTS.GUI.EARTH.DISPLACEMENT_SCALE || 0.02);
    const landRoughnessUniform = uniform(CONSTANTS.GUI.EARTH.LAND_ROUGHNESS || 0.8);
    group.userData.displacementScale = displacementScaleUniform;
    group.userData.landRoughness = landRoughnessUniform;

    // Apply vertex displacement map from bump_map texture
    const bumpVal = texture(bumpMapTex).r;
    earthMaterial.positionNode = positionLocal.add(normalize(positionLocal).mul(bumpVal.mul(displacementScaleUniform)));

    const rawLitEarthColor = finalSurfaceTex.add(fresnelGlow).add(sssGlow).add(waveSparkleGlow).mul(cloudShadow).mul(twilightTint).mul(terrainShadowColor).mul(eclipseDimmer);
    const earthBaseColor = mix(rawLitEarthColor, vec3(0.0), gibsFactor);

    earthMaterial.colorNode = Fn(() => {
        Discard(cutDiscard);
        return earthBaseColor;
    })() as any;
    
    // Specular map for water reflections: white spec = water, black spec = land
    // Land roughness is modulated by bump_map elevation and NDVI vegetation density
    const landRoughnessMap = mix(landRoughnessUniform.mul(0.6), landRoughnessUniform, bumpVal).add(vegFactor.mul(ndviEnhanceUniform).mul(0.15)).clamp(0.0, 1.0);
    const baseRoughness = mix(landRoughnessMap, waterRoughnessUniform, spec);
    const baseMetalness = mix(0.0, waterMetalnessUniform, spec);
    
    // Completely kill the specular highlight of the directional sun light in the umbra
    earthMaterial.roughnessNode = mix(baseRoughness, float(1.0), moonEclipseShadow);
    earthMaterial.metalnessNode = mix(baseMetalness, float(0.0), moonEclipseShadow);
    earthMaterial.specularColorNode = mix(vec3(1.0), vec3(0.0), moonEclipseShadow);
    earthMaterial.specularIntensityNode = mix(float(1.0), fresnelStrengthUniform, spec).mul(float(1.0).sub(moonEclipseShadow));
    earthMaterial.iorNode = mix(float(1.5), waterIorUniform, spec).mul(float(1.0).sub(moonEclipseShadow));
    
    const bumpScaleUniform = uniform(vec2(CONSTANTS.GUI.EARTH.BUMP_SCALE, CONSTANTS.GUI.EARTH.BUMP_SCALE));
    group.userData.bumpScale = bumpScaleUniform;
    
    // Dynamic bump intensity fades as surface enters shadow
    const bumpFade = smoothstep(-0.15, 0.15, sunDot);
    earthMaterial.normalNode = normalMap(texture(normalMapTex), bumpScaleUniform.mul(bumpFade));

    // The night map is RGB, we multiply by the fade factor and an intensity boost
    // Multiplier dictates how deeply the lights bloom
    const nightLights = texture(nightMapTex).mul(nightFade).mul(cityLightsUniform);
    const darkSideAmbient = texture(colorMapTex).mul(nightFade).mul(darkSideBrightnessUniform).mul(0.5);
    const baseEmissive = nightLights.add(darkSideAmbient).mul(float(1.0).sub(gibsFactor));
    const gibsEmissive = gibsSample.rgb.mul(gibsFactor);
    earthMaterial.emissiveNode = baseEmissive.add(gibsEmissive) as any;
    
    const earthHigh = new THREE.Mesh(geoHigh, earthMaterial);
    const earthMed = new THREE.Mesh(geoMed, earthMaterial);
    const earthLow = new THREE.Mesh(geoLow, earthMaterial);

    // 2. Clouds
    const cloudsGeoHigh = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS + 0.05, CONSTANTS.SEGMENTS, CONSTANTS.SEGMENTS);
    const cloudsGeoMed = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS + 0.05, Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)), Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)));
    const cloudsGeoLow = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS + 0.05, Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)), Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)));
    const cloudsMaterial = new MeshPhysicalNodeMaterial();
    
    const finalCloudOpacity = texture(cloudsMapTex).r;
    
    // Add subtle moon/starlight scattering on the dark side
    // And base baseDarkSideScatter on nightFade to match earth
    const baseDarkSideScatter = mix(vec3(0.005, 0.007, 0.01), vec3(0.05, 0.06, 0.08), nightFade);
    const darkSideScatter = baseDarkSideScatter.mul(darkSideBrightnessUniform).mul(20.0);
    
    const cosCloudR = cos(cloudRotationYUniform);
    const sinCloudR = sin(cloudRotationYUniform);
    const cloudEarthLocalX = positionLocal.x.mul(cosCloudR).add(positionLocal.z.mul(sinCloudR));
    const cloudCutDiscard = cloudEarthLocalX.greaterThan(cutX);

    const cloudColorBase = vec3(1.0).mul(twilightTint).mul(eclipseDimmer);
    cloudsMaterial.colorNode = Fn(() => {
        Discard(cloudCutDiscard);
        return cloudColorBase;
    })() as any;
    cloudsMaterial.emissiveNode = darkSideScatter as any;
    cloudsMaterial.roughnessNode = mix(float(0.9), float(1.0), moonEclipseShadow);
    cloudsMaterial.specularColorNode = mix(vec3(1.0), vec3(0.0), moonEclipseShadow);
    cloudsMaterial.specularIntensityNode = mix(float(1.0), float(0.0), moonEclipseShadow);
    cloudsMaterial.iorNode = mix(float(1.5), float(1.0), moonEclipseShadow);
    
    // Procedural Cloud Normals from cloud height map - dynamically faded
    cloudsMaterial.normalNode = bumpMap(texture(cloudsMapTex), float(0.02).mul(bumpFade));
    
    cloudsMaterial.transparent = true;
    cloudsMaterial.opacityNode = finalCloudOpacity;
    cloudsMaterial.depthWrite = false;
    
    const cloudsHigh = new THREE.Mesh(cloudsGeoHigh, cloudsMaterial);
    cloudsHigh.name = 'clouds';

    const cloudsMed = new THREE.Mesh(cloudsGeoMed, cloudsMaterial);
    cloudsMed.name = 'clouds';

    const cloudsLow = new THREE.Mesh(cloudsGeoLow, cloudsMaterial);
    cloudsLow.name = 'clouds';

    // 3. Atmosphere (Outer Halo)
    // Renders behind the earth and extends outward to create a volumetric halo 
    const atmosGeoHigh = new THREE.SphereGeometry(CONSTANTS.ATMOSPHERE_RADIUS, CONSTANTS.SEGMENTS, CONSTANTS.SEGMENTS);
    const atmosGeoMed = new THREE.SphereGeometry(CONSTANTS.ATMOSPHERE_RADIUS, Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)), Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)));
    const atmosGeoLow = new THREE.SphereGeometry(CONSTANTS.ATMOSPHERE_RADIUS, Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)), Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)));
    const atmosMaterial = new MeshBasicNodeMaterial();
    atmosMaterial.transparent = true;
    atmosMaterial.side = THREE.BackSide;
    atmosMaterial.depthWrite = false;
    atmosMaterial.blending = THREE.AdditiveBlending;

    // Vector math using TSL for WebGPU Fresnel
    const dirToFrag = normalize(positionWorld.sub(cameraPosition));
    const worldNormal = normalize(positionWorld);
    
    // v is 0 at the exact rim of the atmosphere sphere (R=10.2)
    // and increases as we move inwards. Because the earth (R=10) blocks the rest,
    // the maximum visible v is roughly sqrt(1 - (10/10.2)^2) ≈ 0.197
    const v = dot(dirToFrag, worldNormal).clamp(0.0, 1.0);
    
    // Scale v so that it reaches near 1.0 at the point where the earth occludes it.
    // That way the halo is bright right next to the earth, and softly fades to 0 at the outer edge.
    const normalizedV = v.mul(5.0);
    const opticalDepth = pow(normalizedV.clamp(0.00001, 1.0), 2.5);
    
    // Sun lighting calculations for atmospheric scattering
    const sunDotAtmos = dot(worldNormal, sunDir);
    const cosTheta = dot(dirToFrag, sunDir);
    
    // Configurable parameters via UserData
    const rayleighColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.ATMOSPHERE.RAYLEIGH_COLOR));
    const rayleighIntensityUniform = uniform(CONSTANTS.GUI.ATMOSPHERE.RAYLEIGH_INTENSITY);
    const mieColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.ATMOSPHERE.MIE_COLOR));
    const airglowColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.ATMOSPHERE.AIRGLOW_COLOR));
    const atmosModeUniform = uniform(CONSTANTS.GUI.ATMOSPHERE.MODE === 'Scattering' ? 0.0 : 1.0);
    const atmosDensityUniform = uniform(CONSTANTS.GUI.ATMOSPHERE.DENSITY);
    
    group.userData.rayleighColor = rayleighColorUniform;
    group.userData.rayleighIntensity = rayleighIntensityUniform;
    group.userData.mieColor = mieColorUniform;
    group.userData.airglowColor = airglowColorUniform;
    group.userData.atmosMode = atmosModeUniform;
    group.userData.atmosDensity = atmosDensityUniform;

    // --- RAYLEIGH SCATTERING ---
    // Phase Function: 3 / (16 * PI) * (1 + cosTheta^2)
    const rayleighPhase = cosTheta.mul(cosTheta).add(1.0).mul(3.0 / (16.0 * Math.PI));
    const rayleighScattering = rayleighColorUniform.mul(rayleighPhase).mul(atmosDensityUniform).mul(rayleighIntensityUniform);

    // --- MIE SCATTERING ---
    // Phase Function (Henyey-Greenstein)
    const g = 0.76;
    const g2 = g * g;
    const miePhaseBase = cosTheta.mul(-2.0 * g).add(1.0 + g2);
    // (3 * (1 - g^2) / (8 * PI * (2 + g^2))) * (1 + cosTheta^2) / (1 + g^2 - 2g*cosTheta)^1.5
    const miePhaseCoeff = (3.0 * (1.0 - g2)) / (8.0 * Math.PI * (2.0 + g2));
    const miePhase = cosTheta.mul(cosTheta).add(1.0).mul(miePhaseCoeff).div(pow(miePhaseBase, 1.5));
    const mieScattering = mieColorUniform.mul(miePhase).mul(atmosDensityUniform);

    // Overall intensity fade on the dark side of the earth
    const intensityPhase = smoothstep(-0.2, 0.2, sunDotAtmos);

    const scatteredLight = rayleighScattering.add(mieScattering).mul(intensityPhase);

    // --- AIRGLOW ---
    // v goes from 0 at R=10.2 to ~0.197 at R=10
    // Narrow green band at top (low v):
    const greenBand = smoothstep(0.06, 0.02, v).mul(smoothstep(0.0, 0.04, v));
    // Faint blue band lower down (higher v):
    const blueBand = smoothstep(0.15, 0.05, v).mul(smoothstep(0.03, 0.1, v));
    
    const airglowLight = airglowColorUniform.mul(greenBand).mul(4.0)
        .add(vec3(0.2, 0.3, 0.6).mul(blueBand).mul(1.5))
        .mul(intensityPhase);
        
    const finalScattering = scatteredLight.mul(opticalDepth);
    const finalAirglow = airglowLight.add(finalScattering.mul(0.1));

    // Outer atmosphere adds scattered light
    const atmosBaseColor = mix(finalScattering, finalAirglow, atmosModeUniform);
    atmosMaterial.colorNode = Fn(() => {
        Discard(cutDiscard);
        return atmosBaseColor;
    })() as any;
    
    const atmosHigh = new THREE.Mesh(atmosGeoHigh, atmosMaterial);
    const atmosMed = new THREE.Mesh(atmosGeoMed, atmosMaterial);
    const atmosLow = new THREE.Mesh(atmosGeoLow, atmosMaterial);

    // 4. Atmosphere (Inner surface glow on Earth)
    // A thin localized front-faced glow that sits right on the earth's surface
    // to blend the silhouette into the outer halo.
    const innerAtmosGeoHigh = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS + 0.02, CONSTANTS.SEGMENTS, CONSTANTS.SEGMENTS);
    const innerAtmosGeoMed = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS + 0.02, Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)), Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)));
    const innerAtmosGeoLow = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS + 0.02, Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)), Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)));
    const innerAtmosMaterial = new MeshBasicNodeMaterial();
    innerAtmosMaterial.transparent = true;
    innerAtmosMaterial.side = THREE.FrontSide;
    innerAtmosMaterial.depthWrite = false;
    innerAtmosMaterial.blending = THREE.AdditiveBlending;

    const viewDir = normalize(cameraPosition.sub(positionWorld));
    const invDot = dot(viewDir, worldNormal).clamp(0.0, 1.0).oneMinus(); 
    
    // Concentrate at the rim of the earth
    const innerOpticalDepth = pow(invDot.clamp(0.0001, 1.0), 6.0).mul(1.5);
    
    // For the inner glow, mix standard scattering with a tint of the airglow color
    const innerFinalScattering = scatteredLight.mul(innerOpticalDepth);
    const innerFinalAirglow = innerFinalScattering.mul(0.5).add(airglowColorUniform.mul(innerOpticalDepth).mul(0.5).mul(intensityPhase));
    
    const innerAtmosBaseColor = mix(innerFinalScattering, innerFinalAirglow, atmosModeUniform);
    innerAtmosMaterial.colorNode = Fn(() => {
        Discard(cutDiscard);
        return innerAtmosBaseColor;
    })() as any;

    
    const innerAtmosHigh = new THREE.Mesh(innerAtmosGeoHigh, innerAtmosMaterial);
    const innerAtmosMed = new THREE.Mesh(innerAtmosGeoMed, innerAtmosMaterial);
    const innerAtmosLow = new THREE.Mesh(innerAtmosGeoLow, innerAtmosMaterial);

    const highGroup = new THREE.Group();
    highGroup.add(earthHigh, cloudsHigh, atmosHigh, innerAtmosHigh);

    const medGroup = new THREE.Group();
    medGroup.add(earthMed, cloudsMed, atmosMed, innerAtmosMed);

    const lowGroup = new THREE.Group();
    lowGroup.add(earthLow, cloudsLow, atmosLow, innerAtmosLow);

    const lod = new THREE.LOD();
    lod.addLevel(highGroup, 0);
    lod.addLevel(medGroup, 25);
    lod.addLevel(lowGroup, 55);

    group.add(lod);

    // 5. Inner Layers Model (Inner/Outer Core, Mantle, Crust & Cross-Section Cap)
    const innerLayers = createInnerLayers(cutawayProgressUniform);
    const initialCutaway = CONSTANTS.GUI.EARTH.CUTAWAY || 0.0;
    if (innerLayers.userData.updateSubLayerVisibilities) {
        innerLayers.userData.updateSubLayerVisibilities(initialCutaway);
    } else {
        innerLayers.visible = initialCutaway > 0.0001;
    }
    group.userData.innerLayers = innerLayers;
    group.add(innerLayers);

    return group;
}
