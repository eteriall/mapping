import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  buildProjectedSurfaceGeometry,
  buildProjectionVolumeGeometry,
} from "@/lib/projection-mesh";

describe("projected surface mesh", () => {
  it("clips front-facing triangles into a rectangular projector frustum", () => {
    const source = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 1));
    source.position.z = -5;
    source.updateMatrixWorld(true);

    const geometry = buildProjectedSurfaceGeometry(
      source,
      new THREE.Matrix4(),
      {
        aspect: 1,
        far: 10,
        near: 0.1,
        verticalFov: 45,
      },
    );
    const position = geometry.getAttribute("position");

    expect(position.count).toBeGreaterThan(0);
    for (let index = 0; index < position.count; index += 1) {
      expect(Math.abs(position.getX(index))).toBeLessThanOrEqual(2.3);
      expect(Math.abs(position.getY(index))).toBeLessThanOrEqual(2.3);
    }
  });

  it("returns an empty mesh for geometry behind the projector", () => {
    const source = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    source.position.z = 5;
    source.updateMatrixWorld(true);

    const geometry = buildProjectedSurfaceGeometry(
      source,
      new THREE.Matrix4(),
      {
        aspect: 1,
        far: 10,
        near: 0.1,
        verticalFov: 45,
      },
    );

    expect(geometry.getAttribute("position").count).toBe(0);
  });

  it("builds a closed-sided volume ending at sampled hit points", () => {
    const nearPoints = [
      new THREE.Vector3(-1, 1, -1),
      new THREE.Vector3(1, 1, -1),
      new THREE.Vector3(-1, -1, -1),
      new THREE.Vector3(1, -1, -1),
    ];
    const farPoints = nearPoints.map((point) => point.clone().multiplyScalar(5));
    const geometry = buildProjectionVolumeGeometry(
      nearPoints,
      farPoints,
      2,
      2,
    );

    expect(geometry.getAttribute("position").count).toBe(30);
    const progress = geometry.getAttribute("beamProgress");
    const beamUv = geometry.getAttribute("beamUv");
    expect(progress.count).toBe(30);
    expect(beamUv.count).toBe(30);
    expect(Math.min(...Array.from(progress.array))).toBe(0);
    expect(Math.max(...Array.from(progress.array))).toBe(1);
    expect(Math.min(...Array.from(beamUv.array))).toBe(0);
    expect(Math.max(...Array.from(beamUv.array))).toBe(1);
  });

});
