import type { TransformMode } from "@/lib/types";

export const STAGE_CAMERA_NEAR = 0.01;
export const STAGE_CAMERA_FAR = 10_000;
export const STAGE_CAMERA_DOLLY_SPEED = 5;

export function transformSpace(mode: TransformMode): "local" | "world" {
  return mode === "rotate" ? "local" : "world";
}

export function cameraVerticalFov(
  sensorWidth: number,
  focalLength: number,
  aspect: number,
): number {
  const sensorHeight = sensorWidth / aspect;
  return (2 * Math.atan(sensorHeight / (2 * focalLength)) * 180) / Math.PI;
}
