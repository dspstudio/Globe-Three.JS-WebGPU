import * as THREE from 'three';
import { texture, normalMap, mix, color, normalize, cross, cameraPosition, positionWorld, pow, dot, max, add, mul, vec3, vec2, smoothstep, uniform, equirectUV, positionLocal, modelWorldMatrixInverse, vec4, uv, distance, length, acos, asin, atan, sub, float, min, bumpMap, Discard, select, Fn, clamp, cos, sin, time, abs } from 'three/tsl';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { CONSTANTS } from '../constants';
import { createInnerLayers } from './InnerLayers';
import { loadEarthTextures } from './EarthTextures';
import { computeWaveData } from './OceanWaves';
import { createAtmosphereMeshes } from './AtmosphereShader';

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
    const tex = await loadEarthTextures(loader, maxAnisotropy);
    group.userData.updateGibsDate = tex.updateGibsDate;

    // 1. Earth base
    const geoHigh = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS, CONSTANTS.SEGMENTS, CONSTANTS.SEGMENTS);
    const geoMed = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS, Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)), Math.max(32, Math.floor(CONSTANTS.SEGMENTS / 2)));
    const geoLow = new THREE.SphereGeometry(CONSTANTS.EARTH_RADIUS, Math.max(24, Math.floor(CONSTANTS.SEGMENTS / 4)), Math.max(24, Math.floor(CONSTANTS.SEGMENTS / 4)));
    const earthMaterial = new MeshPhysicalNodeMaterial();
    
    const sunDir = sunDirUniform;
    
    // Procedural shadow logic: 
    const sunDirLocal = normalize(modelWorldMatrixInverse.mul(vec4(sunDir, 0.0)).xyz);
    
    const shadowDistUniform = uniform(CONSTANTS.GUI.CLOUD_SHADOWS.DISTANCE);
    const shadowIntensityUniform = uniform(CONSTANTS.GUI.CLOUD_SHADOWS.INTENSITY);
    const shadowColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.CLOUD_SHADOWS.COLOR));
    const cloudRotationYUniform = uniform(0.0);

    group.userData.shadowDist = shadowDistUniform;
    group.userData.shadowIntensity = shadowIntensityUniform;
    group.userData.shadowColor = shadowColorUniform;
    group.userData.cloudRotationY = cloudRotationYUniform;

    // Ray-sphere intersection for cloud shadow projection
    const posL = positionLocal;
    const re = float(CONSTANTS.EARTH_RADIUS);
    const rc = re.add(shadowDistUniform);
    const deltaRc = rc.mul(rc).sub(re.mul(re));
    const dotPS = dot(posL, sunDirLocal);
    
    const rayT = dotPS.negate().add(dotPS.mul(dotPS).add(deltaRc).max(0.0).sqrt());
    const shadowPosLocal = posL.add(sunDirLocal.mul(rayT));

    const rotAngle = cloudRotationYUniform;
    const cosR = cos(rotAngle);
    const sinR = sin(rotAngle);
    const rotX = shadowPosLocal.x.mul(cosR).add(shadowPosLocal.z.mul(sinR));
    const rotZ = shadowPosLocal.x.mul(sinR).negate().add(shadowPosLocal.z.mul(cosR));
    const shadowPosRotated = vec3(rotX, shadowPosLocal.y, rotZ);

    const normP = normalize(shadowPosRotated);
    const angleU = atan(normP.z, normP.x.negate());
    const shadowU = angleU.div(Math.PI * 2.0).add(select(angleU.lessThan(0.0), 1.0, 0.0));
    const shadowV = asin(clamp(normP.y, -1.0, 1.0)).div(Math.PI).add(0.5);
    const shadowUv = vec2(shadowU, shadowV);

    const shadowOpacity = texture(tex.cloudsMapTex, shadowUv).r;
    
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
    
    const cloudShadow = mix(vec3(1.0), shadowColorUniform, shadowOpacity.mul(shadowIntensityUniform));
    
    const sunDot = dot(normalize(positionWorld), sunDir);
    const nightFade = smoothstep(0.2, -0.2, sunDot);
    
    const twilightColorUniform = uniform(new THREE.Color(CONSTANTS.GUI.ATMOSPHERE.TWILIGHT_COLOR));
    group.userData.twilightColor = twilightColorUniform;
    
    const darkSideBrightnessUniform = uniform(CONSTANTS.GUI.ENVIRONMENT.DARK_SIDE_BRIGHTNESS);
    group.userData.darkSideBrightness = darkSideBrightnessUniform;
    
    const cityLightsUniform = uniform(CONSTANTS.GUI.ENVIRONMENT.CITY_LIGHTS);
    group.userData.cityLights = cityLightsUniform;

    const twilight1 = smoothstep(0.0, 0.2, sunDot).oneMinus(); 
    const twilight2 = smoothstep(-0.2, 0.0, sunDot);           
    const twilightFactor = twilight1.mul(twilight2);
    const twilightTint = mix(vec3(1.0), twilightColorUniform, twilightFactor.mul(0.5));

    const spec = texture(tex.specularMapTex).r;
    
    // Terrain Self-Shadowing
    const terrainShadowIntensityUniform = uniform(CONSTANTS.GUI.EARTH.TERRAIN_SHADOW_INTENSITY);
    const terrainShadowOffsetUniform = uniform(CONSTANTS.GUI.EARTH.TERRAIN_SHADOW_OFFSET);
    group.userData.terrainShadowIntensity = terrainShadowIntensityUniform;
    group.userData.terrainShadowOffset = terrainShadowOffsetUniform;
    
    const surfaceNorm = normalize(positionLocal);
    const vTan = normalize(cross(vec3(0.0, 1.0, 0.0), surfaceNorm));
    const vBit = normalize(cross(surfaceNorm, vTan));
    
    const nMap = texture(tex.normalMapTex).xyz.mul(2.0).sub(1.0);
    const pNorm = normalize(vTan.mul(nMap.x).add(vBit.mul(nMap.y)).add(surfaceNorm.mul(nMap.z)));
    const terrainDot = max(0.0, dot(pNorm, sunDirLocal));
    
    const sunProj = sunDirLocal.sub(surfaceNorm.mul(dot(sunDirLocal, surfaceNorm)));
    const sunT = normalize(sunProj.add(vec3(0.000001)));
    const offsetPos = normalize(positionLocal.add(sunT.mul(terrainShadowOffsetUniform)));
    const offsetUv = equirectUV(offsetPos);
    
    const offsetNMap = texture(tex.normalMapTex, offsetUv).xyz.mul(2.0).sub(1.0);
    const pNormOffset = normalize(vTan.mul(offsetNMap.x).add(vBit.mul(offsetNMap.y)).add(surfaceNorm.mul(offsetNMap.z)));
    const offsetDot = max(0.0, dot(pNormOffset, sunDirLocal));
    
    const occlusion = max(0.0, offsetDot.sub(terrainDot));
    const landMask = spec.oneMinus();
    const daylightMask = smoothstep(0.0, 0.2, dot(surfaceNorm, sunDirLocal));
    const selfShadowFactor = smoothstep(0.0, 0.3, occlusion).mul(landMask).mul(terrainShadowIntensityUniform).mul(daylightMask);
    const terrainShadowColor = mix(vec3(1.0), vec3(0.1, 0.15, 0.2), selfShadowFactor);
    
    // Real-time Moon Eclipse Shadow
    const fragmentToMoon = sub(moonPosUniform, positionWorld);
    const dirFragmentToMoon = normalize(fragmentToMoon);
    const thetaMoon = acos(max(float(-1.0), min(float(1.0), dot(dirFragmentToMoon, sunDir))));
    
    const thetaM = float(0.024); 
    const sunAngularRadiusVal = float(0.02); 
    const penumbraOuter = thetaM.add(sunAngularRadiusVal);
    const umbraInner = max(float(0.0), thetaM.sub(sunAngularRadiusVal));
    
    const moonEclipseShadow = smoothstep(penumbraOuter, umbraInner, thetaMoon);
    const eclipseDimmer = mix(vec3(1.0), vec3(0.015, 0.02, 0.025), moonEclipseShadow);

    // Optical Ocean & Depth Gradient Shading
    const ndviEnhanceUniform = uniform(CONSTANTS.GUI.EARTH.NDVI_ENHANCE_STRENGTH || 0.3);
    const laiEnhanceUniform = uniform(CONSTANTS.GUI.EARTH.LAI_ENHANCE_STRENGTH || 0.3);
    const snowMinRgbUniform = uniform(CONSTANTS.GUI.EARTH.SNOW_MASK_MIN_RGB ?? 0.35);
    const snowMaxRgbUniform = uniform(CONSTANTS.GUI.EARTH.SNOW_MASK_MAX_RGB ?? 0.52);
    const snowMinAlbedoUniform = uniform(CONSTANTS.GUI.EARTH.SNOW_MASK_MIN_ALBEDO ?? 0.40);
    const snowMaxAlbedoUniform = uniform(CONSTANTS.GUI.EARTH.SNOW_MASK_MAX_ALBEDO ?? 0.60);
    const greenDomThreshUniform = uniform(CONSTANTS.GUI.EARTH.GREEN_DOMINANCE_THRESHOLD ?? 0.03);

    group.userData.ndviEnhance = ndviEnhanceUniform;
    group.userData.laiEnhance = laiEnhanceUniform;
    group.userData.snowMinRgb = snowMinRgbUniform;
    group.userData.snowMaxRgb = snowMaxRgbUniform;
    group.userData.snowMinAlbedo = snowMinAlbedoUniform;
    group.userData.snowMaxAlbedo = snowMaxAlbedoUniform;
    group.userData.greenDomThresh = greenDomThreshUniform;

    const baseDayTex = texture(tex.colorMapTex);
    const ndviSample = tex.ndviMapTex ? texture(tex.ndviMapTex) : vec4(0.0);
    const laiSample = tex.laiMapTex ? texture(tex.laiMapTex) : vec4(0.0);
    const albedoSample = tex.albedoMapTex ? texture(tex.albedoMapTex) : vec4(0.5);

    const ndviVal = ndviSample.a;
    const laiVal = laiSample.r.add(laiSample.g).add(laiSample.b).div(3.0);
    const albedoVal = albedoSample.r.add(albedoSample.g).add(albedoSample.b).div(3.0);
    
    const minRGB = min(baseDayTex.r, min(baseDayTex.g, baseDayTex.b));
    const snowBrightnessFactor = smoothstep(snowMinRgbUniform, snowMaxRgbUniform, minRGB);
    const snowAlbedoFactor = smoothstep(snowMinAlbedoUniform, snowMaxAlbedoUniform, albedoVal);
    const snowFactor = max(snowBrightnessFactor, snowAlbedoFactor);
    const nonSnowMask = float(1.0).sub(snowFactor);

    const greenDom = smoothstep(float(0.0), greenDomThreshUniform, baseDayTex.g.sub(baseDayTex.r));

    const vegFactor = ndviVal.mul(ndviEnhanceUniform)
        .add(laiVal.mul(laiEnhanceUniform))
        .clamp(0.0, 1.0)
        .mul(float(1.0).sub(spec))
        .mul(nonSnowMask)
        .mul(greenDom);
    const vegBoostColor = baseDayTex.mul(vec3(0.82, 1.25, 0.88));
    const landDayTex = mix(baseDayTex, vegBoostColor, vegFactor);

    const bathymetrySample = tex.bathymetryMapTex ? texture(tex.bathymetryMapTex) : texture(tex.bumpMapTex);
    const depthVal = bathymetrySample.r.add(bathymetrySample.g).add(bathymetrySample.b).div(3.0);
    const depthFactor = depthVal.mul(bathymetryIntensityUniform).clamp(0.0, 1.0);
    
    const oceanGradientColor = mix(oceanDeepColorUniform, oceanShallowColorUniform, depthFactor);
    const oceanColor = mix(oceanGradientColor, landDayTex, waterClarityUniform);
    const oceanSurfaceTex = mix(landDayTex, oceanColor, spec);

    // Procedural Animated Waves
    const normWorld = normalize(positionWorld);
    const waveData = wavesEnabledUniform.greaterThan(0.0).select(
        computeWaveData(waveSpeedUniform, waveScaleUniform, waveHeightUniform),
        vec4(normWorld, float(0.0))
    );
    const waveNormWorld = waveData.xyz;
    const hWave0 = waveData.w;

    const oceanNormWorld = mix(normWorld, waveNormWorld, spec);

    const deepOceanGlintBoost = float(1.0).add(float(1.0).sub(depthFactor).mul(CONSTANTS.OCEAN_SHADER.DEEP_OCEAN_GLINT_BOOST));
    const coastalSpecDampen = float(1.0).sub(smoothstep(float(CONSTANTS.OCEAN_SHADER.COASTAL_SPEC_DAMPEN_MIN), float(CONSTANTS.OCEAN_SHADER.COASTAL_SPEC_DAMPEN_MAX), depthFactor).mul(CONSTANTS.OCEAN_SHADER.COASTAL_SPEC_DAMPEN_FACTOR));
    const bathymetrySpecMask = deepOceanGlintBoost.mul(coastalSpecDampen);

    const viewDirWorld = normalize(cameraPosition.sub(positionWorld));
    const cosViewWave = max(float(0.0), dot(oceanNormWorld, viewDirWorld));
    const fresnelVal = pow(float(1.0).sub(cosViewWave), fresnelExponentUniform).mul(fresnelStrengthUniform).mul(spec).mul(bathymetrySpecMask);
    const fresnelGlow = fresnelColorUniform.mul(fresnelVal);

    const sunLight = max(float(0.0), dot(oceanNormWorld, sunDir));
    const forwardScatter = pow(max(float(0.0), dot(viewDirWorld, sunDir.negate())), float(CONSTANTS.OCEAN_SHADER.SSS_FORWARD_EXPONENT)).add(CONSTANTS.OCEAN_SHADER.SSS_FORWARD_BIAS);
    const sssGlow = sssColorUniform.mul(sssIntensityUniform).mul(sunLight).mul(forwardScatter).mul(depthFactor).mul(spec);

    const halfDirWorld = normalize(sunDir.add(viewDirWorld));
    const NdotH = max(float(0.0), dot(oceanNormWorld, halfDirWorld));
    
    const sunGlint = pow(NdotH, float(CONSTANTS.OCEAN_SHADER.SUN_GLINT_EXPONENT)).mul(sunGlintPowerUniform).mul(spec).mul(bathymetrySpecMask);
    const waveSparkle = pow(NdotH, float(CONSTANTS.OCEAN_SHADER.WAVE_SPARKLE_EXPONENT)).mul(CONSTANTS.OCEAN_SHADER.WAVE_SPARKLE_INTENSITY).mul(spec).mul(waveSparkleUniform).mul(bathymetrySpecMask);
    const waveSparkleGlow = vec3(
        CONSTANTS.OCEAN_SHADER.SUN_GLINT_TINT[0],
        CONSTANTS.OCEAN_SHADER.SUN_GLINT_TINT[1],
        CONSTANTS.OCEAN_SHADER.SUN_GLINT_TINT[2]
    ).mul(sunGlint).add(vec3(
        CONSTANTS.OCEAN_SHADER.WAVE_SPARKLE_TINT[0],
        CONSTANTS.OCEAN_SHADER.WAVE_SPARKLE_TINT[1],
        CONSTANTS.OCEAN_SHADER.WAVE_SPARKLE_TINT[2]
    ).mul(waveSparkle)).mul(sunLight).mul(wavesEnabledUniform);

    const waveCrestFoam = smoothstep(float(CONSTANTS.OCEAN_SHADER.WAVE_CREST_FOAM_MIN), float(CONSTANTS.OCEAN_SHADER.WAVE_CREST_FOAM_MAX), hWave0).mul(foamIntensityUniform).mul(spec).mul(CONSTANTS.OCEAN_SHADER.WAVE_CREST_FOAM_FACTOR).mul(wavesEnabledUniform);

    const shoreDepthDiff = abs(hWave0.sub(depthFactor.mul(CONSTANTS.OCEAN_SHADER.SHORE_FOAM_DEPTH_SCALE)));
    const dynamicShoreFoam = smoothstep(float(CONSTANTS.OCEAN_SHADER.SHORE_FOAM_DIFF_MAX), float(CONSTANTS.OCEAN_SHADER.SHORE_FOAM_DIFF_MIN), shoreDepthDiff)
        .mul(smoothstep(float(CONSTANTS.OCEAN_SHADER.SHORE_FOAM_DEPTH_MIN), float(CONSTANTS.OCEAN_SHADER.SHORE_FOAM_DEPTH_MAX), depthFactor))
        .mul(spec)
        .mul(foamIntensityUniform)
        .mul(CONSTANTS.OCEAN_SHADER.SHORE_FOAM_INTENSITY_BOOST);

    const totalFoam = waveCrestFoam.add(dynamicShoreFoam).clamp(0.0, 1.0);
    const waveFoamColor = vec3(
        CONSTANTS.OCEAN_SHADER.WAVE_FOAM_COLOR[0],
        CONSTANTS.OCEAN_SHADER.WAVE_FOAM_COLOR[1],
        CONSTANTS.OCEAN_SHADER.WAVE_FOAM_COLOR[2]
    );
    const oceanSurfaceWithWaves = mix(oceanSurfaceTex.rgb, waveFoamColor, totalFoam);

    const foamMin = foamThresholdUniform.sub(coastalFadeDistanceUniform).clamp(0.0, 1.0);
    const coastalFoamMask = smoothstep(foamMin, foamThresholdUniform, depthFactor).mul(pow(spec, float(CONSTANTS.OCEAN_SHADER.COASTAL_FOAM_SPEC_POWER))).mul(CONSTANTS.OCEAN_SHADER.COASTAL_FOAM_FACTOR);
    const coastalFoamColor = vec3(
        CONSTANTS.OCEAN_SHADER.COASTAL_FOAM_COLOR[0],
        CONSTANTS.OCEAN_SHADER.COASTAL_FOAM_COLOR[1],
        CONSTANTS.OCEAN_SHADER.COASTAL_FOAM_COLOR[2]
    );
    const finalSurfaceTex = mix(oceanSurfaceWithWaves, coastalFoamColor, coastalFoamMask.mul(foamIntensityUniform));

    // SST / GIBS Data Overlay
    const gibsEnabledUniform = uniform(CONSTANTS.GUI.EARTH.GIBS_ENABLED ? 1.0 : 0.0);
    const gibsOpacityUniform = uniform(CONSTANTS.GUI.EARTH.GIBS_OPACITY || 0.8);
    const initialGibsLayer = CONSTANTS.GUI.EARTH.GIBS_LAYER === "VIIRS True Color (Daily)" ? 3.0 :
                             CONSTANTS.GUI.EARTH.GIBS_LAYER === "IMERG Precipitation Rate" ? 2.0 :
                             CONSTANTS.GUI.EARTH.GIBS_LAYER === "MODIS Terra NDVI 8-Day" ? 1.0 : 0.0;
    const gibsLayerUniform = uniform(initialGibsLayer);
    group.userData.gibsEnabled = gibsEnabledUniform;
    group.userData.gibsOpacity = gibsOpacityUniform;
    group.userData.gibsLayer = gibsLayerUniform;

    const sstSample = tex.sstMapTex ? texture(tex.sstMapTex) : vec4(0.0);
    const imergSampleRaw = tex.imergMapTex ? texture(tex.imergMapTex) : vec4(0.0);
    const viirsSample = tex.viirsTrueColorMapTex ? texture(tex.viirsTrueColorMapTex) : vec4(0.0);

    const imergIntensity = imergSampleRaw.r.add(imergSampleRaw.g).add(imergSampleRaw.b);
    const imergAlpha = imergSampleRaw.a.mul(smoothstep(0.01, 0.08, imergIntensity));
    const imergSample = vec4(imergSampleRaw.rgb, imergAlpha);

    const gibsSample = gibsLayerUniform.greaterThan(2.5).select(
        viirsSample,
        gibsLayerUniform.greaterThan(1.5).select(
            imergSample,
            gibsLayerUniform.greaterThan(0.5).select(ndviSample, sstSample)
        )
    );
    const gibsFactor = gibsEnabledUniform.mul(gibsOpacityUniform).mul(gibsSample.a);

    const displacementScaleUniform = uniform(CONSTANTS.GUI.EARTH.DISPLACEMENT_SCALE || 0.02);
    const landRoughnessUniform = uniform(CONSTANTS.GUI.EARTH.LAND_ROUGHNESS || 0.8);
    const albedoPbrStrengthUniform = uniform(CONSTANTS.GUI.EARTH.ALBEDO_PBR_MODULATION || 0.35);
    group.userData.displacementScale = displacementScaleUniform;
    group.userData.landRoughness = landRoughnessUniform;
    group.userData.albedoPbrStrength = albedoPbrStrengthUniform;

    const bumpVal = texture(tex.bumpMapTex).r;
    earthMaterial.positionNode = positionLocal.add(normalize(positionLocal).mul(bumpVal.mul(displacementScaleUniform)));

    const rawLitEarthColor = finalSurfaceTex.add(fresnelGlow).add(sssGlow).add(waveSparkleGlow).mul(cloudShadow).mul(twilightTint).mul(terrainShadowColor).mul(eclipseDimmer);
    const earthBaseColor = mix(rawLitEarthColor, vec3(0.0), gibsFactor);

    earthMaterial.colorNode = Fn(() => {
        Discard(cutDiscard);
        return earthBaseColor;
    })() as any;
    
    const albedoRoughnessShift = float(0.5).sub(albedoVal).mul(albedoPbrStrengthUniform);
    const landRoughnessMap = mix(landRoughnessUniform.mul(0.6), landRoughnessUniform, bumpVal)
        .add(vegFactor.mul(ndviEnhanceUniform).mul(0.15))
        .add(albedoRoughnessShift)
        .clamp(0.05, 1.0);
    const baseRoughness = mix(landRoughnessMap, waterRoughnessUniform, spec);
    const baseMetalness = mix(0.0, waterMetalnessUniform, spec);
    
    earthMaterial.roughnessNode = mix(baseRoughness, float(1.0), moonEclipseShadow);
    earthMaterial.metalnessNode = mix(baseMetalness, float(0.0), moonEclipseShadow);
    earthMaterial.specularColorNode = mix(vec3(1.0), vec3(0.0), moonEclipseShadow);
    const waterSpecIntensity = fresnelStrengthUniform.mul(bathymetrySpecMask);
    earthMaterial.specularIntensityNode = mix(float(1.0), waterSpecIntensity, spec).mul(float(1.0).sub(moonEclipseShadow));
    earthMaterial.iorNode = mix(float(1.5), waterIorUniform, spec).mul(float(1.0).sub(moonEclipseShadow));
    
    const bumpScaleUniform = uniform(vec2(CONSTANTS.GUI.EARTH.BUMP_SCALE, CONSTANTS.GUI.EARTH.BUMP_SCALE));
    group.userData.bumpScale = bumpScaleUniform;
    
    const bumpFade = smoothstep(-0.15, 0.15, sunDot);
    earthMaterial.normalNode = normalMap(texture(tex.normalMapTex), bumpScaleUniform.mul(bumpFade));

    const nightLights = texture(tex.nightMapTex).mul(nightFade).mul(cityLightsUniform);
    const darkSideAmbient = texture(tex.colorMapTex).mul(nightFade).mul(darkSideBrightnessUniform).mul(0.5);
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
    
    const finalCloudOpacity = texture(tex.cloudsMapTex).r;
    
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
    
    cloudsMaterial.normalNode = bumpMap(texture(tex.cloudsMapTex), float(0.02).mul(bumpFade));
    
    cloudsMaterial.transparent = true;
    cloudsMaterial.opacityNode = finalCloudOpacity;
    cloudsMaterial.depthWrite = false;
    
    const cloudsHigh = new THREE.Mesh(cloudsGeoHigh, cloudsMaterial);
    cloudsHigh.name = 'clouds';

    const cloudsMed = new THREE.Mesh(cloudsGeoMed, cloudsMaterial);
    cloudsMed.name = 'clouds';

    const cloudsLow = new THREE.Mesh(cloudsGeoLow, cloudsMaterial);
    cloudsLow.name = 'clouds';

    // 3. Atmosphere
    const atmosMeshes = createAtmosphereMeshes(sunDir, cutDiscard, group.userData);

    const highGroup = new THREE.Group();
    highGroup.add(earthHigh, cloudsHigh, ...atmosMeshes.highGroupMeshes);

    const medGroup = new THREE.Group();
    medGroup.add(earthMed, cloudsMed, ...atmosMeshes.medGroupMeshes);

    const lowGroup = new THREE.Group();
    lowGroup.add(earthLow, cloudsLow, ...atmosMeshes.lowGroupMeshes);

    const lod = new THREE.LOD();
    lod.addLevel(highGroup, 0);
    lod.addLevel(medGroup, 25);
    lod.addLevel(lowGroup, 55);

    group.add(lod);

    // 4. Inner Layers Model
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
