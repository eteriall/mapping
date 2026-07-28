import { describe, expect, it } from "vitest";

import {
  activeLayers,
  canPlaceClip,
  clipLoopBoundaries,
  clipOpacity,
  constrainClipStart,
  resizeClipEdge,
  snapToFrame,
  throwRatioToFov,
} from "@/lib/timeline";
import type { MediaAsset, TimelineClip, TimelineTrack } from "@/lib/types";

const clip: TimelineClip = {
  id: 1,
  trackId: 1,
  mediaAssetId: 1,
  start: 2,
  duration: 10,
  inPoint: 0,
  playbackRate: 1,
  loop: true,
  opacity: 0.8,
  fadeIn: 2,
  fadeOut: 2,
};

const media: MediaAsset = {
  id: 1,
  projectId: "project",
  name: "Plasma",
  kind: "generator",
  url: null,
  mimeType: "",
  duration: 60,
  width: 1920,
  height: 1080,
  generatorType: "plasma",
  generatorConfig: {},
};

const track: TimelineTrack = {
  id: 1,
  projectId: "project",
  projectorId: 7,
  name: "Layer 1",
  order: 0,
  opacity: 0.5,
  blendMode: "screen",
  clips: [clip],
};

describe("timeline math", () => {
  it("rejects overlaps while allowing clips to touch at their edges", () => {
    expect(canPlaceClip([clip], 2, 11, 3)).toBe(false);
    expect(canPlaceClip([clip], 2, 12, 3)).toBe(true);
    expect(canPlaceClip([clip], clip.id, 4, 3)).toBe(true);
  });

  it("stops dragged clips at the nearest occupied edge", () => {
    const blocker = { ...clip, start: 10, duration: 5 };
    expect(constrainClipStart([blocker], 2, 0, 12, 4)).toBe(6);
    expect(constrainClipStart([blocker], 2, 18, 8, 3)).toBe(15);
  });

  it("places video restart markers using in-point and playback rate", () => {
    expect(clipLoopBoundaries(25, 10, 0, 1)).toEqual([10, 20]);
    expect(clipLoopBoundaries(20, 10, 3, 1)).toEqual([7, 17]);
    expect(clipLoopBoundaries(12, 10, 0, 2)).toEqual([5, 10]);
  });

  it("resizes either clip edge with frame and project bounds", () => {
    expect(resizeClipEdge(5, 10, 2, "start", 30, 60)).toEqual({
      start: 7,
      duration: 8,
    });
    expect(resizeClipEdge(5, 10, 4, "end", 30, 18)).toEqual({
      start: 5,
      duration: 13,
    });
    expect(resizeClipEdge(5, 10, -20, "end", 30, 60).duration).toBeCloseTo(
      1 / 30,
    );
  });

  it("snaps times to exact project frames", () => {
    expect(snapToFrame(1.019, 30)).toBeCloseTo(1.033333, 5);
  });

  it("applies both clip fades and clip opacity", () => {
    expect(clipOpacity(clip, 3)).toBeCloseTo(0.4);
    expect(clipOpacity(clip, 7)).toBeCloseTo(0.8);
    expect(clipOpacity(clip, 11)).toBeCloseTo(0.4);
  });

  it("returns ordered active projector layers with track opacity", () => {
    const layers = activeLayers([track], [media], 7, 7);
    expect(layers).toHaveLength(1);
    expect(layers[0].opacity).toBeCloseTo(0.4);
    expect(layers[0].localTime).toBe(5);
  });

  it("converts throw ratio to a wider horizontal than vertical field of view", () => {
    const fov = throwRatioToFov(1.5, 16 / 9);
    expect(fov.horizontal).toBeGreaterThan(fov.vertical);
    expect(fov.horizontal).toBeCloseTo(36.87, 1);
  });
});
