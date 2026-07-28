"use client";

import {
  ArrowLeftIcon,
  BoxIcon,
  CameraIcon,
  ClapperboardIcon,
  CloudAlertIcon,
  Layers3Icon,
  Move3dIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Redo2Icon,
  Rotate3dIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  Undo2Icon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EquipmentLibrary,
  MediaLibrary,
  ModelLibrary,
  ProjectSettings,
  SceneHierarchy,
} from "@/components/studio/library-tabs";
import {
  EditorSkeleton,
  SaveBadge,
} from "@/components/studio/editor-status";
import { Inspector } from "@/components/studio/inspector";
import { ProjectorTimeline } from "@/components/studio/timeline";
import { loadWorkspace } from "@/lib/api";
import { historyDirection } from "@/lib/history";
import { useStudioStore } from "@/lib/studio-store";

const StageCanvas = dynamic(
  () =>
    import("@/components/studio/stage-canvas").then(
      (module) => module.StageCanvas,
    ),
  { ssr: false },
);

type EditorTab = "stage" | "media" | "models" | "equipment" | "settings";

export function StudioEditor({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<EditorTab>("stage");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [viewportFps, setViewportFps] = useState(0);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLightBounds, setShowLightBounds] = useState(false);
  const [showProjectionContour, setShowProjectionContour] = useState(false);
  const [showProjectorBounds, setShowProjectorBounds] = useState(false);
  const [showProjectedSurfaces, setShowProjectedSurfaces] = useState(false);
  const [showVolumetricLight, setShowVolumetricLight] = useState(true);
  const workspace = useStudioStore((state) => state.workspace);
  const setWorkspace = useStudioStore((state) => state.setWorkspace);
  const currentTime = useStudioStore((state) => state.currentTime);
  const setCurrentTime = useStudioStore((state) => state.setCurrentTime);
  const playbackSpeed = useStudioStore((state) => state.playbackSpeed);
  const isPlaying = useStudioStore((state) => state.isPlaying);
  const setPlaying = useStudioStore((state) => state.setPlaying);
  const saveState = useStudioStore((state) => state.saveState);
  const activeCameraId = useStudioStore((state) => state.activeCameraId);
  const setActiveCamera = useStudioStore((state) => state.setActiveCamera);
  const transformMode = useStudioStore((state) => state.transformMode);
  const setTransformMode = useStudioStore((state) => state.setTransformMode);
  const undo = useStudioStore((state) => state.undo);
  const redo = useStudioStore((state) => state.redo);
  const canUndo = useStudioStore(
    (state) =>
      state.undoStack.length > 0 &&
      !state.historyBusy &&
      state.saveState !== "saving",
  );
  const canRedo = useStudioStore(
    (state) =>
      state.redoStack.length > 0 &&
      !state.historyBusy &&
      state.saveState !== "saving",
  );
  const currentTimeRef = useRef(currentTime);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.matches("input, textarea, select"))
      ) {
        return;
      }
      const direction = historyDirection(event);
      if (direction === "undo" && canUndo) {
        event.preventDefault();
        void undo();
      } else if (direction === "redo" && canRedo) {
        event.preventDefault();
        void redo();
      }
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [canRedo, canUndo, redo, undo]);

  useEffect(() => {
    const handlePlaybackShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.code !== "Space" &&
        event.key !== " " &&
        event.key !== "Spacebar"
      ) {
        return;
      }
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.matches("input, textarea, select"))
      ) {
        return;
      }
      event.preventDefault();
      setPlaying(!isPlaying);
    };
    window.addEventListener("keydown", handlePlaybackShortcut);
    return () => window.removeEventListener("keydown", handlePlaybackShortcut);
  }, [isPlaying, setPlaying]);

  useEffect(() => {
    let mounted = true;
    loadWorkspace(projectId)
      .then((loadedWorkspace) => {
        if (mounted) {
          setWorkspace(loadedWorkspace);
        }
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Could not open workspace.",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [projectId, setWorkspace]);

  useEffect(() => {
    if (!isPlaying || !workspace) {
      return;
    }
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      const next = currentTimeRef.current + delta * playbackSpeed;
      const wrapped = next >= workspace.project.duration ? 0 : next;
      currentTimeRef.current = wrapped;
      setCurrentTime(wrapped);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, playbackSpeed, setCurrentTime, workspace]);

  if (loading) {
    return <EditorSkeleton />;
  }
  if (!workspace) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <CloudAlertIcon className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Workspace unavailable</h1>
        <Button nativeButton={false} render={<Link href="/" />} variant="outline">
          Return to projects
        </Button>
      </main>
    );
  }
  const cameras = workspace.sceneObjects.filter((sceneObject) =>
    workspace.equipment.some(
      (template) =>
        template.id === sceneObject.equipmentTemplateId &&
        template.category === "camera",
    ),
  );
  return (
    <main className="flex h-screen min-h-[680px] flex-col overflow-hidden bg-background">
      <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b bg-card px-3 text-card-foreground">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            aria-label="Back to projects"
            nativeButton={false}
            render={<Link href="/" />}
            size="icon-sm"
            variant="ghost"
          >
            <ArrowLeftIcon />
          </Button>
          <h1 className="truncate text-sm font-medium">
            {workspace.project.name}
          </h1>
        </div>
        <Tabs
          onValueChange={(value) => {
            setActiveTab(value as EditorTab);
            if (value !== "stage") {
              setPlaying(false);
            }
          }}
          value={activeTab}
        >
          <TabsList>
            <TabsTrigger value="stage">
              <Layers3Icon data-icon="inline-start" />
              Stage
            </TabsTrigger>
            <TabsTrigger value="media">
              <ClapperboardIcon data-icon="inline-start" />
              Media
            </TabsTrigger>
            <TabsTrigger value="models">
              <BoxIcon data-icon="inline-start" />
              Models
            </TabsTrigger>
            <TabsTrigger value="equipment">
              <SlidersHorizontalIcon data-icon="inline-start" />
              Equipment
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings2Icon data-icon="inline-start" />
              Settings
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Undo"
                  disabled={!canUndo}
                  onClick={() => void undo()}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <Undo2Icon />
            </TooltipTrigger>
            <TooltipContent>Undo · ⌘Z</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Redo"
                  disabled={!canRedo}
                  onClick={() => void redo()}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <Redo2Icon />
            </TooltipTrigger>
            <TooltipContent>Redo · ⌘Y / ⌘⇧Z</TooltipContent>
          </Tooltip>
          <SaveBadge state={saveState} />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {activeTab === "stage" ? (
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="70%" minSize="120px">
              <ResizablePanelGroup orientation="horizontal">
                {leftSidebarOpen ? (
                  <>
                    <ResizablePanel
                      defaultSize="18%"
                      maxSize="75%"
                      minSize="120px"
                    >
                      <SceneHierarchy />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                  </>
                ) : null}
                <ResizablePanel minSize="100px">
                  <section className="relative h-full min-h-0 overflow-hidden bg-black">
                <StageCanvas
                  onFpsChange={setViewportFps}
                  showGrid={showGrid}
                  showLightBounds={showLightBounds}
                  showProjectionContour={showProjectionContour}
                  showProjectorBounds={showProjectorBounds}
                  showProjectedSurfaces={showProjectedSurfaces}
                  showVolumetricLight={showVolumetricLight}
                />
                <Badge
                  aria-label={`Viewport frame rate: ${viewportFps} FPS`}
                  className="absolute right-3 top-3 font-mono tabular-nums"
                  variant="secondary"
                >
                  {viewportFps} FPS
                </Badge>
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border bg-card/90 p-2 shadow-sm backdrop-blur">
                  <CameraIcon className="text-muted-foreground" />
                  <Select
                    items={[
                      { label: "Free camera", value: "free" },
                      ...cameras.map((camera) => ({
                        label: camera.name,
                        value: String(camera.id),
                      })),
                    ]}
                    onValueChange={(value) =>
                      setActiveCamera(value === "free" ? null : Number(value))
                    }
                    value={activeCameraId === null ? "free" : String(activeCameraId)}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Viewport camera" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="free">Free camera</SelectItem>
                        {cameras.map((camera) => (
                          <SelectItem key={camera.id} value={String(camera.id)}>
                            {camera.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary">Live POV</Badge>
                  <ToggleGroup
                    aria-label="Object transform mode"
                    onValueChange={(value) => {
                      const mode = value[0];
                      if (mode === "translate" || mode === "rotate") {
                        setTransformMode(mode);
                      }
                    }}
                    spacing={0}
                    value={[transformMode]}
                    variant="outline"
                  >
                    <ToggleGroupItem
                      aria-label="Move selected object"
                      title="Move selected object"
                      value="translate"
                    >
                      <Move3dIcon />
                      Move
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      aria-label="Rotate selected object"
                      title="Rotate selected object"
                      value="rotate"
                    >
                      <Rotate3dIcon />
                      Rotate
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <div className="flex items-center gap-2 border-l pl-2">
                    <Switch
                      checked={showProjectorBounds}
                      id="show-projector-bounds"
                      onCheckedChange={setShowProjectorBounds}
                      size="sm"
                    />
                    <Label htmlFor="show-projector-bounds">
                      Projector bounds
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showProjectedSurfaces}
                      id="show-projected-surfaces"
                      onCheckedChange={setShowProjectedSurfaces}
                      size="sm"
                    />
                    <Label htmlFor="show-projected-surfaces">
                      Projected surfaces
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showProjectionContour}
                      id="show-projection-contour"
                      onCheckedChange={setShowProjectionContour}
                      size="sm"
                    />
                    <Label htmlFor="show-projection-contour">
                      Projection contour
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showVolumetricLight}
                      id="show-volumetric-light"
                      onCheckedChange={setShowVolumetricLight}
                      size="sm"
                    />
                    <Label htmlFor="show-volumetric-light">
                      Volumetric light
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showGrid}
                      id="show-grid"
                      onCheckedChange={setShowGrid}
                      size="sm"
                    />
                    <Label htmlFor="show-grid">Grid</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={showLightBounds}
                      id="show-light-bounds"
                      onCheckedChange={setShowLightBounds}
                      size="sm"
                    />
                    <Label htmlFor="show-light-bounds">Light bounds</Label>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label={
                          leftSidebarOpen
                            ? "Collapse scene sidebar"
                            : "Expand scene sidebar"
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        onClick={() => setLeftSidebarOpen((open) => !open)}
                        size="icon-sm"
                        variant="secondary"
                      />
                    }
                  >
                    {leftSidebarOpen ? (
                      <PanelLeftCloseIcon />
                    ) : (
                      <PanelLeftOpenIcon />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {leftSidebarOpen
                      ? "Collapse scene sidebar"
                      : "Expand scene sidebar"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label={
                          rightSidebarOpen
                            ? "Collapse inspector sidebar"
                            : "Expand inspector sidebar"
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        onClick={() => setRightSidebarOpen((open) => !open)}
                        size="icon-sm"
                        variant="secondary"
                      />
                    }
                  >
                    {rightSidebarOpen ? (
                      <PanelRightCloseIcon />
                    ) : (
                      <PanelRightOpenIcon />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {rightSidebarOpen
                      ? "Collapse inspector sidebar"
                      : "Expand inspector sidebar"}
                  </TooltipContent>
                </Tooltip>
                  </section>
                </ResizablePanel>
                {rightSidebarOpen ? (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel
                      defaultSize="22%"
                      maxSize="75%"
                      minSize="120px"
                    >
                      <div className="h-full min-h-0 bg-card">
                        <Inspector />
                      </div>
                    </ResizablePanel>
                  </>
                ) : null}
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize="30%"
              maxSize="85%"
              minSize="80px"
            >
              <ProjectorTimeline />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : null}
        {activeTab === "media" ? <MediaLibrary /> : null}
        {activeTab === "models" ? <ModelLibrary /> : null}
        {activeTab === "equipment" ? <EquipmentLibrary /> : null}
        {activeTab === "settings" ? <ProjectSettings /> : null}
      </div>
    </main>
  );
}
