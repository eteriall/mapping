import { describe, expect, it, vi } from "vitest";

import {
  expiredInactiveResourceIds,
  inactiveResourceIds,
  releaseVideoElement,
} from "@/lib/media-playback";

describe("media playback lifecycle", () => {
  it("identifies cached clip resources that are no longer active", () => {
    expect(inactiveResourceIds([1, 2, 3], new Set([1, 3]))).toEqual([2]);
  });

  it("expires only resources inactive for the retention period", () => {
    expect(
      expiredInactiveResourceIds(
        [1, 2, 3],
        new Set([1]),
        new Map([
          [2, 10],
          [3, 13],
        ]),
        15,
        5,
      ),
    ).toEqual([2]);
  });

  it("unloads and detaches an expired video element", () => {
    const video = document.createElement("video");
    video.src = "/media/example.mp4";
    document.body.append(video);
    const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const load = vi.spyOn(video, "load").mockImplementation(() => undefined);

    releaseVideoElement(video);

    expect(pause).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledOnce();
    expect(video.hasAttribute("src")).toBe(false);
    expect(video.isConnected).toBe(false);
  });
});
