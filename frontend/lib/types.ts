export type Vec3 = { x: number; y: number; z: number };

export type TransformMode = "translate" | "rotate";

export type Project = {
  id: string;
  name: string;
  duration: number;
  frameRate: number;
  stageWidth: number;
  stageDepth: number;
  stageHeight: number;
  ambientColor: string;
  ambientIntensity: number;
  freeCameraPosition: Vec3;
  freeCameraTarget: Vec3;
  createdAt: string;
  updatedAt: string;
};

export type MediaAsset = {
  id: number;
  projectId: string;
  name: string;
  kind: "video" | "generator";
  url: string | null;
  mimeType: string;
  duration: number;
  width: number;
  height: number;
  generatorType: GeneratorType | "";
  generatorConfig: {
    colors?: string[];
    speed?: number;
    scale?: number;
    intensity?: number;
    seed?: number;
  };
};

export type GeneratorType =
  | "plasma"
  | "kaleidoscope"
  | "tunnel"
  | "particles"
  | "grid";

export type ModelAsset = {
  id: number;
  projectId: string;
  name: string;
  kind: "primitive" | "glb";
  primitiveType:
    | "box"
    | "sphere"
    | "cylinder"
    | "torus"
    | "plane"
    | "pediment"
    | "";
  url: string | null;
  config: {
    size?: number[];
    color?: string;
    roughness?: number;
    metalness?: number;
  };
};

export type EquipmentTemplate = {
  id: number;
  name: string;
  slug: string;
  category: "projector" | "light" | "camera";
  specs: Record<string, string | number | boolean | number[]>;
  isSeeded: boolean;
};

export type SceneObject = {
  id: number;
  projectId: string;
  name: string;
  objectType: "model" | "equipment";
  modelAssetId: number | null;
  equipmentTemplateId: number | null;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  properties: Record<string, string | number | boolean>;
  visible: boolean;
};

export type TimelineClip = {
  id: number;
  trackId: number;
  mediaAssetId: number;
  start: number;
  duration: number;
  inPoint: number;
  playbackRate: number;
  loop: boolean;
  opacity: number;
  fadeIn: number;
  fadeOut: number;
};

export type TimelineTrack = {
  id: number;
  projectId: string;
  projectorId: number;
  name: string;
  order: number;
  opacity: number;
  blendMode: "normal" | "add" | "screen" | "multiply";
  clips: TimelineClip[];
};

export type Workspace = {
  project: Project;
  media: MediaAsset[];
  models: ModelAsset[];
  equipment: EquipmentTemplate[];
  sceneObjects: SceneObject[];
  tracks: TimelineTrack[];
};

export type SaveState = "saved" | "saving" | "error";
