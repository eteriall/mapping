import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

import { frameRateFromSample } from "@/lib/frame-rate";

export function FrameRateMonitor({
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
