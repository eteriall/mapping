import { expect, it } from "vitest";
import * as THREE from "three";

import {
  DEFAULT_VOLUME_FALLOFF,
  DEFAULT_VOLUME_INTENSITY,
  installMappedSpotlightMask,
  maskMappedSpotlights,
  PROJECTION_CONTOUR_COLOR,
  PROJECTION_CONTOUR_WIDTH,
  STAGE_SHADOW_MAP,
  VOLUME_CELL_SMOOTHING,
  VOLUME_GRID_COLUMNS,
  VOLUME_GRID_ROWS,
} from "@/lib/stage-rendering";

it("uses the supported percentage-closer shadow map", () => {
  expect(STAGE_SHADOW_MAP).toEqual({
    enabled: true,
    type: THREE.PCFShadowMap,
  });
  expect(STAGE_SHADOW_MAP.type).not.toBe(THREE.PCFSoftShadowMap);
});

it("uses a bold pink projected-surface contour", () => {
  expect(PROJECTION_CONTOUR_COLOR).toBe(0xff3e9d);
  expect(PROJECTION_CONTOUR_WIDTH).toBe(3);
});

it("starts projector volume bright and fades it quickly", () => {
  expect(DEFAULT_VOLUME_INTENSITY).toBe(0.3);
  expect(DEFAULT_VOLUME_FALLOFF).toBe(3);
});

it("uses a dense projector volume grid for smooth intersections", () => {
  expect(VOLUME_GRID_COLUMNS * VOLUME_GRID_ROWS).toBeGreaterThan(600);
  expect(VOLUME_CELL_SMOOTHING).toBeGreaterThan(0);
  expect(VOLUME_CELL_SMOOTHING).toBeLessThan(1);
});

it("blocks mapped spotlight light outside the projector texture", () => {
  const shader =
    "directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;";

  expect(maskMappedSpotlights(shader)).toContain(
    "inSpotLightMap ? directLight.color * spotColor.rgb : vec3( 0.0 )",
  );
});

it("installs the rectangular projector mask in Three's shared shader", () => {
  const original = THREE.ShaderChunk.lights_fragment_begin;
  THREE.ShaderChunk.lights_fragment_begin =
    "directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;";

  installMappedSpotlightMask();

  expect(THREE.ShaderChunk.lights_fragment_begin).toContain(": vec3( 0.0 )");
  THREE.ShaderChunk.lights_fragment_begin = original;
});
