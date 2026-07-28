"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { MediaAsset } from "@/lib/types";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uScale;
  uniform float uSeed;
  uniform float uIntensity;
  uniform int uKind;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453);
  }

  void main() {
    vec2 uv = (vUv - 0.5) * uScale;
    float value = 0.0;
    if (uKind == 0) {
      value = sin(uv.x * 9.0 + uTime) + sin(uv.y * 11.0 - uTime * 1.3);
      value += sin((uv.x + uv.y) * 8.0 + uTime * 0.7);
      value = value * 0.166 + 0.5;
    } else if (uKind == 1) {
      float angle = atan(uv.y, uv.x);
      float radius = length(uv);
      value = 0.5 + 0.5 * sin(abs(mod(angle * 5.0, 6.283) - 3.1415) * 5.0 + radius * 25.0 - uTime * 2.0);
    } else if (uKind == 2) {
      float radius = max(length(uv), 0.02);
      float angle = atan(uv.y, uv.x);
      value = smoothstep(0.42, 0.5, fract(8.0 / radius - uTime * 1.6));
      value += smoothstep(0.94, 1.0, abs(sin(angle * 8.0 + uTime)));
      value = clamp(value, 0.0, 1.0);
    } else if (uKind == 3) {
      vec2 cell = floor((uv + uTime * vec2(0.04, -0.08)) * 14.0);
      vec2 point = fract((uv + uTime * vec2(0.04, -0.08)) * 14.0) - 0.5;
      float sparkle = hash(cell);
      value = smoothstep(0.13 + sparkle * 0.12, 0.0, length(point)) * step(0.55, sparkle);
    } else {
      vec2 warped = vec2(uv.x / max(0.15, uv.y + 0.7), 1.0 / max(0.15, uv.y + 0.7));
      float vertical = smoothstep(0.9, 1.0, abs(sin(warped.x * 16.0)));
      float horizontal = smoothstep(0.9, 1.0, abs(sin(warped.y * 7.0 + uTime * 2.0)));
      value = max(vertical, horizontal);
    }
    vec3 color = mix(uColorA, uColorB, smoothstep(0.1, 0.72, value));
    color = mix(color, uColorC, smoothstep(0.7, 1.0, value));
    gl_FragColor = vec4(color * value * uIntensity, 1.0);
  }
`;

export function GeneratorPreview({
  asset,
  hovered,
  progress,
}: {
  asset: MediaAsset;
  hovered: boolean;
  progress: number;
}) {
  return (
    <span className="block aspect-video w-full bg-black">
      <Canvas camera={{ position: [0, 0, 1] }} dpr={1}>
        <GeneratorPlane asset={asset} hovered={hovered} progress={progress} />
      </Canvas>
    </span>
  );
}

function GeneratorPlane({
  asset,
  hovered,
  progress,
}: {
  asset: MediaAsset;
  hovered: boolean;
  progress: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const colorA = asset.generatorConfig.colors?.[0] ?? "#22d3ee";
  const colorB = asset.generatorConfig.colors?.[1] ?? "#8b5cf6";
  const colorC = asset.generatorConfig.colors?.[2] ?? "#ec4899";
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScale: { value: asset.generatorConfig.scale ?? 1 },
      uSeed: { value: asset.generatorConfig.seed ?? 1 },
      uIntensity: { value: asset.generatorConfig.intensity ?? 1 },
      uKind: {
        value: [
          "plasma",
          "kaleidoscope",
          "tunnel",
          "particles",
          "grid",
        ].indexOf(asset.generatorType),
      },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uColorC: { value: new THREE.Color(colorC) },
    }),
    [
      asset.generatorConfig.scale,
      asset.generatorConfig.seed,
      asset.generatorConfig.intensity,
      asset.generatorType,
      colorA,
      colorB,
      colorC,
    ],
  );
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value =
        (hovered ? progress * asset.duration : 0) *
        (asset.generatorConfig.speed ?? 1);
    }
  });
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        fragmentShader={fragmentShader}
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
      />
    </mesh>
  );
}
