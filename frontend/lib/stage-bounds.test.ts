import { describe, expect, it } from "vitest";

import {
  frustumSegmentsFromCorners,
  lightConeRadius,
  projectionCookieSize,
  projectionFrustumSegments,
  projectionWidthToFov,
  PROJECTOR_COOKIE_OVERSCAN,
  RECTANGULAR_PROJECTOR_PENUMBRA,
} from "@/lib/stage-bounds";

describe("stage bounds", () => {
  it("builds a projector frustum from its vertical field of view", () => {
    const positions = projectionFrustumSegments({
      aspect: 16 / 9,
      far: 10,
      near: 1,
      verticalFov: 60,
    });

    expect(positions).toHaveLength(72);
    expect(Math.max(...positions.filter((_, index) => index % 3 === 0))).toBeCloseTo(
      Math.tan(Math.PI / 6) * 10 * (16 / 9),
    );
    expect(Math.min(...positions.filter((_, index) => index % 3 === 2))).toBe(-10);
  });

  it("builds frustum rails from independently stopped far corners", () => {
    const segments = frustumSegmentsFromCorners(
      [
        [-1, 1, -1],
        [1, 1, -1],
        [1, -1, -1],
        [-1, -1, -1],
      ],
      [
        [-2, 2, -2],
        [3, 3, -3],
        [4, -4, -4],
        [-5, -5, -5],
      ],
    );

    expect(segments).toContain(-5);
    expect(segments).toContain(4);
    expect(segments).toHaveLength(72);
  });

  it("matches a spot light cone radius to its beam angle and range", () => {
    expect(lightConeRadius(10, 60)).toBeCloseTo(Math.tan(Math.PI / 6) * 10);
  });

  it("calculates a rectangular projector field of view from image width", () => {
    const fov = projectionWidthToFov(8, 16 / 9, 10);

    expect(fov.horizontal).toBeCloseTo(43.6028, 3);
    expect(fov.vertical).toBeCloseTo(25.3608, 3);
    expect(fov.diagonal).toBeGreaterThan(fov.horizontal);
  });

  it("fits rectangular content inside a square black projector cookie", () => {
    const [width, height] = projectionCookieSize(16 / 9);

    expect(width).toBeLessThan(2);
    expect(height).toBeLessThan(2);
    expect(width / height).toBeCloseTo(16 / 9);
  });

  it("does not apply circular penumbra to rectangular projection edges", () => {
    expect(RECTANGULAR_PROJECTOR_PENUMBRA).toBe(0);
  });

  it("adds a black gutter without changing projected rectangle size", () => {
    const regular = projectionCookieSize(16 / 9);
    const overscanned = projectionCookieSize(
      16 / 9,
      PROJECTOR_COOKIE_OVERSCAN,
    );

    expect(overscanned[0] * PROJECTOR_COOKIE_OVERSCAN).toBeCloseTo(
      regular[0],
    );
    expect(overscanned[1] * PROJECTOR_COOKIE_OVERSCAN).toBeCloseTo(
      regular[1],
    );
  });
});
