import { expect, it } from "vitest";
import * as THREE from "three";

import {
  PROJECTION_CONTOUR_COLOR,
  PROJECTION_CONTOUR_WIDTH,
  STAGE_SHADOW_MAP,
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
