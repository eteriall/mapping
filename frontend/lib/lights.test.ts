import { describe, expect, it } from "vitest";

import { resolveLightSettings } from "@/lib/lights";

describe("light settings", () => {
  it("combines template defaults with per-light overrides", () => {
    const settings = resolveLightSettings(
      {
        lightType: "area",
        color: "#00ff88",
        lumens: 9000,
        width: 3,
      },
      {
        lightType: "spot",
        color: "#ffffff",
        lumens: 14000,
        range: 18,
        beamAngle: 55,
        penumbra: 0.25,
        decay: 2,
        width: 1,
        height: 2,
        castShadow: true,
      },
    );

    expect(settings.lightType).toBe("area");
    expect(settings.color).toBe("#00ff88");
    expect(settings.lumens).toBe(9000);
    expect(settings.width).toBe(3);
    expect(settings.height).toBe(2);
    expect(settings.castShadow).toBe(true);
  });

  it("clamps values that Three.js cannot simulate safely", () => {
    const settings = resolveLightSettings(
      {
        beamAngle: 240,
        decay: 4,
        height: 0,
        penumbra: -1,
        range: -5,
      },
      {},
    );

    expect(settings.beamAngle).toBe(179);
    expect(settings.decay).toBe(2);
    expect(settings.height).toBe(1);
    expect(settings.penumbra).toBe(0);
    expect(settings.range).toBe(0.1);
  });
});
