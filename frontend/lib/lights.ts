import type { EquipmentTemplate, SceneObject } from "@/lib/types";

export type LightType = "point" | "spot" | "directional" | "area";

export type LightSettings = {
  lightType: LightType;
  color: string;
  lumens: number;
  range: number;
  beamAngle: number;
  penumbra: number;
  decay: number;
  width: number;
  height: number;
  castShadow: boolean;
};

export function resolveLightSettings(
  properties: SceneObject["properties"],
  specs: EquipmentTemplate["specs"],
): LightSettings {
  const requestedType = String(properties.lightType ?? specs.lightType);
  const lightType: LightType = (
    ["point", "spot", "directional", "area"] as const
  ).includes(requestedType as LightType)
    ? (requestedType as LightType)
    : "point";
  return {
    lightType,
    color: String(properties.color ?? specs.color ?? "#fff1df"),
    lumens: Math.max(1, Number(properties.lumens ?? specs.lumens) || 14000),
    range: Math.max(0.1, Number(properties.range ?? specs.range) || 20),
    beamAngle: Math.min(
      179,
      Math.max(1, Number(properties.beamAngle ?? specs.beamAngle) || 45),
    ),
    penumbra: Math.min(
      1,
      Math.max(0, Number(properties.penumbra ?? specs.penumbra) || 0),
    ),
    decay: Math.min(
      2,
      Math.max(0, Number(properties.decay ?? specs.decay) || 0),
    ),
    width: Math.max(0.01, Number(properties.width ?? specs.width) || 1),
    height: Math.max(0.01, Number(properties.height ?? specs.height) || 1),
    castShadow: Boolean(
      properties.castShadow ?? specs.castShadow ?? true,
    ),
  };
}
