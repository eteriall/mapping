type FrustumOptions = {
  aspect: number;
  far: number;
  near: number;
  verticalFov: number;
};

type Point = [number, number, number];

export const RECTANGULAR_PROJECTOR_PENUMBRA = 0;

export function projectionCookieSize(aspect: number): [number, number] {
  const diagonal = Math.hypot(aspect, 1);
  return [(2 * aspect) / diagonal, 2 / diagonal];
}

export function projectionWidthToFov(
  width: number,
  aspect: number,
  distance: number,
): { diagonal: number; horizontal: number; vertical: number } {
  const halfWidth = width / 2;
  const halfHeight = halfWidth / aspect;
  return {
    diagonal:
      (2 * Math.atan(Math.hypot(halfWidth, halfHeight) / distance) * 180) /
      Math.PI,
    horizontal: (2 * Math.atan(halfWidth / distance) * 180) / Math.PI,
    vertical: (2 * Math.atan(halfHeight / distance) * 180) / Math.PI,
  };
}

export function projectionFrustumSegments({
  aspect,
  far,
  near,
  verticalFov,
}: FrustumOptions): number[] {
  const halfAngle = (verticalFov * Math.PI) / 360;
  const nearHalfHeight = Math.tan(halfAngle) * near;
  const nearHalfWidth = nearHalfHeight * aspect;
  const farHalfHeight = Math.tan(halfAngle) * far;
  const farHalfWidth = farHalfHeight * aspect;
  const corners: Point[] = [
    [-nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, -nearHalfHeight, -near],
    [-nearHalfWidth, -nearHalfHeight, -near],
    [-farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, -farHalfHeight, -far],
    [-farHalfWidth, -farHalfHeight, -far],
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  return edges.flatMap(([start, end]) => [
    ...corners[start],
    ...corners[end],
  ]);
}

export function lightConeRadius(range: number, beamAngle: number): number {
  return Math.tan((beamAngle * Math.PI) / 360) * range;
}
