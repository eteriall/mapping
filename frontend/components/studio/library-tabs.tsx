"use client";

import {
  BoxIcon,
  CameraIcon,
  LightbulbIcon,
  PlusIcon,
  ProjectorIcon,
  SparklesIcon,
  UploadIcon,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/api";
import { useStudioStore } from "@/lib/studio-store";
import { MediaScrubPreview } from "@/components/studio/media-scrub-preview";
import type {
  EquipmentTemplate,
  MediaAsset,
  ModelAsset,
  SceneObject,
  Workspace,
} from "@/lib/types";

export function SceneHierarchy() {
  const workspace = useStudioStore((state) => state.workspace);
  const selectedObjectId = useStudioStore((state) => state.selectedObjectId);
  const selectObject = useStudioStore((state) => state.selectObject);
  if (!workspace) {
    return null;
  }
  const groups = [
    {
      name: "Models",
      items: workspace.sceneObjects.filter((item) => item.objectType === "model"),
    },
    {
      name: "Projectors",
      items: objectsByEquipmentCategory(workspace, "projector"),
    },
    {
      name: "Lights",
      items: objectsByEquipmentCategory(workspace, "light"),
    },
    {
      name: "Cameras",
      items: objectsByEquipmentCategory(workspace, "camera"),
    },
  ];
  return (
    <aside className="flex h-full min-h-0 flex-col border-r bg-card">
      <div className="border-b p-4">
        <h2 className="font-medium">Scene hierarchy</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {workspace.sceneObjects.length} placed objects
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.map((group) => (
          <div className="mb-4 flex flex-col gap-1" key={group.name}>
            <span className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.name}
            </span>
            {group.items.map((item) => (
              <Button
                className="justify-start"
                key={item.id}
                onClick={() => selectObject(item.id)}
                variant={selectedObjectId === item.id ? "secondary" : "ghost"}
              >
                <span className="truncate">{item.name}</span>
              </Button>
            ))}
            {group.items.length === 0 ? (
              <span className="px-2 py-1 text-xs text-muted-foreground">
                Nothing placed
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
}

export function MediaLibrary() {
  const workspace = useStudioStore((state) => state.workspace);
  const addMedia = useStudioStore((state) => state.addMedia);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!workspace) {
    return null;
  }

  async function uploadVideo(file: File) {
    const formData = new FormData();
    formData.append("uploaded_file", file);
    try {
      const media = await apiRequest<MediaAsset>(
        `/projects/${workspace!.project.id}/media/videos`,
        { method: "POST", body: formData },
      );
      addMedia(media);
      toast.success(`${media.name} uploaded.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload video.",
      );
    }
  }

  async function createGenerator() {
    try {
      const media = await apiRequest<MediaAsset>(
        `/projects/${workspace!.project.id}/media/generators`,
        {
          method: "POST",
          body: JSON.stringify({
            name: `New Plasma ${workspace!.media.length + 1}`,
            generator_type: "plasma",
            generator_config: {
              colors: ["#22d3ee", "#8b5cf6", "#ec4899"],
              speed: 0.8,
              scale: 1,
              intensity: 1,
              seed: Date.now() % 10000,
            },
          }),
        },
      );
      addMedia(media);
      toast.success("Generator created.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create generator.",
      );
    }
  }

  return (
    <LibraryPage
      actions={
        <>
          <input
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadVideo(file);
              }
              event.target.value = "";
            }}
            ref={fileInput}
            type="file"
          />
          <Button onClick={() => fileInput.current?.click()} variant="outline">
            <UploadIcon data-icon="inline-start" />
            Upload video
          </Button>
          <Button onClick={() => void createGenerator()}>
            <SparklesIcon data-icon="inline-start" />
            New generator
          </Button>
        </>
      }
      description="Upload video or drag procedural content directly onto projector layers."
      title="Media"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {workspace.media.map((asset) => (
          <Card
            draggable
            key={asset.id}
            onDragStart={(event) => {
              event.dataTransfer.setData("media-asset-id", String(asset.id));
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            <CardHeader>
              <CardTitle>{asset.name}</CardTitle>
              <CardDescription>
                {asset.kind === "generator"
                  ? `${asset.generatorType} · procedural`
                  : asset.mimeType}
              </CardDescription>
              <CardAction>
                <Badge variant={asset.kind === "generator" ? "default" : "outline"}>
                  {asset.kind}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <MediaPreview asset={asset} />
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-xs text-muted-foreground">
                {asset.width || 1920} × {asset.height || 1080}
              </span>
              <Badge variant="secondary">Drag to timeline</Badge>
            </CardFooter>
          </Card>
        ))}
      </div>
    </LibraryPage>
  );
}

function MediaPreview({ asset }: { asset: MediaAsset }) {
  return (
    <MediaScrubPreview
      asset={asset}
      className="rounded-md"
      testId={`media-library-preview-${asset.id}`}
    />
  );
}

export function ModelLibrary() {
  const workspace = useStudioStore((state) => state.workspace);
  const addModel = useStudioStore((state) => state.addModel);
  const addSceneObject = useStudioStore((state) => state.addSceneObject);
  const fileInput = useRef<HTMLInputElement>(null);
  if (!workspace) {
    return null;
  }

  async function uploadModel(file: File) {
    const formData = new FormData();
    formData.append("uploaded_file", file);
    try {
      const model = await apiRequest<ModelAsset>(
        `/projects/${workspace!.project.id}/models/glb`,
        { method: "POST", body: formData },
      );
      addModel(model);
      toast.success(`${model.name} uploaded.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload GLB.",
      );
    }
  }

  async function placeModel(model: ModelAsset) {
    try {
      await addSceneObject({
        project_id: workspace!.project.id,
        name: model.name,
        object_type: "model",
        model_asset_id: model.id,
        position: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      });
      toast.success(`${model.name} added to the stage.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not place model.",
      );
    }
  }

  return (
    <LibraryPage
      actions={
        <>
          <input
            accept=".glb,model/gltf-binary"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadModel(file);
              }
              event.target.value = "";
            }}
            ref={fileInput}
            type="file"
          />
          <Button onClick={() => fileInput.current?.click()}>
            <UploadIcon data-icon="inline-start" />
            Upload GLB
          </Button>
        </>
      }
      description="Build with projection-friendly primitives or import optimized binary glTF models."
      title="Models"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {workspace.models.map((model) => (
          <Card key={model.id}>
            <CardHeader>
              <CardTitle>{model.name}</CardTitle>
              <CardDescription>
                {model.kind === "primitive"
                  ? `${model.primitiveType} primitive`
                  : "Uploaded GLB"}
              </CardDescription>
              <CardAction>
                <Badge variant="outline">{model.kind}</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="flex aspect-video items-center justify-center rounded-md bg-muted">
                <BoxIcon className="size-12 text-muted-foreground" />
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={() => void placeModel(model)} variant="outline">
                <PlusIcon data-icon="inline-start" />
                Add to stage
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </LibraryPage>
  );
}

export function EquipmentLibrary() {
  const workspace = useStudioStore((state) => state.workspace);
  const addSceneObject = useStudioStore((state) => state.addSceneObject);
  const addTrack = useStudioStore((state) => state.addTrack);
  if (!workspace) {
    return null;
  }

  async function placeEquipment(template: EquipmentTemplate) {
    try {
      const count = workspace!.sceneObjects.filter(
        (item) => item.equipmentTemplateId === template.id,
      ).length;
      const sceneObject = await addSceneObject({
        project_id: workspace!.project.id,
        name: `${template.name} ${count + 1}`,
        object_type: "equipment",
        equipment_template_id: template.id,
        position:
          template.category === "camera"
            ? { x: 0, y: 3, z: 8 }
            : { x: 0, y: 4, z: 5 },
        rotation:
          template.category === "camera"
            ? { x: -0.2, y: 0, z: 0 }
            : { x: -0.3, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      });
      if (template.category === "projector") {
        await addTrack({
          project_id: workspace!.project.id,
          projector_id: sceneObject.id,
          name: "Layer 1",
          order: 0,
          blend_mode: "normal",
        });
      }
      toast.success(`${template.name} added to the stage.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not place equipment.",
      );
    }
  }

  return (
    <LibraryPage
      actions={<Badge variant="secondary">Realistic generic catalog</Badge>}
      description="Reusable optical templates become independently positioned stage instances."
      title="Equipment"
    >
      {(["projector", "light", "camera"] as const).map((category) => (
        <section className="flex flex-col gap-3" key={category}>
          <h2 className="text-lg font-medium capitalize">{category}s</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workspace.equipment
              .filter((template) => template.category === category)
              .map((template) => (
                <EquipmentCard
                  key={template.id}
                  onAdd={() => void placeEquipment(template)}
                  template={template}
                />
              ))}
          </div>
        </section>
      ))}
    </LibraryPage>
  );
}

function EquipmentCard({
  onAdd,
  template,
}: {
  onAdd: () => void;
  template: EquipmentTemplate;
}) {
  const Icon =
    template.category === "projector"
      ? ProjectorIcon
      : template.category === "light"
        ? LightbulbIcon
        : CameraIcon;
  const detail =
    template.category === "projector"
      ? `${String(template.specs.lumens)} lm · ${String(template.specs.throwRatioMin)}–${String(template.specs.throwRatioMax)} throw`
      : template.category === "light"
        ? `${String(template.specs.lumens)} lm · ${String(template.specs.beamAngle)}°`
        : `${String(template.specs.sensorWidth)}mm · ${String(template.specs.focalLength)}mm`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{template.name}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex aspect-video items-center justify-center rounded-md bg-muted">
          <Icon className="size-12 text-muted-foreground" />
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Badge variant="outline">{template.category}</Badge>
        <Button onClick={onAdd} variant="outline">
          <PlusIcon data-icon="inline-start" />
          Add to stage
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ProjectSettings() {
  const workspace = useStudioStore((state) => state.workspace);
  const patchProject = useStudioStore((state) => state.patchProject);
  if (!workspace) {
    return null;
  }
  const project = workspace.project;
  return (
    <LibraryPage
      actions={<Badge variant="outline">Autosaved</Badge>}
      description="Configure the shared stage environment and master timeline."
      title="Project settings"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project</CardTitle>
            <CardDescription>Identity and playback settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="settings-name">Name</FieldLabel>
                <Input
                  defaultValue={project.name}
                  id="settings-name"
                  onBlur={(event) =>
                    void patchProject({ name: event.target.value })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <ProjectNumberField
                  label="Duration (seconds)"
                  min={1}
                  onCommit={(duration) => void patchProject({ duration })}
                  value={project.duration}
                />
                <ProjectNumberField
                  label="Frame rate"
                  min={1}
                  onCommit={(frameRate) => void patchProject({ frameRate })}
                  value={project.frameRate}
                />
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stage environment</CardTitle>
            <CardDescription>World units are meters.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid grid-cols-3 gap-3">
                <ProjectNumberField
                  label="Width"
                  min={1}
                  onCommit={(stageWidth) => void patchProject({ stageWidth })}
                  value={project.stageWidth}
                />
                <ProjectNumberField
                  label="Depth"
                  min={1}
                  onCommit={(stageDepth) => void patchProject({ stageDepth })}
                  value={project.stageDepth}
                />
                <ProjectNumberField
                  label="Height"
                  min={1}
                  onCommit={(stageHeight) => void patchProject({ stageHeight })}
                  value={project.stageHeight}
                />
              </div>
              <ProjectNumberField
                label="Ambient intensity"
                min={0}
                onCommit={(ambientIntensity) =>
                  void patchProject({ ambientIntensity })
                }
                step={0.01}
                value={project.ambientIntensity}
              />
              <Field>
                <FieldLabel htmlFor="ambient-color">Ambient color</FieldLabel>
                <Input
                  defaultValue={project.ambientColor}
                  id="ambient-color"
                  onChange={(event) =>
                    void patchProject({ ambientColor: event.target.value })
                  }
                  type="color"
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </LibraryPage>
  );
}

function LibraryPage({
  actions,
  children,
  description,
  title,
}: {
  actions: React.ReactNode;
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="h-full overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 p-6 lg:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex gap-2">{actions}</div>
        </header>
        <Separator />
        {children}
      </div>
    </section>
  );
}

function ProjectNumberField({
  label,
  min,
  onCommit,
  step = 1,
  value,
}: {
  label: string;
  min?: number;
  onCommit: (value: number) => void;
  step?: number;
  value: number;
}) {
  const id = `project-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        defaultValue={value}
        id={id}
        min={min}
        onBlur={(event) => {
          const number = Number(event.target.value);
          if (Number.isFinite(number)) {
            onCommit(number);
          }
        }}
        step={step}
        type="number"
      />
      {label === "Frame rate" ? (
        <FieldDescription>Timeline snapping precision.</FieldDescription>
      ) : null}
    </Field>
  );
}

function objectsByEquipmentCategory(
  workspace: Workspace,
  category: EquipmentTemplate["category"],
): SceneObject[] {
  const templateIds = new Set(
    workspace.equipment
      .filter((template) => template.category === category)
      .map((template) => template.id),
  );
  return workspace.sceneObjects.filter(
    (item) =>
      item.equipmentTemplateId !== null &&
      templateIds.has(item.equipmentTemplateId),
  );
}
