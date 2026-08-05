import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  dot,
  fract,
  floor,
  mix,
  normalize,
  cross,
  positionLocal,
  positionWorld,
  time,
  abs,
} from "three/tsl";
import { CONSTANTS } from "../constants";

export const hash2D = Fn(([p]: [any]) => {
  const pVec = vec2(p);
  const p1 = fract(
    pVec.mul(
      vec2(
        CONSTANTS.OCEAN_SHADER.NOISE_HASH_P1[0],
        CONSTANTS.OCEAN_SHADER.NOISE_HASH_P1[1]
      )
    )
  );
  const d = dot(p1, p1.add(vec2(CONSTANTS.OCEAN_SHADER.NOISE_HASH_D)));
  const p2 = p1.add(vec2(d));
  return fract(p2.x.mul(p2.y));
});

export const noise2D = Fn(([p]: [any]) => {
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

export const fbm2D = Fn(([p]: [any]) => {
  const pVec = vec2(p);
  const n1 = noise2D(pVec).mul(CONSTANTS.OCEAN_SHADER.FBM_OCTAVE1_WEIGHT);
  const n2 = noise2D(pVec.mul(CONSTANTS.OCEAN_SHADER.FBM_OCTAVE2_SCALE)).mul(
    CONSTANTS.OCEAN_SHADER.FBM_OCTAVE2_WEIGHT
  );
  return n1.add(n2);
});

export const getWaveHeightAt = Fn(([pPos, waveTimeNode, waveScaleNode]: [any, any, any]) => {
  const pNorm = normalize(vec3(pPos));
  const absN = abs(pNorm);
  const w = absN.div(absN.x.add(absN.y).add(absN.z).add(0.0001));

  const driftA = vec2(
    waveTimeNode.mul(CONSTANTS.OCEAN_SHADER.WAVE_DRIFT_A[0]),
    waveTimeNode.mul(CONSTANTS.OCEAN_SHADER.WAVE_DRIFT_A[1])
  );
  const driftB = vec2(
    waveTimeNode.mul(CONSTANTS.OCEAN_SHADER.WAVE_DRIFT_B[0]),
    waveTimeNode.mul(CONSTANTS.OCEAN_SHADER.WAVE_DRIFT_B[1])
  );

  const uvX = vec2(pNorm.y, pNorm.z).mul(waveScaleNode);
  const uvY = vec2(pNorm.x, pNorm.z).mul(waveScaleNode);
  const uvZ = vec2(pNorm.x, pNorm.y).mul(waveScaleNode);

  const wx = fbm2D(uvX.add(driftA))
    .mul(CONSTANTS.OCEAN_SHADER.WAVE_FBM_PRIMARY_WEIGHT)
    .add(
      fbm2D(uvX.mul(CONSTANTS.OCEAN_SHADER.WAVE_FBM_SECONDARY_SCALE).add(driftB)).mul(
        CONSTANTS.OCEAN_SHADER.WAVE_FBM_SECONDARY_WEIGHT
      )
    );
  const wy = fbm2D(uvY.add(driftA))
    .mul(CONSTANTS.OCEAN_SHADER.WAVE_FBM_PRIMARY_WEIGHT)
    .add(
      fbm2D(uvY.mul(CONSTANTS.OCEAN_SHADER.WAVE_FBM_SECONDARY_SCALE).add(driftB)).mul(
        CONSTANTS.OCEAN_SHADER.WAVE_FBM_SECONDARY_WEIGHT
      )
    );
  const wz = fbm2D(uvZ.add(driftA))
    .mul(CONSTANTS.OCEAN_SHADER.WAVE_FBM_PRIMARY_WEIGHT)
    .add(
      fbm2D(uvZ.mul(CONSTANTS.OCEAN_SHADER.WAVE_FBM_SECONDARY_SCALE).add(driftB)).mul(
        CONSTANTS.OCEAN_SHADER.WAVE_FBM_SECONDARY_WEIGHT
      )
    );

  return wx.mul(w.x).add(wy.mul(w.y)).add(wz.mul(w.z));
});

export const computeWaveData = Fn(
  ([waveSpeedNode, waveScaleNode, waveHeightNode]: [any, any, any]) => {
    const waveTimeNode = time.mul(waveSpeedNode);
    const hWave0 = getWaveHeightAt(positionLocal, waveTimeNode, waveScaleNode);

    const waveEps = float(CONSTANTS.OCEAN_SHADER.WAVE_EPSILON);
    const pLocNorm = normalize(positionLocal);
    const vTanL = normalize(cross(vec3(0.0, 1.0, 0.0), pLocNorm));
    const vBitL = normalize(cross(pLocNorm, vTanL));

    const pTanL = normalize(positionLocal.add(vTanL.mul(waveEps)));
    const pBitL = normalize(positionLocal.add(vBitL.mul(waveEps)));

    const hWaveTan = getWaveHeightAt(pTanL, waveTimeNode, waveScaleNode);
    const hWaveBit = getWaveHeightAt(pBitL, waveTimeNode, waveScaleNode);

    const dWaveTan = hWaveTan.sub(hWave0).div(waveEps);
    const dWaveBit = hWaveBit.sub(hWave0).div(waveEps);

    const waveGradLocal = vTanL
      .mul(dWaveTan)
      .add(vBitL.mul(dWaveBit))
      .mul(waveHeightNode);
    const normWorld = normalize(positionWorld);
    const waveNormWorld = normalize(normWorld.sub(waveGradLocal));
    return vec4(waveNormWorld, hWave0);
  }
);
