import { describe, expect, it } from "vitest";

import {
  cameraVerticalFov,
  STAGE_CAMERA_DOLLY_SPEED,
  STAGE_CAMERA_FAR,
  STAGE_CAMERA_NEAR,
  transformSpace,
} from "@/lib/transform";

describe("transform controls", () => {
  it("moves in world space and rotates around local object axes", () => {
    expect(transformSpace("translate")).toBe("world");
    expect(transformSpace("rotate")).toBe("local");
  });

  it("calculates a vertical field of view for a placed camera", () => {
    expect(cameraVerticalFov(36, 50, 16 / 9)).toBeCloseTo(22.895, 2);
  });

  it("keeps the entire stage inside the camera clipping range", () => {
    expect(STAGE_CAMERA_NEAR).toBeLessThanOrEqual(0.01);
    expect(STAGE_CAMERA_FAR).toBeGreaterThanOrEqual(10_000);
  });

  it("uses fast dolly navigation in the stage viewport", () => {
    expect(STAGE_CAMERA_DOLLY_SPEED).toBe(5);
  });
});
