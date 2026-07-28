"use client";

import { useRef, useState } from "react";

import { GeneratorPreview } from "@/components/studio/generator-preview";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/lib/types";

export function MediaScrubPreview({
  asset,
  className,
  testId,
}: {
  asset: MediaAsset;
  className?: string;
  testId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState(0);

  function scrub(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextProgress = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width),
    );
    setProgress(nextProgress);
    const video = videoRef.current;
    if (video) {
      const duration = Number.isFinite(video.duration)
        ? video.duration
        : asset.duration;
      video.currentTime = nextProgress * Math.max(duration, 0);
    }
  }

  return (
    <div
      className={cn("block aspect-video w-full overflow-hidden bg-black", className)}
      data-testid={testId}
      onMouseEnter={(event) => {
        setHovered(true);
        scrub(event);
      }}
      onMouseLeave={() => {
        setHovered(false);
        videoRef.current?.pause();
      }}
      onMouseMove={scrub}
    >
      {asset.kind === "video" && asset.url ? (
        <video
          className="size-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
          ref={videoRef}
          src={asset.url}
        />
      ) : (
        <GeneratorPreview asset={asset} hovered={hovered} progress={progress} />
      )}
    </div>
  );
}
