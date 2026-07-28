import type {
  MediaAsset,
  TimelineClip,
  TimelineTrack,
} from "@/lib/types";

export type ActiveLayer = {
  track: TimelineTrack;
  clip: TimelineClip;
  media: MediaAsset;
  localTime: number;
  opacity: number;
};

export function snapToFrame(time: number, frameRate: number): number {
  return Math.round(time * frameRate) / frameRate;
}

export function canPlaceClip(
  clips: TimelineClip[],
  clipId: number,
  start: number,
  duration: number,
): boolean {
  const end = start + duration;
  return clips.every(
    (clip) =>
      clip.id === clipId ||
      start >= clip.start + clip.duration ||
      end <= clip.start,
  );
}

export function constrainClipStart(
  clips: TimelineClip[],
  clipId: number,
  currentStart: number,
  desiredStart: number,
  duration: number,
): number {
  const others = clips.filter((clip) => clip.id !== clipId);
  if (desiredStart > currentStart) {
    const blocker = others
      .filter(
        (clip) =>
          clip.start >= currentStart + duration &&
          clip.start < desiredStart + duration,
      )
      .sort((left, right) => left.start - right.start)[0];
    return blocker ? blocker.start - duration : desiredStart;
  }
  if (desiredStart < currentStart) {
    const blocker = others
      .filter(
        (clip) =>
          clip.start + clip.duration <= currentStart &&
          clip.start + clip.duration > desiredStart,
      )
      .sort(
        (left, right) =>
          right.start + right.duration - (left.start + left.duration),
      )[0];
    return blocker ? blocker.start + blocker.duration : desiredStart;
  }
  return desiredStart;
}

export function clipLoopBoundaries(
  clipDuration: number,
  sourceDuration: number,
  inPoint: number,
  playbackRate: number,
): number[] {
  if (clipDuration <= 0 || sourceDuration <= 0 || playbackRate <= 0) {
    return [];
  }
  const sourceOffset =
    ((inPoint % sourceDuration) + sourceDuration) % sourceDuration;
  const cycleDuration = sourceDuration / playbackRate;
  const firstBoundary = (sourceDuration - sourceOffset) / playbackRate;
  const boundaries: number[] = [];
  for (
    let boundary = firstBoundary;
    boundary < clipDuration - 0.0001;
    boundary += cycleDuration
  ) {
    boundaries.push(boundary);
  }
  return boundaries;
}

export function resizeClipEdge(
  start: number,
  duration: number,
  delta: number,
  edge: "start" | "end",
  frameRate: number,
  projectDuration: number,
): { start: number; duration: number } {
  const minimumDuration = 1 / frameRate;
  if (edge === "start") {
    const end = start + duration;
    const nextStart = Math.min(
      end - minimumDuration,
      Math.max(0, snapToFrame(start + delta, frameRate)),
    );
    return {
      start: nextStart,
      duration: snapToFrame(end - nextStart, frameRate),
    };
  }
  return {
    start,
    duration: Math.max(
      minimumDuration,
      snapToFrame(
        Math.min(projectDuration - start, duration + delta),
        frameRate,
      ),
    ),
  };
}

export function clipOpacity(clip: TimelineClip, time: number): number {
  const elapsed = time - clip.start;
  const remaining = clip.start + clip.duration - time;
  const fadeIn = clip.fadeIn > 0 ? Math.min(1, elapsed / clip.fadeIn) : 1;
  const fadeOut = clip.fadeOut > 0 ? Math.min(1, remaining / clip.fadeOut) : 1;
  return Math.max(0, Math.min(1, clip.opacity * fadeIn * fadeOut));
}

export function activeLayers(
  tracks: TimelineTrack[],
  media: MediaAsset[],
  projectorId: number,
  time: number,
): ActiveLayer[] {
  return tracks
    .filter((track) => track.projectorId === projectorId)
    .sort((left, right) => left.order - right.order)
    .flatMap((track) =>
      track.clips
        .filter(
          (clip) => time >= clip.start && time < clip.start + clip.duration,
        )
        .map((clip) => {
          const asset = media.find((item) => item.id === clip.mediaAssetId);
          if (!asset) {
            return null;
          }
          const elapsed = (time - clip.start) * clip.playbackRate + clip.inPoint;
          const sourceDuration = asset.duration || clip.duration;
          return {
            track,
            clip,
            media: asset,
            localTime: clip.loop
              ? elapsed % Math.max(sourceDuration, 0.001)
              : Math.min(elapsed, sourceDuration),
            opacity: clipOpacity(clip, time) * track.opacity,
          };
        })
        .filter((layer): layer is ActiveLayer => layer !== null),
    );
}

export function throwRatioToFov(
  throwRatio: number,
  aspect: number,
): { horizontal: number; vertical: number } {
  const horizontal = 2 * Math.atan(1 / (2 * throwRatio));
  const vertical = 2 * Math.atan(Math.tan(horizontal / 2) / aspect);
  return {
    horizontal: (horizontal * 180) / Math.PI,
    vertical: (vertical * 180) / Math.PI,
  };
}
