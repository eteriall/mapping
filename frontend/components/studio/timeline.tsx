"use client";

import {
  CopyIcon,
  Layers3Icon,
  PauseIcon,
  PlayIcon,
  PowerOffIcon,
  PlusIcon,
  SkipBackIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  canPlaceClip,
  clipLoopBoundaries,
  constrainClipStart,
  resizeClipEdge,
  snapToFrame,
} from "@/lib/timeline";
import { useStudioStore } from "@/lib/studio-store";
import type { MediaAsset, TimelineClip, TimelineTrack } from "@/lib/types";
import { MediaScrubPreview } from "@/components/studio/media-scrub-preview";

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4];

export function ProjectorTimeline() {
  const workspace = useStudioStore((state) => state.workspace);
  const currentTime = useStudioStore((state) => state.currentTime);
  const setCurrentTime = useStudioStore((state) => state.setCurrentTime);
  const playbackSpeed = useStudioStore((state) => state.playbackSpeed);
  const setPlaybackSpeed = useStudioStore(
    (state) => state.setPlaybackSpeed,
  );
  const isPlaying = useStudioStore((state) => state.isPlaying);
  const setPlaying = useStudioStore((state) => state.setPlaying);
  const isBlackout = useStudioStore((state) => state.isBlackout);
  const setBlackout = useStudioStore((state) => state.setBlackout);
  const addTrack = useStudioStore((state) => state.addTrack);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(18);
  if (!workspace) {
    return null;
  }
  const projectors = workspace.sceneObjects.filter((sceneObject) =>
    workspace.equipment.some(
      (template) =>
        template.id === sceneObject.equipmentTemplateId &&
        template.category === "projector",
    ),
  );
  const timelineWidth = Math.max(
    workspace.project.duration * pixelsPerSecond,
    900,
  );
  return (
    <section className="flex h-full min-h-0 flex-col bg-card text-card-foreground">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button
          aria-label="Return to start"
          onClick={() => setCurrentTime(0)}
          size="icon-sm"
          variant="ghost"
        >
          <SkipBackIcon />
        </Button>
        <Button
          aria-label={isPlaying ? "Pause timeline" : "Play timeline"}
          onClick={() => setPlaying(!isPlaying)}
          size="icon-sm"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button
          aria-label={isBlackout ? "End blackout" : "Blackout"}
          aria-pressed={isBlackout}
          onClick={() => setBlackout(!isBlackout)}
          size="icon-sm"
          variant={isBlackout ? "destructive" : "outline"}
        >
          <PowerOffIcon />
        </Button>
        <span className="w-24 font-mono text-sm">
          {formatTime(currentTime, workspace.project.frameRate)}
        </span>
        <div className="w-36">
          <Slider
            max={workspace.project.duration}
            min={0}
            onPointerDown={() => setPlaying(false)}
            onValueChange={(value) =>
              setCurrentTime(
                snapToFrame(
                  Array.isArray(value) ? value[0] : value,
                  workspace.project.frameRate,
                ),
              )
            }
            step={1 / workspace.project.frameRate}
            value={[currentTime]}
          />
        </div>
        <Separator className="mx-1 h-5" orientation="vertical" />
        <Select
          items={PLAYBACK_SPEEDS.map((speed) => ({
            label: `${speed}×`,
            value: String(speed),
          }))}
          onValueChange={(value) => setPlaybackSpeed(Number(value))}
          value={String(playbackSpeed)}
        >
          <SelectTrigger
            aria-label="Playback speed"
            className="h-8 w-20"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PLAYBACK_SPEEDS.map((speed) => (
                <SelectItem key={speed} value={String(speed)}>
                  {speed}×
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          Drag media onto a layer
        </span>
        <Button
          aria-label="Zoom out"
          disabled={pixelsPerSecond <= 10}
          onClick={() => setPixelsPerSecond((value) => value - 4)}
          size="icon-sm"
          variant="ghost"
        >
          <ZoomOutIcon />
        </Button>
        <Button
          aria-label="Zoom in"
          disabled={pixelsPerSecond >= 42}
          onClick={() => setPixelsPerSecond((value) => value + 4)}
          size="icon-sm"
          variant="ghost"
        >
          <ZoomInIcon />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex min-w-full" style={{ width: timelineWidth + 190 }}>
          <div className="sticky left-0 z-10 w-[190px] shrink-0 border-r bg-card">
            <div className="h-7 border-b px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Projector / layer
            </div>
            {projectors.flatMap((projector) => {
              const tracks = workspace.tracks.filter(
                (track) => track.projectorId === projector.id,
              );
              return [
                <div
                  className="flex h-8 items-center gap-2 border-b bg-muted/50 px-2"
                  key={`projector-${projector.id}`}
                >
                  <Layers3Icon className="text-muted-foreground" />
                  <span className="truncate text-xs font-medium">
                    {projector.name}
                  </span>
                  <Button
                    aria-label={`Add layer to ${projector.name}`}
                    className="ml-auto"
                    onClick={() =>
                      void addTrack({
                        project_id: workspace.project.id,
                        projector_id: projector.id,
                        name: `Layer ${tracks.length + 1}`,
                        order: tracks.length,
                      })
                    }
                    size="icon-xs"
                    variant="ghost"
                  >
                    <PlusIcon />
                  </Button>
                </div>,
                ...tracks.map((track) => (
                  <div
                    className="flex h-10 items-center gap-2 border-b px-3"
                    key={`label-${track.id}`}
                  >
                    <span className="truncate text-xs">{track.name}</span>
                    <Badge className="ml-auto" variant="outline">
                      {track.blendMode}
                    </Badge>
                  </div>
                )),
              ];
            })}
          </div>
          <div className="relative shrink-0" style={{ width: timelineWidth }}>
            <TimeRuler
              currentTime={currentTime}
              duration={workspace.project.duration}
              frameRate={workspace.project.frameRate}
              onScrubStart={() => setPlaying(false)}
              onSeek={setCurrentTime}
              pixelsPerSecond={pixelsPerSecond}
            />
            {projectors.flatMap((projector) => {
              const tracks = workspace.tracks.filter(
                (track) => track.projectorId === projector.id,
              );
              return [
                <div
                  className="h-8 border-b bg-muted/30"
                  key={`projector-line-${projector.id}`}
                />,
                ...tracks.map((track) => (
                  <TimelineRow
                    frameRate={workspace.project.frameRate}
                    key={track.id}
                    mediaAssets={Object.fromEntries(
                      workspace.media.map((asset) => [asset.id, asset]),
                    )}
                    pixelsPerSecond={pixelsPerSecond}
                    track={track}
                  />
                )),
              ];
            })}
            <div
              className="pointer-events-none absolute bottom-0 top-7 w-px bg-primary"
              style={{ left: currentTime * pixelsPerSecond }}
            >
              <span className="absolute -left-1.5 -top-1 size-3 rotate-45 bg-primary" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimeRuler({
  currentTime,
  duration,
  frameRate,
  onScrubStart,
  onSeek,
  pixelsPerSecond,
}: {
  currentTime: number;
  duration: number;
  frameRate: number;
  onScrubStart: () => void;
  onSeek: (time: number) => void;
  pixelsPerSecond: number;
}) {
  const marks = useMemo(
    () =>
      Array.from(
        { length: Math.floor(duration / 5) + 1 },
        (_, index) => index * 5,
      ),
    [duration],
  );

  function seekFromPointer(clientX: number, bounds: DOMRect) {
    onSeek(
      snapToFrame(
        Math.max(
          0,
          Math.min(duration, (clientX - bounds.left) / pixelsPerSecond),
        ),
        frameRate,
      ),
    );
  }

  function beginSeek(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    onScrubStart();
    const bounds = event.currentTarget.getBoundingClientRect();
    seekFromPointer(event.clientX, bounds);
    const move = (moveEvent: PointerEvent) => {
      seekFromPointer(moveEvent.clientX, bounds);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  return (
    <button
      aria-label={`Timeline ruler, current time ${currentTime.toFixed(2)} seconds`}
      className="relative block h-7 w-full touch-none cursor-ew-resize border-b bg-muted/20 text-left"
      onPointerDown={beginSeek}
      type="button"
    >
      {marks.map((mark) => (
        <span
          className="absolute top-1 text-[10px] text-muted-foreground"
          key={mark}
          style={{ left: mark * pixelsPerSecond + 4 }}
        >
          {mark}s
        </span>
      ))}
    </button>
  );
}

function TimelineRow({
  frameRate,
  mediaAssets,
  pixelsPerSecond,
  track,
}: {
  frameRate: number;
  mediaAssets: Record<number, MediaAsset>;
  pixelsPerSecond: number;
  track: TimelineTrack;
}) {
  const workspace = useStudioStore((state) => state.workspace);
  const addClip = useStudioStore((state) => state.addClip);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const addMediaAtHover = (
    mediaAssetId: number,
    startTime: number | null = hoverTime,
  ) => {
    if (!workspace || startTime === null) {
      return;
    }
    void addClip({
      track_id: track.id,
      media_asset_id: mediaAssetId,
      start: startTime,
      duration: Math.min(12, workspace.project.duration - startTime),
      loop: true,
      fade_in: 0.5,
      fade_out: 0.5,
    })
      .then(() => setPickerOpen(false))
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "Could not add clip.",
        ),
      );
  };
  return (
    <>
      <div
        aria-label={`${track.name} timeline`}
        className="relative h-10 border-b bg-background/60"
        data-timeline-track-id={track.id}
        onDragOver={(event) => event.preventDefault()}
        onMouseLeave={() => {
          if (!pickerOpen) {
            setHoverTime(null);
          }
        }}
        onMouseMove={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.closest("[data-timeline-clip]")
          ) {
            setHoverTime(null);
            return;
          }
          const bounds = event.currentTarget.getBoundingClientRect();
          setHoverTime(
            Math.min(
              workspace?.project.duration ?? 0,
              Math.max(
                0,
                snapToFrame(
                  (event.clientX - bounds.left) / pixelsPerSecond,
                  frameRate,
                ),
              ),
            ),
          );
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (!workspace) {
            return;
          }
          const mediaAssetId = Number(
            event.dataTransfer.getData("media-asset-id"),
          );
          if (!mediaAssetId) {
            return;
          }
          const bounds = event.currentTarget.getBoundingClientRect();
          const start = snapToFrame(
            (event.clientX - bounds.left) / pixelsPerSecond,
            frameRate,
          );
          setHoverTime(start);
          addMediaAtHover(mediaAssetId, start);
        }}
      >
        {hoverTime !== null ? (
          <Button
            aria-label={`Add media to ${track.name} at ${hoverTime.toFixed(2)} seconds`}
            className="absolute top-1"
            onClick={() => setPickerOpen(true)}
            size="icon-sm"
            style={{
              left: hoverTime * pixelsPerSecond,
              transform: "translateX(-50%)",
            }}
            variant="secondary"
          >
            <PlusIcon />
          </Button>
        ) : null}
        {track.clips.map((clip) => (
          <TimelineClipBlock
            asset={mediaAssets[clip.mediaAssetId]}
            clip={clip}
            frameRate={frameRate}
            key={clip.id}
            pixelsPerSecond={pixelsPerSecond}
          />
        ))}
      </div>
      <Dialog onOpenChange={setPickerOpen} open={pickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add media to {track.name}</DialogTitle>
            <DialogDescription>
              Insert at {hoverTime?.toFixed(2) ?? "0.00"} seconds.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[28rem]">
            <div className="grid grid-cols-2 gap-3 pr-3">
              {workspace?.media.map((asset) => (
                <MediaPickerCard
                  asset={asset}
                  key={asset.id}
                  onClick={() => addMediaAtHover(asset.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MediaPickerCard({
  asset,
  onClick,
}: {
  asset: MediaAsset;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={`Add ${asset.name}`}
      className="h-auto min-w-0 flex-col items-stretch overflow-hidden p-0"
      onClick={onClick}
      variant="outline"
    >
      <MediaScrubPreview
        asset={asset}
        testId={`media-picker-preview-${asset.id}`}
      />
      <span className="flex items-center justify-between gap-2 p-3">
        <span className="truncate">{asset.name}</span>
        <Badge variant="secondary">{asset.kind}</Badge>
      </span>
    </Button>
  );
}

function TimelineClipBlock({
  asset,
  clip,
  frameRate,
  pixelsPerSecond,
}: {
  asset?: MediaAsset;
  clip: TimelineClip;
  frameRate: number;
  pixelsPerSecond: number;
}) {
  const selectedClipId = useStudioStore((state) => state.selectedClipId);
  const selectClip = useStudioStore((state) => state.selectClip);
  const patchClip = useStudioStore((state) => state.patchClip);
  const removeClip = useStudioStore((state) => state.removeClip);
  const addClip = useStudioStore((state) => state.addClip);
  const projectDuration = useStudioStore(
    (state) => state.workspace?.project.duration ?? 0,
  );
  const tracks = useStudioStore((state) => state.workspace?.tracks ?? []);
  const [previewStart, setPreviewStart] = useState<number | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number | null>(null);
  const previewTrackIdRef = useRef(clip.trackId);
  const previewStartRef = useRef(clip.start);
  const previewDurationRef = useRef(clip.duration);
  const start = previewStart ?? clip.start;
  const duration = previewDuration ?? clip.duration;
  const mediaName = asset?.name ?? "Missing media";
  const loopBoundaries =
    asset?.kind === "video" && clip.loop
      ? clipLoopBoundaries(
          duration,
          asset.duration,
          clip.inPoint,
          clip.playbackRate,
        )
      : [];

  function beginDrag(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    selectClip(clip.id);
    const originX = event.clientX;
    const originStart = clip.start;
    const move = (moveEvent: PointerEvent) => {
      const targetTrack = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest<HTMLElement>("[data-timeline-track-id]");
      const candidateTrackId =
        Number(targetTrack?.dataset.timelineTrackId) || clip.trackId;
      const desiredStart = Math.max(
        0,
        snapToFrame(
          originStart + (moveEvent.clientX - originX) / pixelsPerSecond,
          frameRate,
        ),
      );
      const destination = tracks.find(
        (track) => track.id === candidateTrackId,
      );
      if (!destination) {
        return;
      }
      const nextStart =
        destination.id === clip.trackId
          ? constrainClipStart(
              destination.clips,
              clip.id,
              previewStartRef.current,
              desiredStart,
              clip.duration,
            )
          : desiredStart;
      if (
        canPlaceClip(destination.clips, clip.id, nextStart, clip.duration)
      ) {
        previewTrackIdRef.current = candidateTrackId;
        previewStartRef.current = nextStart;
        setPreviewStart(nextStart);
      }
    };
    const end = () => {
      const nextStart = previewStartRef.current;
      const trackId = previewTrackIdRef.current;
      setPreviewStart(null);
      previewTrackIdRef.current = clip.trackId;
      previewStartRef.current = clip.start;
      void patchClip(clip.id, { start: nextStart, trackId });
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }

  function beginResize(
    event: React.PointerEvent<HTMLSpanElement>,
    edge: "start" | "end",
  ) {
    event.preventDefault();
    event.stopPropagation();
    selectClip(clip.id);
    const originX = event.clientX;
    const move = (moveEvent: PointerEvent) => {
      const resized = resizeClipEdge(
        clip.start,
        clip.duration,
        (moveEvent.clientX - originX) / pixelsPerSecond,
        edge,
        frameRate,
        projectDuration,
      );
      const track = tracks.find((item) => item.id === clip.trackId);
      if (
        track &&
        canPlaceClip(track.clips, clip.id, resized.start, resized.duration)
      ) {
        previewStartRef.current = resized.start;
        previewDurationRef.current = resized.duration;
        setPreviewStart(resized.start);
        setPreviewDuration(resized.duration);
      }
    };
    const end = () => {
      const resized = {
        start: previewStartRef.current,
        duration: previewDurationRef.current,
      };
      setPreviewStart(null);
      setPreviewDuration(null);
      previewStartRef.current = clip.start;
      previewDurationRef.current = clip.duration;
      void patchClip(clip.id, resized);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }

  return (
    <button
      data-timeline-clip
      className={cn(
        "group absolute top-1 flex h-8 cursor-grab items-center overflow-hidden rounded-md border bg-primary/20 px-2 text-left text-xs shadow-sm active:cursor-grabbing",
        selectedClipId === clip.id && "ring-2 ring-ring",
      )}
      onClick={() => selectClip(clip.id)}
      onPointerDown={beginDrag}
      style={{
        left: start * pixelsPerSecond,
        width: Math.max(duration * pixelsPerSecond, 28),
      }}
      title={`${mediaName} · ${clip.duration.toFixed(1)}s`}
      type="button"
    >
      {loopBoundaries.map((boundary, index) => (
        <span
          aria-label={`Video restart ${index + 1}`}
          className="pointer-events-none absolute inset-y-0 border-l border-dashed border-primary/70"
          key={boundary}
          style={{ left: `${(boundary / duration) * 100}%` }}
        >
          <span className="absolute left-1 top-0.5 text-[8px] font-medium text-primary">
            {index + 2}
          </span>
        </span>
      ))}
      <span
        aria-label="Resize clip start"
        aria-valuemax={start + duration}
        aria-valuemin={0}
        aria-valuenow={start}
        className="absolute inset-y-0 left-0 w-2 cursor-ew-resize border-l-2 border-transparent hover:border-primary"
        onPointerDown={(event) => beginResize(event, "start")}
        role="slider"
        tabIndex={0}
      />
      <span className="truncate font-medium">{mediaName}</span>
      {selectedClipId === clip.id ? (
        <span className="ml-auto hidden gap-1 bg-card/80 pl-1 group-hover:flex">
          <span
            aria-label="Duplicate clip"
            onClick={(event) => {
              event.stopPropagation();
              void addClip({
                track_id: clip.trackId,
                media_asset_id: clip.mediaAssetId,
                start: clip.start + clip.duration,
                duration: clip.duration,
                in_point: clip.inPoint,
                playback_rate: clip.playbackRate,
                loop: clip.loop,
                opacity: clip.opacity,
                fade_in: clip.fadeIn,
                fade_out: clip.fadeOut,
              });
            }}
            role="button"
            tabIndex={0}
          >
            <CopyIcon />
          </span>
          <span
            aria-label="Delete clip"
            onClick={(event) => {
              event.stopPropagation();
              void removeClip(clip.id);
            }}
            role="button"
            tabIndex={0}
          >
            <Trash2Icon />
          </span>
        </span>
      ) : null}
      <span
        aria-label="Resize clip end"
        aria-valuemax={projectDuration}
        aria-valuemin={start}
        aria-valuenow={start + duration}
        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize border-r-2 border-transparent hover:border-primary"
        onPointerDown={(event) => beginResize(event, "end")}
        role="slider"
        tabIndex={0}
      />
    </button>
  );
}

function formatTime(time: number, frameRate: number) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const frames = Math.floor((time % 1) * frameRate);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}
