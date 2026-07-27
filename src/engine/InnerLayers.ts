import * as THREE from 'three';
import { positionLocal, length, vec3, smoothstep, float, mix, Discard, select, Fn, time, fract, floor, clamp, normalize, mod } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

const hashIC = Fn(([p]: [any]) => {
    const p1 = vec3(fract(p.mul(0.3183099).add(0.1))).mul(17.0);
    return fract(p1.x.mul(p1.y).mul(p1.z).mul(p1.x.add(p1.y).add(p1.z)));
});

const noiseIC = Fn(([x]: [any]) => {
    const i = floor(x);
    const f = vec3(fract(x));
    const f2 = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));

    const h000 = hashIC(i.add(vec3(0, 0, 0)));
    const h100 = hashIC(i.add(vec3(1, 0, 0)));
    const h010 = hashIC(i.add(vec3(0, 1, 0)));
    const h110 = hashIC(i.add(vec3(1, 1, 0)));
    const h001 = hashIC(i.add(vec3(0, 0, 1)));
    const h101 = hashIC(i.add(vec3(1, 0, 1)));
    const h011 = hashIC(i.add(vec3(0, 1, 1)));
    const h111 = hashIC(i.add(vec3(1, 1, 1)));

    const m00 = mix(h000, h100, f2.x);
    const m10 = mix(h010, h110, f2.x);
    const m0 = mix(m00, m10, f2.y);

    const m01 = mix(h001, h101, f2.x);
    const m11 = mix(h011, h111, f2.x);
    const m1 = mix(m01, m11, f2.y);

    return mix(m0, m1, f2.z);
});

const fbmIC = Fn(([p]: [any]) => {
    const v = float(0.0).toVar();
    const a = float(0.5).toVar();
    const curP = vec3(p).toVar();

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.02));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.02));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.02));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.02));
    a.assign(a.mul(0.5));

    return v;
});

const calculateMoltenCore = Fn(([pos, uTime]: [any, any]) => {
    const nor = normalize(pos);
    const p = nor.mul(3.0);
    const flow = uTime.mul(0.05);

    const n1 = fbmIC(p.add(vec3(flow, flow.negate(), flow.mul(0.5))));
    const n2 = fbmIC(p.mul(2.3).sub(vec3(0.0, flow.mul(1.5), 0.0)).add(n1));
    const turbulence = fbmIC(p.mul(1.5).add(n2.mul(2.0)).sub(flow));

    const heat = clamp(turbulence.mul(1.3).add(n1.mul(0.4)), float(0.0), float(1.0));

    const coldMetal = vec3(0.08, 0.03, 0.02);
    const deepRed   = vec3(0.55, 0.05, 0.0);
    const orange    = vec3(1.0, 0.35, 0.02);
    const whiteHot  = vec3(1.4, 1.1, 0.75);

    const c1 = mix(coldMetal, deepRed, smoothstep(float(0.15), float(0.45), heat));
    const c2 = mix(c1, orange, smoothstep(float(0.45), float(0.75), heat));
    const heatColor = mix(c2, whiteHot, smoothstep(float(0.78), float(0.95), heat)).toVar();

    const veins = smoothstep(float(0.6), float(0.9), fbmIC(p.mul(6.0).add(n2.mul(3.0))));
    heatColor.addAssign(veins.mul(vec3(1.0, 0.5, 0.15)).mul(0.6));

    return heatColor;
});

const fbmLM = Fn(([p]: [any]) => {
    const v = float(0.0).toVar();
    const a = float(0.5).toVar();
    const curP = vec3(p).toVar();

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.03));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.03));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.03));
    a.assign(a.mul(0.5));

    return v;
});

const rockFbm = Fn(([p, uTime]: [any, any]) => {
    const t = float(uTime);
    const warp1 = vec3(
        fbmLM(p.add(t.mul(0.04))),
        fbmLM(p.add(vec3(4.1, 2.2, 1.7)).add(t.mul(0.03))),
        fbmLM(p.add(vec3(2.3, 6.6, 3.4)).sub(t.mul(0.025)))
    );
    const warp2 = vec3(
        fbmLM(p.add(warp1.mul(2.0)).add(vec3(1.1, 3.3, 2.2)).add(t.mul(0.02))),
        fbmLM(p.add(warp1.mul(2.0)).add(vec3(5.0, 1.4, 0.9)).sub(t.mul(0.015))),
        fbmLM(p.add(warp1.mul(2.0)).add(vec3(3.1, 0.6, 5.4)).add(t.mul(0.022)))
    );
    return fbmLM(p.add(warp2.mul(2.0)));
});

const calculateLowerMantle = Fn(([pos, uTime]: [any, any]) => {
    const nor = normalize(pos);
    const flowTime = uTime.mul(0.06);
    const p = nor.mul(2.4);

    const convection = rockFbm(p, flowTime);
    const mineralDetail = fbmLM(p.mul(6.0).add(convection.mul(1.5)));

    const heat = clamp(convection.mul(0.9).add(mineralDetail.mul(0.15)), float(0.0), float(1.0));

    const coldRock   = vec3(0.09, 0.085, 0.09);
    const basalt     = vec3(0.16, 0.11, 0.09);
    const ironRock   = vec3(0.32, 0.14, 0.08);
    const hotZone    = vec3(0.65, 0.15, 0.04);
    const plumeCore  = vec3(1.0, 0.42, 0.08);

    const r1 = mix(coldRock, basalt, smoothstep(float(0.1), float(0.4), heat));
    const r2 = mix(r1, ironRock, smoothstep(float(0.4), float(0.62), heat));
    const r3 = mix(r2, hotZone, smoothstep(float(0.65), float(0.8), heat));
    const rockColor = mix(r3, plumeCore, smoothstep(float(0.85), float(0.97), heat)).toVar();

    const grain = fbmLM(p.mul(18.0));
    rockColor.assign(rockColor.mul(float(0.85).add(grain.mul(0.3))));

    const plumeVeins = smoothstep(float(0.82), float(0.94), fbmLM(p.mul(4.0).add(convection.mul(2.0)).sub(flowTime)));
    rockColor.addAssign(plumeVeins.mul(vec3(1.0, 0.35, 0.05)).mul(0.5));

    const llsvp = smoothstep(float(0.55), float(0.7), fbmLM(p.mul(0.8).sub(flowTime.mul(0.3))));
    rockColor.assign(mix(rockColor, rockColor.mul(vec3(1.15, 0.6, 0.45)), llsvp.mul(0.4)));

    return rockColor;
});

const fbmUM = Fn(([p]: [any]) => {
    const v = float(0.0).toVar();
    const a = float(0.5).toVar();
    const curP = vec3(p).toVar();

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.03));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.03));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.03));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.03));
    a.assign(a.mul(0.5));

    return v;
});

const ductileFbm = Fn(([p, uTime]: [any, any]) => {
    const t = float(uTime);
    const warp1 = vec3(
        fbmUM(p.add(t.mul(0.16))),
        fbmUM(p.add(vec3(3.7, 1.9, 2.4)).add(t.mul(0.13))),
        fbmUM(p.add(vec3(1.6, 5.8, 4.0)).sub(t.mul(0.11)))
    );
    const warp2 = vec3(
        fbmUM(p.add(warp1.mul(2.4)).add(vec3(2.1, 0.8, 3.6)).add(t.mul(0.09))),
        fbmUM(p.add(warp1.mul(2.4)).add(vec3(4.4, 2.7, 1.1)).sub(t.mul(0.07))),
        fbmUM(p.add(warp1.mul(2.4)).add(vec3(0.9, 3.9, 2.8)).add(t.mul(0.095)))
    );
    return fbmUM(p.add(warp2.mul(2.4)));
});

const calculateUpperMantle = Fn(([pos, uTime]: [any, any]) => {
    const nor = normalize(pos);
    const flowTime = uTime.mul(0.18);
    const p = nor.mul(2.8);

    const flow = ductileFbm(p, flowTime);
    const mineralDetail = fbmUM(p.mul(7.0).add(flow.mul(1.6)));

    const coldRock   = vec3(0.1, 0.06, 0.04);
    const tanRock    = vec3(0.22, 0.13, 0.08);
    const rustyBrown = vec3(0.34, 0.18, 0.09);

    const rockMix = smoothstep(float(0.15), float(0.6), flow);
    const r1 = mix(coldRock, tanRock, rockMix);
    const rockColor = mix(r1, rustyBrown, smoothstep(float(0.5), float(0.85), mineralDetail)).toVar();

    const grain = fbmUM(p.mul(20.0));
    rockColor.assign(rockColor.mul(float(0.82).add(grain.mul(0.35))));

    const fractures = smoothstep(float(0.66), float(0.7), fbmUM(p.mul(10.0).sub(flow)));
    rockColor.assign(rockColor.mul(float(1.0).sub(fractures.mul(0.35))));

    const meltNoise = fbmUM(p.mul(2.4).add(flow.mul(3.2)).sub(flowTime.mul(0.9)));
    const meltPockets = smoothstep(float(0.58), float(0.78), meltNoise);
    const meltChannels = smoothstep(float(0.62), float(0.72), fbmUM(p.mul(5.5).add(flow.mul(3.8)).sub(flowTime.mul(1.3))));

    const meltColor = vec3(1.05, 0.4, 0.06);
    const meltGlow = meltColor.mul(meltPockets.mul(1.1).add(meltChannels.mul(0.85)));

    rockColor.addAssign(meltGlow);

    return rockColor;
});

const fbmCrust = Fn(([p]: [any]) => {
    const v = float(0.0).toVar();
    const a = float(0.5).toVar();
    const curP = vec3(p).toVar();

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.05));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.05));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.05));
    a.assign(a.mul(0.5));

    v.addAssign(a.mul(noiseIC(curP)));
    curP.assign(curP.mul(2.05));
    a.assign(a.mul(0.5));

    return v;
});

const warpDomain = Fn(([p, uTime]: [any, any]) => {
    const t = float(uTime);
    const warp = vec3(
        fbmCrust(p.mul(1.2).add(t.mul(0.01))),
        fbmCrust(p.mul(1.2).add(vec3(4.2, 1.1, 3.3)).add(t.mul(0.008))),
        fbmCrust(p.mul(1.2).add(vec3(1.7, 5.4, 2.2)).sub(t.mul(0.006)))
    );
    return p.add(warp.sub(0.5).mul(1.4));
});

const calculateCrust = Fn(([pos, uTime]: [any, any]) => {
    const nor = normalize(pos);
    const driftTime = uTime.mul(0.015);
    const p = nor.mul(3.2);
    const wp = warpDomain(p, driftTime);

    // --- Stratified layering ---
    const strataAxis = fbmCrust(wp.mul(0.9).add(vec3(0.0, driftTime, 0.0))).mul(6.0);
    const layer1 = vec3(0.05, 0.05, 0.055);   // near-black basalt
    const layer2 = vec3(0.11, 0.09, 0.08);    // dark brown sediment
    const layer3 = vec3(0.16, 0.14, 0.12);    // grey-brown metamorphic
    const layer4 = vec3(0.08, 0.075, 0.07);   // charcoal shale

    const layerId = floor(strataAxis);
    const layerSel = mod(layerId, float(4.0));
    
    const strataColor = layer1.toVar();
    strataColor.assign(mix(strataColor, layer2, smoothstep(float(0.5), float(1.5), layerSel)));
    strataColor.assign(mix(strataColor, layer3, smoothstep(float(1.5), float(2.5), layerSel)));
    strataColor.assign(mix(strataColor, layer4, smoothstep(float(2.5), float(3.5), layerSel)));

    // Band color jitter
    const bandJitter = hashIC(floor(wp.mul(0.9).add(vec3(0.0, driftTime, 0.0))).mul(3.0));
    strataColor.assign(strataColor.mul(float(0.85).add(bandJitter.mul(0.3))));

    // Fine mineral grain / rock speckle texture
    const grain = fbmCrust(p.mul(22.0));
    strataColor.assign(strataColor.mul(float(0.8).add(grain.mul(0.4))));

    const rockColor = strataColor.toVar();

    // --- Fracture / fault network ---
    const faultNoise = fbmCrust(p.mul(1.6).add(vec3(driftTime.mul(0.5), 0.0, 0.0)));
    const faults = smoothstep(float(0.5), float(0.52), faultNoise).sub(smoothstep(float(0.52), float(0.54), faultNoise));

    const crackNoise = fbmCrust(p.mul(9.0).sub(vec3(0.0, driftTime, 0.0)));
    const cracks = smoothstep(float(0.56), float(0.58), crackNoise).sub(smoothstep(float(0.58), float(0.6), crackNoise));

    const crackColor = vec3(0.01, 0.008, 0.007);
    rockColor.assign(mix(rockColor, crackColor, clamp(faults.mul(1.5), float(0.0), float(1.0))));
    rockColor.assign(mix(rockColor, crackColor, clamp(cracks.mul(0.8), float(0.0), float(1.0))));

    // Rust seams along fault lines
    const rustSeam = smoothstep(float(0.5), float(0.51), faultNoise).sub(smoothstep(float(0.51), float(0.515), faultNoise));
    rockColor.assign(mix(rockColor, vec3(0.28, 0.13, 0.06), clamp(rustSeam.mul(2.0), float(0.0), float(1.0))));

    // Bright mineral vein glints
    const veinGlint = smoothstep(float(0.9), float(0.96), fbmCrust(p.mul(14.0).add(5.0)));
    rockColor.addAssign(veinGlint.mul(vec3(0.25, 0.22, 0.18)).mul(0.4));

    return rockColor;
});

export function createInnerLayers(cutawayProgressUniform: any): THREE.Group {
    const group = new THREE.Group();
    group.name = 'inner_layers';

    // Sequential layer peeling math (0.0 -> 1.0 mapped to 5 layer segments of 0.2 each)
    const pCrust = clamp(cutawayProgressUniform.div(0.2), float(0.0), float(1.0));
    const pUM    = clamp(cutawayProgressUniform.sub(0.2).div(0.2), float(0.0), float(1.0));
    const pLM    = clamp(cutawayProgressUniform.sub(0.4).div(0.2), float(0.0), float(1.0));
    const pOC    = clamp(cutawayProgressUniform.sub(0.6).div(0.2), float(0.0), float(1.0));
    const pIC    = clamp(cutawayProgressUniform.sub(0.8).div(0.2), float(0.0), float(1.0));

    const cutX_Crust = mix(float(15.0), float(0.0), pCrust);
    const cutX_UM    = mix(float(15.0), float(0.0), pUM);
    const cutX_LM    = mix(float(15.0), float(0.0), pLM);
    const cutX_OC    = mix(float(15.0), float(0.0), pOC);
    const cutX_IC    = mix(float(15.0), float(0.0), pIC);

    // Helper to wrap material colorNode with per-layer cutaway discard
    const applyCut = (mat: any, colorNode: any, layerCutX: any) => {
        mat.side = THREE.DoubleSide;
        mat.depthWrite = true;
        const isClosed = cutawayProgressUniform.lessThanEqual(0.001);
        const cutDiscard = isClosed.or(positionLocal.x.greaterThan(layerCutX));
        mat.colorNode = Fn(() => {
            Discard(cutDiscard);
            return colorNode;
        })();
    };

    // 1. Inner Core (Solid Nickel-Iron, Glowing with custom turbulence shader)
    const innerCoreGeo = new THREE.SphereGeometry(1.8, 48, 48);
    const innerCoreMat = new MeshBasicNodeMaterial();
    const innerCoreColor = calculateMoltenCore(positionLocal, time);
    applyCut(innerCoreMat, innerCoreColor, cutX_IC);
    const innerCoreMesh = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    group.add(innerCoreMesh);

    // 2. Outer Core (Liquid Iron-Nickel, Molten flow)
    const outerCoreGeo = new THREE.SphereGeometry(3.5, 48, 48);
    const outerCoreMat = new MeshBasicNodeMaterial();
    const outerCoreColor = calculateMoltenCore(positionLocal.mul(0.6), time.mul(1.2)).mul(vec3(1.0, 0.5, 0.2));
    applyCut(outerCoreMat, outerCoreColor, cutX_OC);
    const outerCoreMesh = new THREE.Mesh(outerCoreGeo, outerCoreMat);
    group.add(outerCoreMesh);

    // 3. Lower Mantle (Semi-molten Silicate with rock convection & thermal plumes)
    const lowerMantleGeo = new THREE.SphereGeometry(6.375, 48, 48);
    const lowerMantleMat = new MeshBasicNodeMaterial();
    const lowerMantleColor = calculateLowerMantle(positionLocal, time);
    applyCut(lowerMantleMat, lowerMantleColor, cutX_LM);
    const lowerMantleMesh = new THREE.Mesh(lowerMantleGeo, lowerMantleMat);
    group.add(lowerMantleMesh);

    // 4. Upper Mantle (Peridotite/Pyroxenite rock with ductile flow & partial melt)
    const upperMantleGeo = new THREE.SphereGeometry(9.25, 48, 48);
    const upperMantleMat = new MeshBasicNodeMaterial();
    const upperMantleColor = calculateUpperMantle(positionLocal, time);
    applyCut(upperMantleMat, upperMantleColor, cutX_UM);
    const upperMantleMesh = new THREE.Mesh(upperMantleGeo, upperMantleMat);
    group.add(upperMantleMesh);

    // 5. Crust Inner Wall (Stratified rock with layered banding & fault network)
    const crustGeo = new THREE.SphereGeometry(9.65, 48, 48);
    const crustMat = new MeshBasicNodeMaterial();
    const crustColor = calculateCrust(positionLocal, time);
    applyCut(crustMat, crustColor, cutX_Crust);
    const crustMesh = new THREE.Mesh(crustGeo, crustMat);
    group.add(crustMesh);

    // 6. Flat Cross-Section Cap Disk at X = 0 (Facing +X)
    const capGeo = new THREE.CircleGeometry(10.0, 128);
    const capMat = new MeshBasicNodeMaterial();
    capMat.side = THREE.DoubleSide;
    capMat.transparent = true;
    capMat.depthWrite = true;

    // Radius from center of disk (YZ plane)
    const dist = length(positionLocal.xy);

    // Procedural layer bands with crisp boundary rings
    const isIC = dist.lessThan(1.8);
    const isOC = dist.greaterThanEqual(1.8).and(dist.lessThan(3.5));
    const isLM = dist.greaterThanEqual(3.5).and(dist.lessThan(6.375));
    const isUM = dist.greaterThanEqual(6.375).and(dist.lessThan(9.25));
    const isCrust = dist.greaterThanEqual(9.25);

    // Dark line separator rings
    const isRing = dist.sub(1.8).abs().lessThan(0.04)
        .or(dist.sub(3.5).abs().lessThan(0.04))
        .or(dist.sub(6.375).abs().lessThan(0.04))
        .or(dist.sub(9.25).abs().lessThan(0.04));

    const icMoltenCapColor = calculateMoltenCore(vec3(positionLocal.x, positionLocal.y, 1.8), time);
    const ocMoltenCapColor = calculateMoltenCore(vec3(positionLocal.x, positionLocal.y, 3.5), time.mul(1.2)).mul(vec3(1.0, 0.5, 0.2));
    const lmColor = calculateLowerMantle(vec3(positionLocal.x, positionLocal.y, 6.375), time);
    const umColor = calculateUpperMantle(vec3(positionLocal.x, positionLocal.y, 9.25), time);
    const crustCapColor = calculateCrust(vec3(positionLocal.x, positionLocal.y, 9.65), time);
    const ringColor = vec3(0.02, 0.02, 0.02);

    let capColor = select(isUM, umColor, crustCapColor);
    capColor = select(isLM, lmColor, capColor);
    capColor = select(isOC, ocMoltenCapColor, capColor);
    capColor = select(isIC, icMoltenCapColor, capColor);
    capColor = select(isRing, ringColor, capColor);

    let capOpacity = select(isUM, pUM, pCrust);
    capOpacity = select(isLM, pLM, capOpacity);
    capOpacity = select(isOC, pOC, capOpacity);
    capOpacity = select(isIC, pIC, capOpacity);

    capMat.colorNode = Fn(() => {
        Discard(capOpacity.lessThan(0.01));
        return capColor;
    })();
    capMat.opacityNode = capOpacity;

    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.rotation.y = Math.PI / 2; // Facing +X
    group.add(capMesh);

    group.userData.updateSubLayerVisibilities = (p: number) => {
        group.visible = p > 0.0001;
        if (!group.visible) return;

        // Skip rendering occluded inner layers when upper layer is fully closed
        crustMesh.visible = true;
        upperMantleMesh.visible = true;
        lowerMantleMesh.visible = p > 0.2;
        outerCoreMesh.visible = p > 0.4;
        innerCoreMesh.visible = p > 0.6;
        capMesh.visible = true;
    };

    return group;
}

