"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CameraControls,
  Grid,
  Html,
  PerspectiveCamera,
  TransformControls,
  useFBO,
  useGLTF,
} from "@react-three/drei";
import {
  type ComponentRef,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";

import { frameRateFromSample } from "@/lib/frame-rate";
import { resolveLightSettings } from "@/lib/lights";
import {
  expiredInactiveResourceIds,
  inactiveResourceIds,
  releaseVideoElement,
} from "@/lib/media-playback";
import {
  frustumSegmentsFromCorners,
  lightConeRadius,
  projectionCookieSize,
  projectionFrustumSegments,
  projectionWidthToFov,
  PROJECTOR_COOKIE_OVERSCAN,
  RECTANGULAR_PROJECTOR_PENUMBRA,
} from "@/lib/stage-bounds";
import {
  buildProjectedSurfaceGeometry,
  buildProjectionVolumeGeometry,
} from "@/lib/projection-mesh";
import {
  DEFAULT_VOLUME_FALLOFF,
  DEFAULT_VOLUME_INTENSITY,
  installMappedSpotlightMask,
  PROJECTION_CONTOUR_COLOR,
  PROJECTION_CONTOUR_WIDTH,
  STAGE_SHADOW_MAP,
  VOLUME_CELL_SMOOTHING,
  VOLUME_GRID_COLUMNS,
  VOLUME_GRID_ROWS,
} from "@/lib/stage-rendering";
import { activeLayers } from "@/lib/timeline";
import { useStudioStore } from "@/lib/studio-store";
import {
  cameraVerticalFov,
  STAGE_CAMERA_DOLLY_SPEED,
  STAGE_CAMERA_FAR,
  STAGE_CAMERA_NEAR,
  transformSpace,
} from "@/lib/transform";
import type {
  EquipmentTemplate,
  MediaAsset,
  ModelAsset,
  SceneObject,
  TimelineTrack,
} from "@/lib/types";

const generatorVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

installMappedSpotlightMask();

const generatorFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uScale;
  uniform float uSeed;
  uniform float uIntensity;
  uniform float uOpacity;
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
    gl_FragColor = vec4(color * value * uIntensity, uOpacity);
  }
`;

const VIDEO_RESOURCE_RETENTION_SECONDS = 5;

function FrameRateMonitor({
  onFpsChange,
}: {
  onFpsChange: (fps: number) => void;
}) {
  const elapsedRef = useRef(0);
  const framesRef = useRef(0);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    framesRef.current += 1;
    if (elapsedRef.current < 0.5) {
      return;
    }
    onFpsChange(
      frameRateFromSample(framesRef.current, elapsedRef.current),
    );
    elapsedRef.current = 0;
    framesRef.current = 0;
  });

  return null;
}

type ProjectionContentProps = {
  aspect: number;
  projectorId: number;
  media: MediaAsset[];
  tracks: TimelineTrack[];
  onTexture: (texture: THREE.Texture) => void;
};

function disposeProjectionMesh(mesh: THREE.Mesh) {
  const material = mesh.material as THREE.Material;
  if (material instanceof THREE.MeshBasicMaterial && material.map) {
    const texture = material.map;
    material.map = null;
    texture.dispose();
    texture.image = null;
  }
  const video = mesh.userData.video as HTMLVideoElement | undefined;
  if (video) {
    releaseVideoElement(video);
    delete mesh.userData.video;
  }
  material.dispose();
}

function ProjectionContent({
  aspect,
  projectorId,
  media,
  tracks,
  onTexture,
}: ProjectionContentProps) {
  const { gl } = useThree();
  const currentTime = useStudioStore((state) => state.currentTime);
  const playbackSpeed = useStudioStore((state) => state.playbackSpeed);
  const isPlaying = useStudioStore((state) => state.isPlaying);
  const target = useFBO(1024, 1024, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const renderScene = useMemo(() => new THREE.Scene(), []);
  const renderCamera = useMemo(
    () => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2),
    [],
  );
  const geometry = useMemo(() => {
    const [width, height] = projectionCookieSize(
      aspect,
      PROJECTOR_COOKIE_OVERSCAN,
    );
    return new THREE.PlaneGeometry(width, height);
  }, [aspect]);
  const meshes = useRef(new Map<number, THREE.Mesh>());
  const inactiveSince = useRef(new Map<number, number>());
  const clearColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    onTexture(target.texture);
  }, [onTexture, target.texture]);

  useEffect(() => {
    const clipIds = new Set(
      tracks
        .filter((track) => track.projectorId === projectorId)
        .flatMap((track) => track.clips.map((clip) => clip.id)),
    );
    for (const [clipId, mesh] of meshes.current.entries()) {
      if (!clipIds.has(clipId)) {
        renderScene.remove(mesh);
        disposeProjectionMesh(mesh);
        meshes.current.delete(clipId);
        inactiveSince.current.delete(clipId);
      }
    }
  }, [projectorId, renderScene, tracks]);

  useEffect(
    () => () => {
      geometry.dispose();
      target.dispose();
      for (const mesh of meshes.current.values()) {
        disposeProjectionMesh(mesh);
      }
      meshes.current.clear();
      inactiveSince.current.clear();
    },
    [geometry, target],
  );

  useFrame((state) => {
    const layers = activeLayers(tracks, media, projectorId, currentTime);
    const activeIds = new Set(layers.map((layer) => layer.clip.id));
    for (const clipId of inactiveResourceIds(meshes.current.keys(), activeIds)) {
      const mesh = meshes.current.get(clipId);
      if (!mesh) {
        continue;
      }
      mesh.visible = false;
      const video = mesh.userData.video as HTMLVideoElement | undefined;
      if (!video) {
        renderScene.remove(mesh);
        disposeProjectionMesh(mesh);
        meshes.current.delete(clipId);
        continue;
      }
      video.pause();
      if (!inactiveSince.current.has(clipId)) {
        inactiveSince.current.set(clipId, state.clock.elapsedTime);
      }
    }
    for (const clipId of expiredInactiveResourceIds(
      meshes.current.keys(),
      activeIds,
      inactiveSince.current,
      state.clock.elapsedTime,
      VIDEO_RESOURCE_RETENTION_SECONDS,
    )) {
      const mesh = meshes.current.get(clipId);
      if (mesh) {
        renderScene.remove(mesh);
        disposeProjectionMesh(mesh);
        meshes.current.delete(clipId);
        inactiveSince.current.delete(clipId);
      }
    }
    layers.forEach((layer, index) => {
      inactiveSince.current.delete(layer.clip.id);
      let mesh = meshes.current.get(layer.clip.id);
      if (!mesh) {
        let material: THREE.Material;
        if (layer.media.kind === "video" && layer.media.url) {
          const video = document.createElement("video");
          video.src = layer.media.url;
          video.muted = true;
          video.loop = layer.clip.loop;
          video.playsInline = true;
          video.preload = "auto";
          const texture = new THREE.VideoTexture(video);
          texture.colorSpace = THREE.SRGBColorSpace;
          material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
          });
          mesh = new THREE.Mesh(geometry, material);
          mesh.userData.video = video;
        } else {
          const colors = layer.media.generatorConfig.colors ?? [
            "#22d3ee",
            "#8b5cf6",
            "#ec4899",
          ];
          material = new THREE.ShaderMaterial({
            vertexShader: generatorVertexShader,
            fragmentShader: generatorFragmentShader,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            uniforms: {
              uTime: { value: 0 },
              uScale: { value: layer.media.generatorConfig.scale ?? 1 },
              uSeed: { value: layer.media.generatorConfig.seed ?? 1 },
              uIntensity: {
                value: layer.media.generatorConfig.intensity ?? 1,
              },
              uOpacity: { value: 1 },
              uKind: {
                value: ["plasma", "kaleidoscope", "tunnel", "particles", "grid"].indexOf(
                  layer.media.generatorType,
                ),
              },
              uColorA: { value: new THREE.Color(colors[0] ?? "#22d3ee") },
              uColorB: { value: new THREE.Color(colors[1] ?? "#8b5cf6") },
              uColorC: { value: new THREE.Color(colors[2] ?? "#ec4899") },
            },
          });
          mesh = new THREE.Mesh(geometry, material);
        }
        meshes.current.set(layer.clip.id, mesh);
        renderScene.add(mesh);
      }
      mesh.visible = true;
      mesh.renderOrder = index;
      const material = mesh.material as THREE.Material;
      material.blending =
        layer.track.blendMode === "add" || layer.track.blendMode === "screen"
          ? THREE.AdditiveBlending
          : layer.track.blendMode === "multiply"
            ? THREE.MultiplyBlending
            : THREE.NormalBlending;
      material.opacity = layer.opacity;
      if (material instanceof THREE.ShaderMaterial) {
        material.uniforms.uTime.value =
          layer.localTime *
          (layer.media.generatorConfig.speed ?? 1);
        material.uniforms.uScale.value =
          layer.media.generatorConfig.scale ?? 1;
        material.uniforms.uSeed.value =
          layer.media.generatorConfig.seed ?? 1;
        material.uniforms.uIntensity.value =
          layer.media.generatorConfig.intensity ?? 1;
        const colors = layer.media.generatorConfig.colors ?? [
          "#22d3ee",
          "#8b5cf6",
          "#ec4899",
        ];
        material.uniforms.uColorA.value.set(colors[0]);
        material.uniforms.uColorB.value.set(colors[1]);
        material.uniforms.uColorC.value.set(colors[2]);
        material.uniforms.uOpacity.value = layer.opacity;
      }
      const video = mesh.userData.video as HTMLVideoElement | undefined;
      if (video) {
        video.playbackRate = playbackSpeed * layer.clip.playbackRate;
        if (Math.abs(video.currentTime - layer.localTime) > 0.12) {
          video.currentTime = layer.localTime;
        }
        if (isPlaying && video.paused) {
          void video.play().catch(() => undefined);
        } else if (!isPlaying && !video.paused) {
          video.pause();
        }
      }
    });
    gl.getClearColor(clearColor);
    const clearAlpha = gl.getClearAlpha();
    gl.setRenderTarget(target);
    gl.setClearColor("#000000", 1);
    gl.clear(true, false, false);
    gl.render(renderScene, renderCamera);
    gl.setRenderTarget(null);
    gl.setClearColor(clearColor, clearAlpha);
  });
  return null;
}

function PrimitiveModel({
  asset,
}: {
  asset: ModelAsset;
}) {
  const size = asset.config.size ?? [1, 1, 1];
  const material = (
    <meshStandardMaterial
      color={asset.config.color ?? "#e2e8f0"}
      metalness={asset.config.metalness ?? 0.05}
      roughness={asset.config.roughness ?? 0.65}
    />
  );
  if (asset.primitiveType === "pediment") {
    return <PedimentModel material={material} size={size} />;
  }
  if (asset.primitiveType === "sphere") {
    return (
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[size[0] ?? 1, 48, 32]} />
        {material}
      </mesh>
    );
  }
  if (asset.primitiveType === "cylinder") {
    return (
      <mesh castShadow receiveShadow>
        <cylinderGeometry
          args={[size[0] ?? 0.5, size[2] ?? 0.5, size[1] ?? 2, 48]}
        />
        {material}
      </mesh>
    );
  }
  if (asset.primitiveType === "torus") {
    return (
      <mesh castShadow receiveShadow>
        <torusGeometry args={[size[0] ?? 1.5, size[2] ?? 0.4, 24, 80, Math.PI]} />
        {material}
      </mesh>
    );
  }
  if (asset.primitiveType === "plane") {
    return (
      <mesh castShadow receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[size[0] ?? 2, size[2] ?? 2]} />
        {material}
      </mesh>
    );
  }
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[size[0] ?? 1, size[1] ?? 1, size[2] ?? 1]} />
      {material}
    </mesh>
  );
}

function PedimentModel({
  material,
  size,
}: {
  material: React.ReactNode;
  size: number[];
}) {
  const geometry = useMemo(() => {
    const width = size[0] ?? 2;
    const height = size[1] ?? 1;
    const depth = size[2] ?? 1;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(0, height / 2);
    shape.closePath();
    const value = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      depth,
    });
    value.translate(0, 0, -depth / 2);
    return value;
  }, [size]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh castShadow receiveShadow geometry={geometry}>
      {material}
    </mesh>
  );
}

function GlbModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);
  return <primitive object={scene} />;
}

function ProjectorFixture({
  sceneObject,
  template,
  media,
  tracks,
  showBounds,
  showProjectionContour,
  showProjectedSurfaces,
  showVolumetricLight,
  blackout,
}: {
  sceneObject: SceneObject;
  template: EquipmentTemplate;
  media: MediaAsset[];
  tracks: TimelineTrack[];
  showBounds: boolean;
  showProjectionContour: boolean;
  showProjectedSurfaces: boolean;
  showVolumetricLight: boolean;
  blackout: boolean;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const spotRef = useRef<THREE.SpotLight>(null);
  const resolution = template.specs.resolution as number[];
  const aspect = (resolution?.[0] ?? 1920) / (resolution?.[1] ?? 1080);
  const throwRatio =
    Number(sceneObject.properties.throwRatio) ||
    Number(template.specs.throwRatio) ||
    1.5;
  const referenceDistance = 10;
  const projectionWidth =
    Number(sceneObject.properties.projectionWidth) ||
    referenceDistance / throwRatio;
  const fov = projectionWidthToFov(
    projectionWidth,
    aspect,
    referenceDistance,
  );
  const diagonalHalfAngle = (fov.diagonal * Math.PI) / 360;
  const overscannedHalfAngle = Math.atan(
    Math.tan(diagonalHalfAngle) * PROJECTOR_COOKIE_OVERSCAN,
  );
  const near = Number(template.specs.near) || 0.2;
  const far = Number(template.specs.far) || 30;
  useEffect(() => {
    const spot = spotRef.current;
    if (spot) {
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.aspect = 1;
      spot.shadow.focus = 1;
      spot.shadow.camera.near = near;
      spot.shadow.camera.far = far;
      spot.shadow.bias = -0.0002;
      spot.shadow.normalBias = 0.015;
      spot.shadow.needsUpdate = true;
    }
  }, [far, fov.diagonal, fov.vertical, near]);
  return (
    <>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.34, 0.85]} />
        <meshStandardMaterial
          color="#151b2b"
          metalness={0.7}
          roughness={0.28}
        />
      </mesh>
      <mesh position={[0, 0, -0.47]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.16, 0.2, 0.16, 32]} />
        <meshStandardMaterial
          color="#090d18"
          metalness={0.85}
          roughness={0.12}
        />
      </mesh>
      <primitive object={target} position={[0, 0, -10]} />
      <spotLight
        ref={spotRef}
        castShadow
        target={target}
        map={texture ?? undefined}
        angle={overscannedHalfAngle}
        penumbra={RECTANGULAR_PROJECTOR_PENUMBRA}
        power={
          blackout
            ? 0
            : (Number(sceneObject.properties.lumens) ||
                Number(template.specs.lumens) ||
                5000) * 3
        }
        distance={far}
        decay={2}
      />
      {showBounds ? (
        <ProjectorBounds
          aspect={aspect}
          far={far}
          near={near}
          stopAtSurfaces={showProjectedSurfaces || showProjectionContour}
          verticalFov={fov.vertical}
        />
      ) : null}
      {showProjectedSurfaces || showProjectionContour ? (
        <ProjectedSurfaceMeshes
          aspect={aspect}
          far={far}
          near={near}
          projectorRef={spotRef}
          showContour={showProjectionContour}
          showSurface={showProjectedSurfaces}
          verticalFov={fov.vertical}
        />
      ) : null}
      <ProjectionContent
        aspect={aspect}
        media={media}
        onTexture={setTexture}
        projectorId={sceneObject.id}
        tracks={tracks}
      />
      {showVolumetricLight ? (
        <ProjectorVolume
          aspect={aspect}
          far={far}
          intensity={
            Number(sceneObject.properties.volumeIntensity) ||
            DEFAULT_VOLUME_INTENSITY
          }
          near={near}
          projectionTexture={texture}
          projectorRef={spotRef}
          volumeFalloff={
            Number(sceneObject.properties.volumeFalloff) ||
            DEFAULT_VOLUME_FALLOFF
          }
          verticalFov={fov.vertical}
        />
      ) : null}
    </>
  );
}

function ProjectorVolume({
  aspect,
  far,
  intensity,
  near,
  projectionTexture,
  projectorRef,
  volumeFalloff,
  verticalFov,
}: {
  aspect: number;
  far: number;
  intensity: number;
  near: number;
  projectionTexture: THREE.Texture | null;
  projectorRef: RefObject<THREE.SpotLight | null>;
  volumeFalloff: number;
  verticalFov: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { scene } = useThree();
  const frame = useRef(0);
  const signature = useRef("");
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const cookieScale = useMemo(() => {
    const [width, height] = projectionCookieSize(
      aspect,
      PROJECTOR_COOKIE_OVERSCAN,
    );
    return new THREE.Vector2(width / 2, height / 2);
  }, [aspect]);
  const material = useMemo(() => {
    const value = new THREE.ShaderMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fragmentShader: `
          varying float vBeamProgress;
          varying vec2 vBeamUv;
          uniform sampler2D uProjectionTexture;
          uniform vec2 uCookieScale;
          uniform float uCellSmoothing;
          uniform float uVolumeFalloff;
          uniform float uVolumeIntensity;
          void main() {
            vec2 cookieUv = vec2(0.5) + (vBeamUv - vec2(0.5)) * uCookieScale;
            vec2 smoothing = fwidth(cookieUv) * uCellSmoothing;
            vec3 beamColor = (
              texture2D(uProjectionTexture, cookieUv).rgb * 4.0
              + texture2D(
                uProjectionTexture,
                cookieUv + vec2(smoothing.x, 0.0)
              ).rgb
              + texture2D(
                uProjectionTexture,
                cookieUv - vec2(smoothing.x, 0.0)
              ).rgb
              + texture2D(
                uProjectionTexture,
                cookieUv + vec2(0.0, smoothing.y)
              ).rgb
              + texture2D(
                uProjectionTexture,
                cookieUv - vec2(0.0, smoothing.y)
              ).rgb
            ) / 8.0;
            float fade = pow(
              max(0.0, 1.0 - vBeamProgress),
              uVolumeFalloff
            );
            gl_FragColor = vec4(
              beamColor,
              uVolumeIntensity * fade
            );
          }
        `,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: {
        uCellSmoothing: { value: VOLUME_CELL_SMOOTHING },
        uCookieScale: { value: cookieScale },
        uProjectionTexture: { value: projectionTexture },
        uVolumeFalloff: { value: volumeFalloff },
        uVolumeIntensity: { value: intensity },
      },
      vertexShader: `
          attribute float beamProgress;
          attribute vec2 beamUv;
          varying float vBeamProgress;
          varying vec2 vBeamUv;
          void main() {
            vBeamProgress = beamProgress;
            vBeamUv = beamUv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
    });
    value.toneMapped = false;
    return value;
  }, [cookieScale, intensity, projectionTexture, volumeFalloff]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    frame.current += 1;
    const group = groupRef.current;
    const mesh = meshRef.current;
    const projector = projectorRef.current;
    if (frame.current % 15 !== 0 || !group || !mesh || !projector) {
      return;
    }
    projector.updateWorldMatrix(true, false);
    group.updateWorldMatrix(true, false);
    const receivers: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.geometry) {
        return;
      }
      let parent: THREE.Object3D | null = object;
      while (parent) {
        if (parent.userData.stageHelper) {
          return;
        }
        if (parent.userData.sceneObjectType === "model") {
          object.updateWorldMatrix(true, false);
          receivers.push(object);
          return;
        }
        parent = parent.parent;
      }
    });
    const nextSignature = [
      group.matrixWorld.elements.join(","),
      ...receivers.map(
        (receiver) =>
          `${receiver.uuid}:${receiver.matrixWorld.elements.join(",")}`,
      ),
    ].join("|");
    if (signature.current === nextSignature) {
      return;
    }
    signature.current = nextSignature;
    const origin = group.getWorldPosition(new THREE.Vector3());
    const halfHeight = Math.tan((verticalFov * Math.PI) / 360);
    const columns = VOLUME_GRID_COLUMNS;
    const rows = VOLUME_GRID_ROWS;
    const nearPoints: THREE.Vector3[] = [];
    const farPoints: THREE.Vector3[] = [];
    const raycaster = new THREE.Raycaster();
    for (let row = 0; row < rows; row += 1) {
      const vertical = 1 - (row / (rows - 1)) * 2;
      for (let column = 0; column < columns; column += 1) {
        const horizontal = (column / (columns - 1)) * 2 - 1;
        const cameraDirection = new THREE.Vector3(
          horizontal * halfHeight * aspect,
          vertical * halfHeight,
          -1,
        ).normalize();
        const worldDirection = cameraDirection
          .clone()
          .transformDirection(group.matrixWorld);
        const farDistance = far / -cameraDirection.z;
        raycaster.set(origin, worldDirection);
        raycaster.far = farDistance;
        const hit = raycaster
          .intersectObjects(receivers, false)
          .find((intersection) => intersection.distance > near);
        nearPoints.push(
          cameraDirection
            .clone()
            .multiplyScalar(near / -cameraDirection.z),
        );
        farPoints.push(
          cameraDirection
            .clone()
            .multiplyScalar(
              Math.min(hit?.distance ?? farDistance, farDistance),
            ),
        );
      }
    }
    const nextGeometry = buildProjectionVolumeGeometry(
      nearPoints,
      farPoints,
      columns,
      rows,
    );
    mesh.geometry.dispose();
    mesh.geometry = nextGeometry;
  });

  return (
    <group ref={groupRef} userData={{ stageHelper: true }}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        raycast={() => undefined}
        renderOrder={7}
      />
    </group>
  );
}

function ProjectedSurfaceMeshes({
  aspect,
  far,
  near,
  projectorRef,
  showContour,
  showSurface,
  verticalFov,
}: {
  aspect: number;
  far: number;
  near: number;
  projectorRef: RefObject<THREE.SpotLight | null>;
  showContour: boolean;
  showSurface: boolean;
  verticalFov: number;
}) {
  const { scene } = useThree();
  const frame = useRef(0);
  const entries = useRef(
    new Map<
      string,
      {
        source: THREE.Mesh;
        surface: THREE.Mesh;
        contour: LineSegments2;
        signature: string;
      }
    >(),
  );
  const surfaceMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: "#dffcff",
        depthWrite: false,
        opacity: 0.55,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        side: THREE.DoubleSide,
        toneMapped: false,
        transparent: true,
      }),
    [],
  );
  const contourMaterial = useMemo(
    () =>
      new LineMaterial({
        color: PROJECTION_CONTOUR_COLOR,
        depthWrite: false,
        linewidth: PROJECTION_CONTOUR_WIDTH,
        worldUnits: false,
      }),
    [],
  );

  useEffect(() => {
    for (const entry of entries.current.values()) {
      entry.surface.visible = showSurface;
      entry.contour.visible = showContour;
    }
  }, [showContour, showSurface]);

  useEffect(() => {
    const currentEntries = entries.current;
    return () => {
      for (const entry of currentEntries.values()) {
        entry.source.remove(entry.surface, entry.contour);
        entry.surface.geometry.dispose();
        entry.contour.geometry.dispose();
      }
      currentEntries.clear();
      surfaceMaterial.dispose();
      contourMaterial.dispose();
    };
  }, [contourMaterial, surfaceMaterial]);

  useFrame(() => {
    frame.current += 1;
    const projector = projectorRef.current;
    if (frame.current % 10 !== 0 || !projector) {
      return;
    }
    projector.updateWorldMatrix(true, false);
    projector.target.updateWorldMatrix(true, false);
    projector.shadow.updateMatrices(projector);
    const projectorMatrix = projector.shadow.camera.matrixWorld;
    const projectorSignature = projectorMatrix.elements.join(",");
    const receivers: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !object.geometry) {
        return;
      }
      let parent: THREE.Object3D | null = object;
      while (parent) {
        if (parent.userData.stageHelper) {
          return;
        }
        if (parent.userData.sceneObjectType === "model") {
          receivers.push(object);
          return;
        }
        parent = parent.parent;
      }
    });
    const active = new Set(receivers.map((receiver) => receiver.uuid));
    for (const source of receivers) {
      source.updateWorldMatrix(true, false);
      const signature = `${projectorSignature}|${source.matrixWorld.elements.join(",")}|${source.geometry.uuid}`;
      const existing = entries.current.get(source.uuid);
      if (existing?.signature === signature) {
        continue;
      }
      if (existing) {
        source.remove(existing.surface, existing.contour);
        existing.surface.geometry.dispose();
        existing.contour.geometry.dispose();
      }
      const geometry = buildProjectedSurfaceGeometry(
        source,
        projectorMatrix,
        { aspect, far, near, verticalFov },
      );
      const surface = new THREE.Mesh(geometry, surfaceMaterial);
      const edges = new THREE.EdgesGeometry(geometry, 1);
      const contourGeometry = new LineSegmentsGeometry();
      contourGeometry.setPositions(
        edges.getAttribute("position").array as Float32Array,
      );
      edges.dispose();
      const contour = new LineSegments2(contourGeometry, contourMaterial);
      surface.renderOrder = 8;
      surface.visible = showSurface;
      surface.userData.stageHelper = true;
      surface.raycast = () => undefined;
      contour.renderOrder = 9;
      contour.visible = showContour;
      contour.userData.stageHelper = true;
      contour.raycast = () => undefined;
      source.add(surface, contour);
      entries.current.set(source.uuid, {
        source,
        surface,
        contour,
        signature,
      });
    }
    for (const [id, entry] of entries.current) {
      if (!active.has(id)) {
        entry.source.remove(entry.surface, entry.contour);
        entry.surface.geometry.dispose();
        entry.contour.geometry.dispose();
        entries.current.delete(id);
      }
    }
  });

  return null;
}

function LightFixture({
  sceneObject,
  template,
  showBounds,
  blackout,
}: {
  sceneObject: SceneObject;
  template: EquipmentTemplate;
  showBounds: boolean;
  blackout: boolean;
}) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const settings = resolveLightSettings(
    sceneObject.properties,
    template.specs,
  );
  const directionalIntensity = settings.lumens / 10000;
  const areaIntensity =
    settings.lumens / (settings.width * settings.height * 1000);
  return (
    <>
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.32, 0.7, 24]} />
        <meshStandardMaterial color="#1a1d27" metalness={0.72} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, -0.36]}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial
          color={settings.color}
          emissive={settings.color}
          emissiveIntensity={blackout ? 0 : 0.8}
        />
      </mesh>
      <primitive object={target} position={[0, 0, -settings.range]} />
      {settings.lightType === "spot" ? (
        <spotLight
          angle={(settings.beamAngle * Math.PI) / 360}
          castShadow={settings.castShadow}
          color={settings.color}
          decay={settings.decay}
          distance={settings.range}
          penumbra={settings.penumbra}
          power={blackout ? 0 : settings.lumens}
          target={target}
        />
      ) : null}
      {settings.lightType === "point" ? (
        <pointLight
          castShadow={settings.castShadow}
          color={settings.color}
          decay={settings.decay}
          distance={settings.range}
          power={blackout ? 0 : settings.lumens}
        />
      ) : null}
      {settings.lightType === "directional" ? (
        <directionalLight
          castShadow={settings.castShadow}
          color={settings.color}
          intensity={blackout ? 0 : directionalIntensity}
          target={target}
        />
      ) : null}
      {settings.lightType === "area" ? (
        <rectAreaLight
          color={settings.color}
          height={settings.height}
          intensity={blackout ? 0 : areaIntensity}
          width={settings.width}
        />
      ) : null}
      {showBounds ? <LightBounds settings={settings} /> : null}
    </>
  );
}

function ProjectorBounds({
  aspect,
  far,
  near,
  stopAtSurfaces,
  verticalFov,
}: {
  aspect: number;
  far: number;
  near: number;
  stopAtSurfaces: boolean;
  verticalFov: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useThree();
  const frame = useRef(0);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const staticSegments = useMemo(
    () => projectionFrustumSegments({ aspect, far, near, verticalFov }),
    [aspect, far, near, verticalFov],
  );

  useEffect(() => {
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(staticSegments, 3),
    );
    geometry.computeBoundingSphere();
  }, [geometry, staticSegments]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    frame.current += 1;
    const group = groupRef.current;
    if (!stopAtSurfaces || frame.current % 10 !== 0 || !group) {
      return;
    }
    group.updateWorldMatrix(true, false);
    const origin = group.getWorldPosition(new THREE.Vector3());
    const halfHeight = Math.tan((verticalFov * Math.PI) / 360);
    const cornerSigns: [number, number][] = [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ];
    const raycaster = new THREE.Raycaster();
    const nearCorners: [number, number, number][] = [];
    const farCorners: [number, number, number][] = [];
    for (const [horizontal, vertical] of cornerSigns) {
      const cameraDirection = new THREE.Vector3(
        horizontal * halfHeight * aspect,
        vertical * halfHeight,
        -1,
      ).normalize();
      const worldDirection = cameraDirection
        .clone()
        .transformDirection(group.matrixWorld);
      const farDistance = far / -cameraDirection.z;
      raycaster.set(origin, worldDirection);
      raycaster.far = farDistance;
      const hit = raycaster
        .intersectObjects(scene.children, true)
        .find((intersection) => {
          let parent: THREE.Object3D | null = intersection.object;
          while (parent) {
            if (parent.userData.stageHelper) {
              return false;
            }
            if (parent.userData.sceneObjectType === "model") {
              return true;
            }
            parent = parent.parent;
          }
          return false;
        });
      const nearPoint = cameraDirection
        .clone()
        .multiplyScalar(near / -cameraDirection.z);
      const farPoint = cameraDirection
        .clone()
        .multiplyScalar(
          Math.min(hit?.distance ?? farDistance, farDistance),
        );
      nearCorners.push([nearPoint.x, nearPoint.y, nearPoint.z]);
      farCorners.push([farPoint.x, farPoint.y, farPoint.z]);
    }
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        frustumSegmentsFromCorners(
          nearCorners as [
            [number, number, number],
            [number, number, number],
            [number, number, number],
            [number, number, number],
          ],
          farCorners as [
            [number, number, number],
            [number, number, number],
            [number, number, number],
            [number, number, number],
          ],
        ),
        3,
      ),
    );
    geometry.computeBoundingSphere();
  });

  return (
    <group ref={groupRef} userData={{ stageHelper: true }}>
      <lineSegments geometry={geometry} renderOrder={10}>
        <lineBasicMaterial
          color="#22d3ee"
          depthTest={false}
          opacity={0.8}
          toneMapped={false}
          transparent
        />
      </lineSegments>
    </group>
  );
}

function LightBounds({
  settings,
}: {
  settings: ReturnType<typeof resolveLightSettings>;
}) {
  if (settings.lightType === "point") {
    return (
      <mesh renderOrder={9}>
        <sphereGeometry args={[settings.range, 24, 16]} />
        <meshBasicMaterial
          color={settings.color}
          depthWrite={false}
          opacity={0.25}
          transparent
          wireframe
        />
      </mesh>
    );
  }
  if (settings.lightType === "spot") {
    return (
      <mesh position={[0, 0, -settings.range / 2]} rotation-x={Math.PI / 2}>
        <coneGeometry
          args={[
            lightConeRadius(settings.range, settings.beamAngle),
            settings.range,
            32,
            1,
            true,
          ]}
        />
        <meshBasicMaterial
          color={settings.color}
          depthWrite={false}
          opacity={0.3}
          transparent
          wireframe
        />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 0, -settings.range / 2]}>
      <boxGeometry
        args={[
          settings.lightType === "directional"
            ? Math.max(2, settings.width)
            : settings.width,
          settings.lightType === "directional"
            ? Math.max(2, settings.height)
            : settings.height,
          settings.range,
        ]}
      />
      <meshBasicMaterial
        color={settings.color}
        depthWrite={false}
        opacity={0.25}
        transparent
        wireframe
      />
    </mesh>
  );
}

function CameraFixture() {
  return (
    <>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.38, 0.72]} />
        <meshStandardMaterial color="#161923" metalness={0.68} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, -0.43]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.14, 0.18, 0.25, 32]} />
        <meshStandardMaterial color="#090b12" metalness={0.88} roughness={0.1} />
      </mesh>
    </>
  );
}

function SceneNode({
  sceneObject,
  model,
  equipment,
  media,
  tracks,
  showLightBounds,
  showProjectionContour,
  showProjectorBounds,
  showProjectedSurfaces,
  showVolumetricLight,
  blackout,
}: {
  sceneObject: SceneObject;
  model?: ModelAsset;
  equipment?: EquipmentTemplate;
  media: MediaAsset[];
  tracks: TimelineTrack[];
  showLightBounds: boolean;
  showProjectionContour: boolean;
  showProjectorBounds: boolean;
  showProjectedSurfaces: boolean;
  showVolumetricLight: boolean;
  blackout: boolean;
}) {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const transformRef = useRef<ComponentRef<typeof TransformControls>>(null);
  const setGroupRef = useCallback((value: THREE.Group | null) => {
    setGroup(value);
  }, []);
  const selectedObjectId = useStudioStore((state) => state.selectedObjectId);
  const selectObject = useStudioStore((state) => state.selectObject);
  const patchSceneObject = useStudioStore((state) => state.patchSceneObject);
  const transformMode = useStudioStore((state) => state.transformMode);
  const isSelected = selectedObjectId === sceneObject.id;

  useLayoutEffect(() => {
    const controls = transformRef.current;
    if (!isSelected || !group || !controls) {
      return;
    }
    group.updateMatrix();
    group.updateWorldMatrix(true, true);
    controls.attach(group);
    controls.updateMatrixWorld();
  }, [
    group,
    isSelected,
    sceneObject.position.x,
    sceneObject.position.y,
    sceneObject.position.z,
  ]);

  const saveTransform = () => {
    if (!group) {
      return;
    }
    void patchSceneObject(sceneObject.id, {
      position: { x: group.position.x, y: group.position.y, z: group.position.z },
      rotation: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z },
      scale: { x: group.scale.x, y: group.scale.y, z: group.scale.z },
    });
  };
  return (
    <>
      <group
        ref={setGroupRef}
        userData={{ sceneObjectType: sceneObject.objectType }}
        visible={sceneObject.visible}
        position={[
          sceneObject.position.x,
          sceneObject.position.y,
          sceneObject.position.z,
        ]}
        rotation={[
          sceneObject.rotation.x,
          sceneObject.rotation.y,
          sceneObject.rotation.z,
        ]}
        scale={[sceneObject.scale.x, sceneObject.scale.y, sceneObject.scale.z]}
        onClick={(event) => {
          event.stopPropagation();
          selectObject(sceneObject.id);
        }}
      >
        {model?.kind === "primitive" ? <PrimitiveModel asset={model} /> : null}
        {model?.kind === "glb" && model.url ? <GlbModel url={model.url} /> : null}
        {equipment?.category === "projector" ? (
          <ProjectorFixture
            blackout={blackout}
            media={media}
            sceneObject={sceneObject}
            showBounds={showProjectorBounds}
            showProjectionContour={showProjectionContour}
            showProjectedSurfaces={showProjectedSurfaces}
            showVolumetricLight={showVolumetricLight}
            template={equipment}
            tracks={tracks}
          />
        ) : null}
        {equipment?.category === "light" ? (
          <LightFixture
            blackout={blackout}
            sceneObject={sceneObject}
            showBounds={showLightBounds}
            template={equipment}
          />
        ) : null}
        {equipment?.category === "camera" ? <CameraFixture /> : null}
        {isSelected ? (
          <Html center position={[0, 0.65, 0]} pointerEvents="none">
            <span className="whitespace-nowrap rounded-md bg-background/90 px-2 py-1 text-xs shadow-sm">
              {sceneObject.name}
            </span>
          </Html>
        ) : null}
      </group>
      {isSelected && group ? (
        <TransformControls
          mode={transformMode}
          object={group}
          onMouseUp={saveTransform}
          ref={transformRef}
          size={0.7}
          space={transformSpace(transformMode)}
        />
      ) : null}
    </>
  );
}

function StageObjects({
  blackout,
  equipment,
  media,
  models,
  sceneObjects,
  showLightBounds,
  showProjectionContour,
  showProjectorBounds,
  showProjectedSurfaces,
  showVolumetricLight,
  tracks,
}: {
  blackout: boolean;
  equipment: EquipmentTemplate[];
  media: MediaAsset[];
  models: ModelAsset[];
  sceneObjects: SceneObject[];
  showLightBounds: boolean;
  showProjectionContour: boolean;
  showProjectorBounds: boolean;
  showProjectedSurfaces: boolean;
  showVolumetricLight: boolean;
  tracks: TimelineTrack[];
}) {
  return sceneObjects.map((sceneObject) => (
    <SceneNode
      blackout={blackout}
      equipment={equipment.find(
        (item) => item.id === sceneObject.equipmentTemplateId,
      )}
      key={sceneObject.id}
      media={media}
      model={models.find((item) => item.id === sceneObject.modelAssetId)}
      sceneObject={sceneObject}
      showLightBounds={showLightBounds}
      showProjectionContour={showProjectionContour}
      showProjectorBounds={showProjectorBounds}
      showProjectedSurfaces={showProjectedSurfaces}
      showVolumetricLight={showVolumetricLight}
      tracks={tracks}
    />
  ));
}

function ActiveStageCamera({
  sceneObjects,
  equipment,
}: {
  sceneObjects: SceneObject[];
  equipment: EquipmentTemplate[];
}) {
  const activeCameraId = useStudioStore((state) => state.activeCameraId);
  const sceneObject = sceneObjects.find((item) => item.id === activeCameraId);
  const template = equipment.find(
    (item) => item.id === sceneObject?.equipmentTemplateId,
  );
  if (!sceneObject || !template) {
    return null;
  }
  const sensorWidth = Number(template.specs.sensorWidth) || 36;
  const focalLength =
    Number(sceneObject.properties.focalLength) ||
    Number(template.specs.focalLength) ||
    35;
  return (
    <PerspectiveCamera
      far={STAGE_CAMERA_FAR}
      fov={cameraVerticalFov(sensorWidth, focalLength, 16 / 9)}
      makeDefault
      near={STAGE_CAMERA_NEAR}
      position={[
        sceneObject.position.x,
        sceneObject.position.y,
        sceneObject.position.z,
      ]}
      rotation={[
        sceneObject.rotation.x,
        sceneObject.rotation.y,
        sceneObject.rotation.z,
      ]}
    />
  );
}

function PersistentFreeCamera() {
  const controlsRef = useRef<ComponentRef<typeof CameraControls>>(null);
  const project = useStudioStore((state) => state.workspace?.project);
  const activeCameraId = useStudioStore((state) => state.activeCameraId);
  const patchProject = useStudioStore((state) => state.patchProject);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !project || activeCameraId !== null) {
      return;
    }
    const position = project.freeCameraPosition;
    const target = project.freeCameraTarget;
    void controls.setLookAt(
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      false,
    );
  }, [
    activeCameraId,
    project,
    project?.freeCameraPosition,
    project?.freeCameraTarget,
  ]);
  if (activeCameraId !== null) {
    return null;
  }

  return (
    <CameraControls
      dollySpeed={STAGE_CAMERA_DOLLY_SPEED}
      enabled={activeCameraId === null}
      makeDefault
      onEnd={() => {
        const controls = controlsRef.current;
        if (!controls || !project || activeCameraId !== null) {
          return;
        }
        const target = controls.getTarget(new THREE.Vector3());
        const position = controls.camera.position;
        void patchProject({
          freeCameraPosition: {
            x: position.x,
            y: position.y,
            z: position.z,
          },
          freeCameraTarget: { x: target.x, y: target.y, z: target.z },
        });
      }}
      ref={controlsRef}
    />
  );
}

export function StageCanvas({
  onFpsChange,
  showGrid = true,
  showLightBounds = false,
  showProjectionContour = false,
  showProjectorBounds = false,
  showProjectedSurfaces = false,
  showVolumetricLight = false,
}: {
  onFpsChange: (fps: number) => void;
  showGrid?: boolean;
  showLightBounds?: boolean;
  showProjectionContour?: boolean;
  showProjectorBounds?: boolean;
  showProjectedSurfaces?: boolean;
  showVolumetricLight?: boolean;
}) {
  const workspace = useStudioStore((state) => state.workspace);
  const selectObject = useStudioStore((state) => state.selectObject);
  const isBlackout = useStudioStore((state) => state.isBlackout);
  if (!workspace) {
    return null;
  }
  const freeCameraPosition = workspace.project.freeCameraPosition;
  return (
    <Canvas
      camera={{
        position: [
          freeCameraPosition.x,
          freeCameraPosition.y,
          freeCameraPosition.z,
        ],
        fov: 45,
        near: STAGE_CAMERA_NEAR,
        far: STAGE_CAMERA_FAR,
      }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
      }}
      onPointerMissed={() => selectObject(null)}
      shadows={STAGE_SHADOW_MAP}
    >
      <color attach="background" args={["#070a12"]} />
      <ambientLight
        color={workspace.project.ambientColor}
        intensity={workspace.project.ambientIntensity}
      />
      <FrameRateMonitor onFpsChange={onFpsChange} />
      <Suspense fallback={null}>
        <StageObjects
          blackout={isBlackout}
          equipment={workspace.equipment}
          media={workspace.media}
          models={workspace.models}
          sceneObjects={workspace.sceneObjects}
          showLightBounds={showLightBounds}
          showProjectionContour={showProjectionContour}
          showProjectorBounds={showProjectorBounds}
          showProjectedSurfaces={showProjectedSurfaces}
          showVolumetricLight={showVolumetricLight}
          tracks={workspace.tracks}
        />
      </Suspense>
      {showGrid ? (
        <Grid
          args={[
            workspace.project.stageWidth * 2,
            workspace.project.stageDepth * 2,
          ]}
          cellColor="#263246"
          cellSize={0.5}
          fadeDistance={32}
          sectionColor="#3e587a"
          sectionSize={2}
        />
      ) : null}
      <ActiveStageCamera
        equipment={workspace.equipment}
        sceneObjects={workspace.sceneObjects}
      />
      <PersistentFreeCamera />
    </Canvas>
  );
}
