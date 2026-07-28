import { expect, it } from "vitest";

import { frameRateFromSample } from "@/lib/frame-rate";

it("calculates a rounded frame rate from a render sample", () => {
  expect(frameRateFromSample(29, 0.5)).toBe(58);
});

it("returns zero when the sample has no elapsed time", () => {
  expect(frameRateFromSample(1, 0)).toBe(0);
});
