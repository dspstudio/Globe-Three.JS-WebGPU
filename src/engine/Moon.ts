import * as THREE from 'three';
import { CONSTANTS } from '../constants';

export function updateMoon(moonMesh: THREE.Object3D, sunMesh: THREE.Mesh, camera: THREE.Camera, settings: { angle: number, distance: number, inclination: number }) {
    const ma = settings.angle;
    const mi = settings.inclination;
    const dist = settings.distance;
    
    moonMesh.position.set(
        Math.cos(ma) * dist,
        Math.sin(mi) * dist,
        Math.sin(ma) * Math.cos(mi) * dist
    );
    
    // Moon is tidally locked, roughly looking at Earth (0,0,0)
    moonMesh.lookAt(0, 0, 0);
}

export async function createMoon(textureLoader: THREE.TextureLoader, maxAnisotropy: number = 1) {
    const radius = 2.73; // Moon radius relative to Earth 10
    const segmentsHigh = Math.floor(CONSTANTS.SEGMENTS / 2);
    const segmentsMed = Math.max(8, Math.floor(CONSTANTS.SEGMENTS / 4));
    const segmentsLow = Math.max(4, Math.floor(CONSTANTS.SEGMENTS / 8));

    const geoHigh = new THREE.SphereGeometry(radius, segmentsHigh, segmentsHigh);
    const geoMed = new THREE.SphereGeometry(radius, segmentsMed, segmentsMed);
    const geoLow = new THREE.SphereGeometry(radius, segmentsLow, segmentsLow);
    
    const map = await textureLoader.loadAsync(CONSTANTS.TEXTURES.MOON_ALBEDO);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = maxAnisotropy;
    
    // Load displacement map
    const displacementMap = await textureLoader.loadAsync(CONSTANTS.TEXTURES.MOON_DISPLACEMENT);
    displacementMap.anisotropy = maxAnisotropy;
    
    const material = new THREE.MeshStandardMaterial({
        map: map,
        displacementMap: displacementMap,
        displacementScale: CONSTANTS.GUI.MOON.DISPLACEMENT_SCALE, // Adjust based on visual strength
        emissive: new THREE.Color(0xffffff),
        emissiveMap: map,
        emissiveIntensity: CONSTANTS.GUI.MOON.ILLUMINATION,
        roughness: 1.0,
        metalness: 0.0
    });
    
    const meshHigh = new THREE.Mesh(geoHigh, material);
    meshHigh.castShadow = true;
    meshHigh.receiveShadow = true;

    const meshMed = new THREE.Mesh(geoMed, material);
    meshMed.castShadow = true;
    meshMed.receiveShadow = true;

    const meshLow = new THREE.Mesh(geoLow, material);
    meshLow.castShadow = true;
    meshLow.receiveShadow = true;

    const lod = new THREE.LOD();
    lod.addLevel(meshHigh, 0);
    lod.addLevel(meshMed, 45);
    lod.addLevel(meshLow, 90);

    return lod;
}
