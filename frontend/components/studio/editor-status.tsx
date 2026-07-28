import {
  CheckIcon,
  CloudAlertIcon,
  CloudUploadIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SaveState } from "@/lib/types";

export function SaveBadge({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <Badge variant="outline">
        <CloudUploadIcon />
        Saving
      </Badge>
    );
  }
  if (state === "error") {
    return (
      <Badge variant="destructive">
        <CloudAlertIcon />
        Save failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <CheckIcon />
      Saved
    </Badge>
  );
}

export function EditorSkeleton() {
  return (
    <main className="flex h-screen flex-col bg-background p-3">
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-[230px_minmax(0,1fr)_300px] gap-3">
        <Skeleton className="h-full rounded-lg" />
        <Skeleton className="h-full rounded-lg" />
        <Skeleton className="h-full rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-56 w-full rounded-lg" />
    </main>
  );
}
