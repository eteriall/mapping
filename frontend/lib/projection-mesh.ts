import * as THREE from "three";

type ProjectionVolume = {
  aspect: number;
  far: number;
  near: number;
  verticalFov: number;
};

type ClipPlane = (point: THREE.Vector3) => number;

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
  );
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

export function buildProjectionVolumeGeometry(
  nearPoints: THREE.Vector3[],
  farPoints: THREE.Vector3[],
  columns: number,
  rows: number,
): THREE.BufferGeometry {
  const output: number[] = [];
  const progress: number[] = [];
  const uvs: number[] = [];
  const addTriangle = (
    first: [THREE.Vector3, number, number, number],
    second: [THREE.Vector3, number, number, number],
    third: [THREE.Vector3, number, number, number],
  ) => {
    const [firstPoint, firstProgress, firstU, firstV] = first;
    const [secondPoint, secondProgress, secondU, secondV] = second;
    const [thirdPoint, thirdProgress, thirdU, thirdV] = third;
    output.push(
      firstPoint.x,
      firstPoint.y,
      firstPoint.z,
      secondPoint.x,
      secondPoint.y,
      secondPoint.z,
      thirdPoint.x,
      thirdPoint.y,
      thirdPoint.z,
    );
    progress.push(firstProgress, secondProgress, thirdProgress);
    uvs.push(firstU, firstV, secondU, secondV, thirdU, thirdV);
  };
  const addQuad = (
    first: [THREE.Vector3, number, number, number],
    second: [THREE.Vector3, number, number, number],
    third: [THREE.Vector3, number, number, number],
    fourth: [THREE.Vector3, number, number, number],
  ) => {
    addTriangle(first, second, third);
    addTriangle(first, third, fourth);
  };

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const topLeft = row * columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns;
      const bottomRight = bottomLeft + 1;
      const leftU = column / (columns - 1);
      const rightU = (column + 1) / (columns - 1);
      const topV = 1 - row / (rows - 1);
      const bottomV = 1 - (row + 1) / (rows - 1);
      addQuad(
        [farPoints[topLeft], 1, leftU, topV],
        [farPoints[bottomLeft], 1, leftU, bottomV],
        [farPoints[bottomRight], 1, rightU, bottomV],
        [farPoints[topRight], 1, rightU, topV],
      );
    }
  }
  for (let column = 0; column < columns - 1; column += 1) {
    const leftU = column / (columns - 1);
    const rightU = (column + 1) / (columns - 1);
    addQuad(
      [nearPoints[column], 0, leftU, 1],
      [farPoints[column], 1, leftU, 1],
      [farPoints[column + 1], 1, rightU, 1],
      [nearPoints[column + 1], 0, rightU, 1],
    );
    const bottomLeft = (rows - 1) * columns + column;
    addQuad(
      [nearPoints[bottomLeft + 1], 0, rightU, 0],
      [farPoints[bottomLeft + 1], 1, rightU, 0],
      [farPoints[bottomLeft], 1, leftU, 0],
      [nearPoints[bottomLeft], 0, leftU, 0],
    );
  }
  for (let row = 0; row < rows - 1; row += 1) {
    const left = row * columns;
    const nextLeft = left + columns;
    const topV = 1 - row / (rows - 1);
    const bottomV = 1 - (row + 1) / (rows - 1);
    addQuad(
      [nearPoints[nextLeft], 0, 0, bottomV],
      [farPoints[nextLeft], 1, 0, bottomV],
      [farPoints[left], 1, 0, topV],
      [nearPoints[left], 0, 0, topV],
    );
    const right = left + columns - 1;
    const nextRight = right + columns;
    addQuad(
      [nearPoints[right], 0, 1, topV],
      [farPoints[right], 1, 1, topV],
      [farPoints[nextRight], 1, 1, bottomV],
      [nearPoints[nextRight], 0, 1, bottomV],
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(output, 3),
  );
  geometry.setAttribute(
    "beamProgress",
    new THREE.Float32BufferAttribute(progress, 1),
  );
  geometry.setAttribute("beamUv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}
