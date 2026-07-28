import * as THREE from "three";

export const STAGE_SHADOW_MAP = {
  enabled: true,
  type: THREE.PCFShadowMap,
};

export const PROJECTION_CONTOUR_COLOR = 0xff3e9d;
export const PROJECTION_CONTOUR_WIDTH = 3;
export const VOLUME_COLOR_SAMPLE_GRID = 4;

const UNMASKED_SPOTLIGHT_MAP_FALLBACK =
  "directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;";
const BLACK_SPOTLIGHT_MAP_FALLBACK =
  "directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : vec3( 0.0 );";

export function maskMappedSpotlights(fragmentShader: string): string {
  return fragmentShader.replace(
    UNMASKED_SPOTLIGHT_MAP_FALLBACK,
    BLACK_SPOTLIGHT_MAP_FALLBACK,
  );
}

export function installMappedSpotlightMask(): void {
  THREE.ShaderChunk.lights_fragment_begin = maskMappedSpotlights(
    THREE.ShaderChunk.lights_fragment_begin,
  );
}

export const DEFAULT_VOLUME_INTENSITY = 0.3;
export const DEFAULT_VOLUME_FALLOFF = 3;
