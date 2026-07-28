export function frameRateFromSample(
  frameCount: number,
  elapsedSeconds: number,
): number {
  return elapsedSeconds > 0 ? Math.round(frameCount / elapsedSeconds) : 0;
}
