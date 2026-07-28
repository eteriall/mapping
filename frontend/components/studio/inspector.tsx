"use client";

import {
  BoxIcon,
  CameraIcon,
  ClapperboardIcon,
  LightbulbIcon,
  ProjectorIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaScrubPreview } from "@/components/studio/media-scrub-preview";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  type LightSettings,
  type LightType,
  resolveLightSettings,
} from "@/lib/lights";
import { useStudioStore } from "@/lib/studio-store";
import {
  DEFAULT_VOLUME_FALLOFF,
  DEFAULT_VOLUME_INTENSITY,
} from "@/lib/stage-rendering";
import type { EquipmentTemplate, SceneObject, Vec3 } from "@/lib/types";

export function Inspector() {
  const workspace = useStudioStore((state) => state.workspace);
  const selectedObjectId = useStudioStore((state) => state.selectedObjectId);
  const selectedClipId = useStudioStore((state) => state.selectedClipId);
  const patchSceneObject = useStudioStore((state) => state.patchSceneObject);
  const removeSceneObject = useStudioStore((state) => state.removeSceneObject);
  const patchClip = useStudioStore((state) => state.patchClip);
  const patchMedia = useStudioStore((state) => state.patchMedia);
  const removeClip = useStudioStore((state) => state.removeClip);
  if (!workspace) {
    return null;
  }
  const sceneObject = workspace.sceneObjects.find(
    (item) => item.id === selectedObjectId,
  );
  const clip = workspace.tracks
    .flatMap((track) => track.clips)
    .find((item) => item.id === selectedClipId);

  if (clip) {
    const media = workspace.media.find(
      (asset) => asset.id === clip.mediaAssetId,
    );
    return (
      <InspectorShell
        badge="Timeline clip"
        icon={ClapperboardIcon}
        title={media?.name ?? "Missing media"}
      >
        {media?.kind === "generator" ? (
          <>
            <MediaScrubPreview
              asset={media}
              className="rounded-md border"
              testId={`clip-generator-preview-${media.id}`}
            />
            <FieldGroup>
              <div className="grid grid-cols-3 gap-2">
                {(media.generatorConfig.colors ?? [
                  "#22d3ee",
                  "#8b5cf6",
                  "#ec4899",
                ]).map((color, index, colors) => (
                  <ColorField
                    key={index}
                    label={`Color ${String.fromCharCode(65 + index)}`}
                    onCommit={(nextColor) => {
                      const nextColors = [...colors];
                      nextColors[index] = nextColor;
                      void patchMedia(media.id, {
                        generatorConfig: {
                          ...media.generatorConfig,
                          colors: nextColors,
                        },
                      });
                    }}
                    value={color}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumericField
                  label="Generator speed"
                  min={0}
                  onCommit={(speed) =>
                    void patchMedia(media.id, {
                      generatorConfig: {
                        ...media.generatorConfig,
                        speed,
                      },
                    })
                  }
                  step={0.05}
                  value={media.generatorConfig.speed ?? 1}
                />
                <NumericField
                  label="Generator scale"
                  min={0.01}
                  onCommit={(scale) =>
                    void patchMedia(media.id, {
                      generatorConfig: {
                        ...media.generatorConfig,
                        scale,
                      },
                    })
                  }
                  step={0.05}
                  value={media.generatorConfig.scale ?? 1}
                />
                <NumericField
                  label="Generator intensity"
                  min={0}
                  onCommit={(intensity) =>
                    void patchMedia(media.id, {
                      generatorConfig: {
                        ...media.generatorConfig,
                        intensity,
                      },
                    })
                  }
                  step={0.05}
                  value={media.generatorConfig.intensity ?? 1}
                />
                <NumericField
                  label="Generator seed"
                  min={0}
                  onCommit={(seed) =>
                    void patchMedia(media.id, {
                      generatorConfig: {
                        ...media.generatorConfig,
                        seed,
                      },
                    })
                  }
                  step={1}
                  value={media.generatorConfig.seed ?? 1}
                />
              </div>
            </FieldGroup>
            <Separator />
          </>
        ) : null}
        <FieldGroup>
          <NumericField
            label="Start (seconds)"
            onCommit={(start) => void patchClip(clip.id, { start })}
            step={1 / workspace.project.frameRate}
            value={clip.start}
          />
          <NumericField
            label="Duration"
            min={0.01}
            onCommit={(duration) => void patchClip(clip.id, { duration })}
            step={1 / workspace.project.frameRate}
            value={clip.duration}
          />
          <NumericField
            label="Playback rate"
            min={0.05}
            onCommit={(playbackRate) =>
              void patchClip(clip.id, { playbackRate })
            }
            step={0.05}
            value={clip.playbackRate}
          />
          <NumericField
            label="Opacity"
            max={1}
            min={0}
            onCommit={(opacity) => void patchClip(clip.id, { opacity })}
            step={0.05}
            value={clip.opacity}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumericField
              label="Fade in"
              min={0}
              onCommit={(fadeIn) => void patchClip(clip.id, { fadeIn })}
              step={0.1}
              value={clip.fadeIn}
            />
            <NumericField
              label="Fade out"
              min={0}
              onCommit={(fadeOut) => void patchClip(clip.id, { fadeOut })}
              step={0.1}
              value={clip.fadeOut}
            />
          </div>
          <Field className="rounded-lg border p-3" orientation="horizontal">
            <FieldLabel htmlFor="clip-loop">Loop source</FieldLabel>
            <Switch
              checked={clip.loop}
              id="clip-loop"
              onCheckedChange={(loop) => void patchClip(clip.id, { loop })}
            />
          </Field>
        </FieldGroup>
        <Separator />
        <Button
          onClick={() =>
            void removeClip(clip.id).catch((error: unknown) =>
              toast.error(
                error instanceof Error ? error.message : "Could not remove clip.",
              ),
            )
          }
          variant="destructive"
        >
          <Trash2Icon data-icon="inline-start" />
          Remove clip
        </Button>
      </InspectorShell>
    );
  }

  if (!sceneObject) {
    return (
      <InspectorShell
        badge="Stage"
        icon={SlidersHorizontalIcon}
        title="Nothing selected"
      >
        <div className="rounded-lg border p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Stage</span>
            <span>
              {workspace.project.stageWidth} × {workspace.project.stageDepth} ×{" "}
              {workspace.project.stageHeight}m
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span className="text-muted-foreground">Timeline</span>
            <span>{workspace.project.duration}s</span>
          </div>
        </div>
      </InspectorShell>
    );
  }

  const template = workspace.equipment.find(
    (item) => item.id === sceneObject.equipmentTemplateId,
  );
  const model = workspace.models.find(
    (item) => item.id === sceneObject.modelAssetId,
  );
  const Icon =
    template?.category === "projector"
      ? ProjectorIcon
      : template?.category === "light"
        ? LightbulbIcon
        : template?.category === "camera"
          ? CameraIcon
          : BoxIcon;
  const patchVector = (field: "position" | "rotation" | "scale", vector: Vec3) =>
    void patchSceneObject(sceneObject.id, { [field]: vector });
  return (
    <InspectorShell
      badge={template?.category ?? model?.kind ?? "Scene object"}
      icon={Icon}
      title={sceneObject.name}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="object-name">Name</FieldLabel>
          <Input
            defaultValue={sceneObject.name}
            id="object-name"
            key={`${sceneObject.id}-name`}
            onBlur={(event) =>
              void patchSceneObject(sceneObject.id, {
                name: event.target.value,
              })
            }
          />
        </Field>
        <VectorFields
          label="Position"
          onCommit={(position) => patchVector("position", position)}
          value={sceneObject.position}
        />
        <VectorFields
          label="Rotation"
          onCommit={(rotation) => patchVector("rotation", rotation)}
          step={0.05}
          value={sceneObject.rotation}
        />
        {template?.category !== "projector" &&
        template?.category !== "light" ? (
          <VectorFields
            label="Scale"
            min={0.01}
            onCommit={(scale) => patchVector("scale", scale)}
            step={0.1}
            value={sceneObject.scale}
          />
        ) : null}
        <Field className="rounded-lg border p-3" orientation="horizontal">
          <FieldLabel htmlFor="object-visible">Visible</FieldLabel>
          <Switch
            checked={sceneObject.visible}
            id="object-visible"
            onCheckedChange={(visible) =>
              void patchSceneObject(sceneObject.id, { visible })
            }
          />
        </Field>
      </FieldGroup>
      {template?.category === "projector" ? (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Projector optics</h3>
            <FieldGroup>
              <NumericField
                label="Projection width at 10m"
                min={0.1}
                onCommit={(projectionWidth) =>
                  void patchSceneObject(sceneObject.id, {
                    properties: { ...sceneObject.properties, projectionWidth },
                  })
                }
                step={0.1}
                value={
                  Number(sceneObject.properties.projectionWidth) ||
                  10 /
                    (Number(sceneObject.properties.throwRatio) ||
                      Number(template.specs.throwRatio))
                }
              />
              <NumericField
                label="Brightness (lumens)"
                min={1}
                onCommit={(lumens) =>
                  void patchSceneObject(sceneObject.id, {
                    properties: { ...sceneObject.properties, lumens },
                  })
                }
                step={100}
                value={
                  Number(sceneObject.properties.lumens) ||
                  Number(template.specs.lumens)
                }
              />
              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel>Volume brightness</FieldLabel>
                  <span className="font-mono text-xs text-muted-foreground">
                    {(
                      Number(sceneObject.properties.volumeIntensity) ||
                      DEFAULT_VOLUME_INTENSITY
                    ).toFixed(2)}
                  </span>
                </div>
                <Slider
                  aria-label="Volume brightness"
                  max={0.8}
                  min={0.05}
                  onValueCommitted={(value) =>
                    void patchSceneObject(sceneObject.id, {
                      properties: {
                        ...sceneObject.properties,
                        volumeIntensity: Array.isArray(value)
                          ? value[0]
                          : value,
                      },
                    })
                  }
                  step={0.05}
                  value={[
                    Number(sceneObject.properties.volumeIntensity) ||
                      DEFAULT_VOLUME_INTENSITY,
                  ]}
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel>Volume falloff</FieldLabel>
                  <span className="font-mono text-xs text-muted-foreground">
                    {(
                      Number(sceneObject.properties.volumeFalloff) ||
                      DEFAULT_VOLUME_FALLOFF
                    ).toFixed(1)}
                  </span>
                </div>
                <Slider
                  aria-label="Volume falloff"
                  max={8}
                  min={0.5}
                  onValueCommitted={(value) =>
                    void patchSceneObject(sceneObject.id, {
                      properties: {
                        ...sceneObject.properties,
                        volumeFalloff: Array.isArray(value)
                          ? value[0]
                          : value,
                      },
                    })
                  }
                  step={0.25}
                  value={[
                    Number(sceneObject.properties.volumeFalloff) ||
                      DEFAULT_VOLUME_FALLOFF,
                  ]}
                />
              </Field>
            </FieldGroup>
            <p className="text-xs text-muted-foreground">
              {String((template.specs.resolution as number[])[0])} ×{" "}
              {String((template.specs.resolution as number[])[1])} · throw range{" "}
              {String(template.specs.throwRatioMin)}–
              {String(template.specs.throwRatioMax)}
            </p>
          </div>
        </>
      ) : null}
      {template?.category === "light" ? (
        <LightSettingsFields
          onPatch={(patch) =>
            void patchSceneObject(sceneObject.id, {
              properties: { ...sceneObject.properties, ...patch },
            })
          }
          sceneObject={sceneObject}
          template={template}
        />
      ) : null}
      <Separator />
      <Button
        onClick={() =>
          void removeSceneObject(sceneObject.id).catch((error: unknown) =>
            toast.error(
              error instanceof Error ? error.message : "Could not remove object.",
            ),
          )
        }
        variant="destructive"
      >
        <Trash2Icon data-icon="inline-start" />
        Remove from stage
      </Button>
    </InspectorShell>
  );
}

function LightSettingsFields({
  onPatch,
  sceneObject,
  template,
}: {
  onPatch: (patch: Partial<LightSettings>) => void;
  sceneObject: SceneObject;
  template: EquipmentTemplate;
}) {
  const settings = resolveLightSettings(sceneObject.properties, template.specs);
  return (
    <>
      <Separator />
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Light output</h3>
        <FieldGroup>
          <Field>
            <FieldLabel>Light type</FieldLabel>
            <ToggleGroup
              aria-label="Light type"
              className="w-full"
              onValueChange={(value) => {
                const lightType = value[0] as LightType | undefined;
                if (lightType) {
                  onPatch({ lightType });
                }
              }}
              spacing={0}
              value={[settings.lightType]}
              variant="outline"
            >
              {(["point", "spot", "directional", "area"] as const).map(
                (lightType) => (
                  <ToggleGroupItem
                    className="min-w-0 flex-1 px-1.5 capitalize"
                    key={lightType}
                    value={lightType}
                  >
                    {lightType === "directional" ? "Sun" : lightType}
                  </ToggleGroupItem>
                ),
              )}
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="light-color">Color</FieldLabel>
            <Input
              aria-label="Light color"
              id="light-color"
              key={`${sceneObject.id}-color-${settings.color}`}
              onChange={(event) => onPatch({ color: event.target.value })}
              type="color"
              value={settings.color}
            />
          </Field>
          <NumericField
            label="Output (lumens)"
            min={1}
            onCommit={(lumens) => onPatch({ lumens })}
            step={100}
            value={settings.lumens}
          />
          {settings.lightType === "point" ||
          settings.lightType === "spot" ? (
            <>
              <NumericField
                label="Range (meters)"
                min={0.1}
                onCommit={(range) => onPatch({ range })}
                step={0.5}
                value={settings.range}
              />
              <NumericField
                label="Physical decay"
                max={2}
                min={0}
                onCommit={(decay) => onPatch({ decay })}
                step={0.1}
                value={settings.decay}
              />
            </>
          ) : null}
          {settings.lightType === "spot" ? (
            <>
              <NumericField
                label="Beam width (degrees)"
                max={179}
                min={1}
                onCommit={(beamAngle) => onPatch({ beamAngle })}
                step={1}
                value={settings.beamAngle}
              />
              <NumericField
                label="Edge softness"
                max={1}
                min={0}
                onCommit={(penumbra) => onPatch({ penumbra })}
                step={0.05}
                value={settings.penumbra}
              />
            </>
          ) : null}
          {settings.lightType === "area" ? (
            <div className="grid grid-cols-2 gap-2">
              <NumericField
                label="Width (meters)"
                min={0.01}
                onCommit={(width) => onPatch({ width })}
                step={0.1}
                value={settings.width}
              />
              <NumericField
                label="Height (meters)"
                min={0.01}
                onCommit={(height) => onPatch({ height })}
                step={0.1}
                value={settings.height}
              />
            </div>
          ) : null}
          {settings.lightType !== "area" ? (
            <Field className="rounded-lg border p-3" orientation="horizontal">
              <FieldLabel htmlFor="light-cast-shadow">
                Cast shadows
              </FieldLabel>
              <Switch
                checked={settings.castShadow}
                id="light-cast-shadow"
                onCheckedChange={(castShadow) => onPatch({ castShadow })}
              />
            </Field>
          ) : null}
        </FieldGroup>
        <p className="text-xs text-muted-foreground">
          Rotate the fixture on the stage to aim directional and spot lights.
          Area lights emit from their rectangular face.
        </p>
      </div>
    </>
  );
}

function InspectorShell({
  badge,
  children,
  icon: Icon,
  title,
}: {
  badge: string;
  children: React.ReactNode;
  icon: typeof BoxIcon;
  title: string;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 border-b p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">{title}</h2>
          <Badge className="mt-1" variant="outline">
            {badge}
          </Badge>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {children}
      </div>
    </aside>
  );
}

function NumericField({
  label,
  max,
  min,
  onCommit,
  step = 0.1,
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onCommit: (value: number) => void;
  step?: number;
  value: number;
}) {
  const id = `field-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        defaultValue={Number(value.toFixed(4))}
        id={id}
        key={`${id}-${value}`}
        max={max}
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
    </Field>
  );
}

function ColorField({
  label,
  onCommit,
  value,
}: {
  label: string;
  onCommit: (value: string) => void;
  value: string;
}) {
  const id = `field-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        className="h-9 cursor-pointer p-1"
        id={id}
        onChange={(event) => onCommit(event.target.value)}
        type="color"
        value={value}
      />
    </Field>
  );
}

function VectorFields({
  label,
  min,
  onCommit,
  step = 0.1,
  value,
}: {
  label: string;
  min?: number;
  onCommit: (value: Vec3) => void;
  step?: number;
  value: Vec3;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-3 gap-2">
        {(["x", "y", "z"] as const).map((axis) => (
          <Input
            aria-label={`${label} ${axis.toUpperCase()}`}
            defaultValue={Number(value[axis].toFixed(4))}
            key={`${label}-${axis}-${value[axis]}`}
            min={min}
            onBlur={(event) => {
              const number = Number(event.target.value);
              if (Number.isFinite(number)) {
                onCommit({ ...value, [axis]: number });
              }
            }}
            step={step}
            type="number"
          />
        ))}
      </div>
    </Field>
  );
}
