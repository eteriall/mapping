import * as THREE from "three";

type ProjectionVolume = {
  aspect: number;
  far: number;
  near: number;
  verticalFov: number;
};

type ClipPlane = (point: THREE.Vector3) => number;

export const PROJECTED_SURFACE_EDGE_SCALE = 1.015;

function clipPolygon(
  polygon: THREE.Vector3[],
  plane: ClipPlane,
): THREE.Vector3[] {
  const clipped: THREE.Vector3[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentDistance = plane(current);
    const previousDistance = plane(previous);
    const currentInside = currentDistance >= 0;
    const previousInside = previousDistance >= 0;
    if (currentInside !== previousInside) {
      const amount =
        previousDistance / (previousDistance - currentDistance);
      clipped.push(previous.clone().lerp(current, amount));
    }
    if (currentInside) {
      clipped.push(current.clone());
    }
  }
  return clipped;
}

export function buildProjectedSurfaceGeometry(
  source: THREE.Mesh,
  projectorWorldMatrix: THREE.Matrix4,
  volume: ProjectionVolume,
): THREE.BufferGeometry {
  const sourceGeometry = source.geometry;
  const position = sourceGeometry.getAttribute("position");
  const index = sourceGeometry.getIndex();
  const projectorInverse = projectorWorldMatrix.clone().invert();
  const sourceToProjector = projectorInverse.multiply(source.matrixWorld);
  const projectorToSource = sourceToProjector.clone().invert();
  const halfHeightFactor = Math.tan(
    (volume.verticalFov * Math.PI) / 360,
  ) * PROJECTED_SURFACE_EDGE_SCALE;
  const halfWidthFactor = halfHeightFactor * volume.aspect;
  const planes: ClipPlane[] = [
    (point) => -point.z * halfWidthFactor - point.x,
    (point) => -point.z * halfWidthFactor + point.x,
    (point) => -point.z * halfHeightFactor - point.y,
    (point) => -point.z * halfHeightFactor + point.y,
    (point) => -point.z - volume.near,
    (point) => volume.far + point.z,
  ];
  const output: number[] = [];
  const triangleCount = index
    ? Math.floor(index.count / 3)
    : Math.floor(position.count / 3);
  const vertices = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertexIndex = index
        ? index.getX(triangle * 3 + corner)
        : triangle * 3 + corner;
      vertices[corner]
        .fromBufferAttribute(position, vertexIndex)
        .applyMatrix4(sourceToProjector);
    }
    edgeA.subVectors(vertices[1], vertices[0]);
    edgeB.subVectors(vertices[2], vertices[0]);
    normal.crossVectors(edgeA, edgeB);
    centroid
      .copy(vertices[0])
      .add(vertices[1])
      .add(vertices[2])
      .multiplyScalar(1 / 3);
    if (normal.dot(centroid.clone().negate()) <= 0) {
      continue;
    }
    let polygon = vertices.map((vertex) => vertex.clone());
    for (const plane of planes) {
      polygon = clipPolygon(polygon, plane);
      if (polygon.length < 3) {
        break;
      }
    }
    for (let corner = 1; corner < polygon.length - 1; corner += 1) {
      for (const point of [polygon[0], polygon[corner], polygon[corner + 1]]) {
        const local = point.clone().applyMatrix4(projectorToSource);
        output.push(local.x, local.y, local.z);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(output, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}
