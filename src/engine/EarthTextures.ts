import * as THREE from "three";
import { CONSTANTS } from "../constants";

export interface LoadedEarthTextures {
  colorMapTex: THREE.Texture;
  specularMapTex: THREE.Texture;
  normalMapTex: THREE.Texture;
  cloudsMapTex: THREE.Texture;
  nightMapTex: THREE.Texture;
  bumpMapTex: THREE.Texture;
  sstMapTex: THREE.Texture | null;
  ndviMapTex: THREE.Texture | null;
  bathymetryMapTex: THREE.Texture | null;
  laiMapTex: THREE.Texture | null;
  albedoMapTex: THREE.Texture | null;
  viirsTrueColorMapTex: THREE.Texture | null;
  imergMapTex: THREE.Texture | null;
  updateGibsDate: (dateStr: string) => Promise<void>;
}

export async function loadEarthTextures(
  loader: THREE.TextureLoader,
  maxAnisotropy: number = 1
): Promise<LoadedEarthTextures> {
  const [
    colorMapTex,
    specularMapTex,
    normalMapTex,
    cloudsMapTex,
    nightMapTex,
    bumpMapTex,
    sstMapTex,
    ndviMapTex,
    bathymetryMapTex,
    laiMapTex,
    albedoMapTex,
  ] = await Promise.all([
    loader.loadAsync(CONSTANTS.TEXTURES.ALBEDO),
    loader.loadAsync(CONSTANTS.TEXTURES.SPECULAR),
    loader.loadAsync(CONSTANTS.TEXTURES.NORMAL),
    loader.loadAsync(CONSTANTS.TEXTURES.CLOUDS),
    loader.loadAsync(CONSTANTS.TEXTURES.NIGHT),
    loader.loadAsync(CONSTANTS.TEXTURES.BUMP),
    loader.loadAsync(CONSTANTS.TEXTURES.SST_ANOMALIES).catch(() => null),
    loader.loadAsync(CONSTANTS.TEXTURES.MODIS_NDVI).catch(() => null),
    loader.loadAsync(CONSTANTS.TEXTURES.BATHYMETRY).catch(() => null),
    loader.loadAsync(CONSTANTS.TEXTURES.MODIS_LAI).catch(() => null),
    loader.loadAsync(CONSTANTS.TEXTURES.MODIS_ALBEDO).catch(() => null),
  ]);

  const viirsTrueColorMapTex = await loader
    .loadAsync(CONSTANTS.TEXTURES.VIIRS_TRUE_COLOR)
    .catch(() => null);

  const imergMapTex = await loader
    .loadAsync(CONSTANTS.TEXTURES.IMERG_PRECIPITATION)
    .catch(async () => {
      const fallbackUrl =
        "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=IMERG_Precipitation_Rate&FORMAT=image/png&BBOX=-180,-90,180,90&SRS=EPSG:4326&WIDTH=2048&HEIGHT=1024&TIME=2024-07-27";
      return loader.loadAsync(fallbackUrl).catch(() => null);
    });

  colorMapTex.colorSpace = THREE.SRGBColorSpace;
  cloudsMapTex.colorSpace = THREE.SRGBColorSpace;
  nightMapTex.colorSpace = THREE.SRGBColorSpace;

  const optionalTexs = [
    sstMapTex,
    ndviMapTex,
    laiMapTex,
    albedoMapTex,
    imergMapTex,
    viirsTrueColorMapTex,
    bathymetryMapTex,
  ];
  for (const tex of optionalTexs) {
    if (tex) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
    }
  }

  colorMapTex.anisotropy = maxAnisotropy;
  specularMapTex.anisotropy = maxAnisotropy;
  normalMapTex.anisotropy = maxAnisotropy;
  cloudsMapTex.anisotropy = maxAnisotropy;
  nightMapTex.anisotropy = maxAnisotropy;
  bumpMapTex.anisotropy = maxAnisotropy;

  const updateGibsDate = async (dateStr: string) => {
    const cleanDate = dateStr.trim();
    const viirsUrl = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor&FORMAT=image/jpeg&BBOX=-180,-90,180,90&SRS=EPSG:4326&WIDTH=2048&HEIGHT=1024&TIME=${cleanDate}`;
    const imergUrl = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=IMERG_Precipitation_Rate&FORMAT=image/png&BBOX=-180,-90,180,90&SRS=EPSG:4326&WIDTH=2048&HEIGHT=1024&TIME=${cleanDate}`;

    try {
      if (viirsTrueColorMapTex) {
        const newTex = await loader.loadAsync(viirsUrl);
        newTex.colorSpace = THREE.SRGBColorSpace;
        newTex.anisotropy = maxAnisotropy;
        viirsTrueColorMapTex.image = newTex.image;
        viirsTrueColorMapTex.needsUpdate = true;
      }
      if (imergMapTex) {
        const newTex = await loader.loadAsync(imergUrl);
        newTex.colorSpace = THREE.SRGBColorSpace;
        newTex.anisotropy = maxAnisotropy;
        imergMapTex.image = newTex.image;
        imergMapTex.needsUpdate = true;
      }
    } catch (e) {
      console.warn("Could not load GIBS data for date:", cleanDate, e);
    }
  };

  return {
    colorMapTex,
    specularMapTex,
    normalMapTex,
    cloudsMapTex,
    nightMapTex,
    bumpMapTex,
    sstMapTex,
    ndviMapTex,
    bathymetryMapTex,
    laiMapTex,
    albedoMapTex,
    viirsTrueColorMapTex,
    imergMapTex,
    updateGibsDate,
  };
}
