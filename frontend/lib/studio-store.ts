"use client";

import { create } from "zustand";

import { apiRequest } from "@/lib/api";
import { valuesBeforePatch } from "@/lib/history";
import type {
  MediaAsset,
  ModelAsset,
  Project,
  SaveState,
  SceneObject,
  TimelineClip,
  TimelineTrack,
  TransformMode,
  Workspace,
} from "@/lib/types";

type HistoryEntry =
  | {
      kind: "project";
      id: string;
      before: Partial<Project>;
      after: Partial<Project>;
    }
  | {
      kind: "sceneObject";
      id: number;
      before: Partial<SceneObject>;
      after: Partial<SceneObject>;
    }
  | {
      kind: "clip";
      id: number;
      before: Partial<TimelineClip>;
      after: Partial<TimelineClip>;
    }
  | {
      kind: "media";
      id: number;
      before: Partial<MediaAsset>;
      after: Partial<MediaAsset>;
    };

type StudioState = {
  workspace: Workspace | null;
  selectedObjectId: number | null;
  selectedClipId: number | null;
  activeCameraId: number | null;
  currentTime: number;
  playbackSpeed: number;
  isPlaying: boolean;
  isBlackout: boolean;
  transformMode: TransformMode;
  saveState: SaveState;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  historyBusy: boolean;
  setWorkspace: (workspace: Workspace) => void;
  selectObject: (id: number | null) => void;
  selectClip: (id: number | null) => void;
  setActiveCamera: (id: number | null) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPlaying: (playing: boolean) => void;
  setBlackout: (blackout: boolean) => void;
  setTransformMode: (mode: TransformMode) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  patchProject: (patch: Partial<Project>) => Promise<void>;
  patchSceneObject: (
    id: number,
    patch: Partial<SceneObject>,
  ) => Promise<void>;
  addSceneObject: (
    payload: Record<string, unknown>,
  ) => Promise<SceneObject>;
  removeSceneObject: (id: number) => Promise<void>;
  addTrack: (payload: Record<string, unknown>) => Promise<TimelineTrack>;
  addClip: (payload: Record<string, unknown>) => Promise<TimelineClip>;
  patchClip: (id: number, patch: Partial<TimelineClip>) => Promise<void>;
  removeClip: (id: number) => Promise<void>;
  addMedia: (media: MediaAsset) => void;
  patchMedia: (id: number, patch: Partial<MediaAsset>) => Promise<void>;
  addModel: (model: ModelAsset) => void;
};

function appendHistory(
  stack: HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  return [...stack, entry].slice(-100);
}

function projectPayload(patch: Partial<Project>) {
  return Object.fromEntries(
    Object.entries({
      name: patch.name,
      duration: patch.duration,
      frame_rate: patch.frameRate,
      stage_width: patch.stageWidth,
      stage_depth: patch.stageDepth,
      stage_height: patch.stageHeight,
      ambient_color: patch.ambientColor,
      ambient_intensity: patch.ambientIntensity,
      free_camera_position: patch.freeCameraPosition,
      free_camera_target: patch.freeCameraTarget,
    }).filter(([, value]) => value !== undefined),
  );
}

function applyHistoryPatch(
  workspace: Workspace,
  entry: HistoryEntry,
  patch:
    | Partial<Project>
    | Partial<SceneObject>
    | Partial<TimelineClip>
    | Partial<MediaAsset>,
): Workspace {
  if (entry.kind === "project") {
    return {
      ...workspace,
      project: { ...workspace.project, ...(patch as Partial<Project>) },
    };
  }
  if (entry.kind === "sceneObject") {
    return {
      ...workspace,
      sceneObjects: workspace.sceneObjects.map((item) =>
        item.id === entry.id
          ? { ...item, ...(patch as Partial<SceneObject>) }
          : item,
      ),
    };
  }
  if (entry.kind === "clip") {
    const existingClip = workspace.tracks
      .flatMap((track) => track.clips)
      .find((item) => item.id === entry.id);
    if (!existingClip) {
      return workspace;
    }
    const nextClip = {
      ...existingClip,
      ...(patch as Partial<TimelineClip>),
    };
    return {
      ...workspace,
      tracks: workspace.tracks.map((track) => ({
        ...track,
        clips: [
          ...track.clips.filter((item) => item.id !== entry.id),
          ...(track.id === nextClip.trackId ? [nextClip] : []),
        ],
      })),
    };
  }
  return {
    ...workspace,
    media: workspace.media.map((item) =>
      item.id === entry.id
        ? { ...item, ...(patch as Partial<MediaAsset>) }
        : item,
    ),
  };
}

async function persistHistoryPatch(
  entry: HistoryEntry,
  patch:
    | Partial<Project>
    | Partial<SceneObject>
    | Partial<TimelineClip>
    | Partial<MediaAsset>,
) {
  if (entry.kind === "project") {
    return apiRequest<Project>(`/projects/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify(projectPayload(patch as Partial<Project>)),
    });
  }
  if (entry.kind === "sceneObject") {
    return apiRequest<SceneObject>(`/scene-objects/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }
  if (entry.kind === "clip") {
    return apiRequest<TimelineClip>(`/clips/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }
  const mediaPatch = patch as Partial<MediaAsset>;
  return apiRequest<MediaAsset>(`/media/${entry.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: mediaPatch.name,
      generatorConfig: mediaPatch.generatorConfig,
    }),
  });
}

export const useStudioStore = create<StudioState>((set, get) => ({
  workspace: null,
  selectedObjectId: null,
  selectedClipId: null,
  activeCameraId: null,
  currentTime: 0,
  playbackSpeed: 1,
  isPlaying: false,
  isBlackout: false,
  transformMode: "translate",
  saveState: "saved",
  undoStack: [],
  redoStack: [],
  historyBusy: false,
  setWorkspace: (workspace) =>
    set({
      workspace,
      currentTime: 0,
      playbackSpeed: 1,
      isPlaying: false,
      isBlackout: false,
      selectedObjectId: null,
      selectedClipId: null,
      activeCameraId: null,
      saveState: "saved",
      undoStack: [],
      redoStack: [],
      historyBusy: false,
    }),
  selectObject: (selectedObjectId) =>
    set({ selectedObjectId, selectedClipId: null }),
  selectClip: (selectedClipId) =>
    set({ selectedClipId, selectedObjectId: null }),
  setActiveCamera: (activeCameraId) => set({ activeCameraId }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setBlackout: (isBlackout) => set({ isBlackout }),
  setTransformMode: (transformMode) => set({ transformMode }),
  undo: async () => {
    const state = get();
    const entry = state.undoStack.at(-1);
    if (
      !entry ||
      !state.workspace ||
      state.historyBusy ||
      state.saveState === "saving"
    ) {
      return;
    }
    set({
      workspace: applyHistoryPatch(state.workspace, entry, entry.before),
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
      historyBusy: true,
      saveState: "saving",
    });
    try {
      await persistHistoryPatch(entry, entry.before);
      set({ historyBusy: false, saveState: "saved" });
    } catch {
      const workspace = get().workspace;
      set({
        workspace: workspace
          ? applyHistoryPatch(workspace, entry, entry.after)
          : workspace,
        undoStack: state.undoStack,
        redoStack: state.redoStack,
        historyBusy: false,
        saveState: "error",
      });
    }
  },
  redo: async () => {
    const state = get();
    const entry = state.redoStack.at(-1);
    if (
      !entry ||
      !state.workspace ||
      state.historyBusy ||
      state.saveState === "saving"
    ) {
      return;
    }
    set({
      workspace: applyHistoryPatch(state.workspace, entry, entry.after),
      undoStack: [...state.undoStack, entry],
      redoStack: state.redoStack.slice(0, -1),
      historyBusy: true,
      saveState: "saving",
    });
    try {
      await persistHistoryPatch(entry, entry.after);
      set({ historyBusy: false, saveState: "saved" });
    } catch {
      const workspace = get().workspace;
      set({
        workspace: workspace
          ? applyHistoryPatch(workspace, entry, entry.before)
          : workspace,
        undoStack: state.undoStack,
        redoStack: state.redoStack,
        historyBusy: false,
        saveState: "error",
      });
    }
  },
  patchProject: async (patch) => {
    const workspace = get().workspace;
    if (!workspace) {
      return;
    }
    const before = valuesBeforePatch(workspace.project, patch);
    set({
      workspace: {
        ...workspace,
        project: { ...workspace.project, ...patch },
      },
      undoStack: appendHistory(get().undoStack, {
          kind: "project",
          id: workspace.project.id,
          before,
          after: patch,
      }),
      redoStack: [],
      saveState: "saving",
    });
    try {
      const project = await apiRequest<Project>(
        `/projects/${workspace.project.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(projectPayload(patch)),
        },
      );
      const latest = get().workspace;
      if (latest) {
        set({ workspace: { ...latest, project }, saveState: "saved" });
      }
    } catch {
      set({ saveState: "error" });
    }
  },
  patchSceneObject: async (id, patch) => {
    const workspace = get().workspace;
    if (!workspace) {
      return;
    }
    const sceneObject = workspace.sceneObjects.find((item) => item.id === id);
    if (!sceneObject) {
      return;
    }
    const before = valuesBeforePatch(sceneObject, patch);
    set({
      workspace: {
        ...workspace,
        sceneObjects: workspace.sceneObjects.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      },
      undoStack: appendHistory(get().undoStack, {
        kind: "sceneObject",
        id,
        before,
        after: patch,
      }),
      redoStack: [],
      saveState: "saving",
    });
    try {
      const sceneObject = await apiRequest<SceneObject>(`/scene-objects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const latest = get().workspace;
      if (latest) {
        set({
          workspace: {
            ...latest,
            sceneObjects: latest.sceneObjects.map((item) =>
              item.id === id ? sceneObject : item,
            ),
          },
          saveState: "saved",
        });
      }
    } catch {
      set({ saveState: "error" });
    }
  },
  addSceneObject: async (payload) => {
    set({ saveState: "saving" });
    const sceneObject = await apiRequest<SceneObject>("/scene-objects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const workspace = get().workspace;
    if (workspace) {
      set({
        workspace: {
          ...workspace,
          sceneObjects: [...workspace.sceneObjects, sceneObject],
        },
        selectedObjectId: sceneObject.id,
        saveState: "saved",
      });
    }
    return sceneObject;
  },
  removeSceneObject: async (id) => {
    await apiRequest<void>(`/scene-objects/${id}`, { method: "DELETE" });
    const workspace = get().workspace;
    if (workspace) {
      set({
        workspace: {
          ...workspace,
          sceneObjects: workspace.sceneObjects.filter((item) => item.id !== id),
          tracks: workspace.tracks.filter((track) => track.projectorId !== id),
        },
        selectedObjectId: null,
      });
    }
  },
  addTrack: async (payload) => {
    const track = await apiRequest<TimelineTrack>("/tracks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const workspace = get().workspace;
    if (workspace) {
      set({
        workspace: { ...workspace, tracks: [...workspace.tracks, track] },
      });
    }
    return track;
  },
  addClip: async (payload) => {
    const clip = await apiRequest<TimelineClip>("/clips", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const workspace = get().workspace;
    if (workspace) {
      set({
        workspace: {
          ...workspace,
          tracks: workspace.tracks.map((track) =>
            track.id === clip.trackId
              ? { ...track, clips: [...track.clips, clip] }
              : track,
          ),
        },
        selectedClipId: clip.id,
      });
    }
    return clip;
  },
  patchClip: async (id, patch) => {
    const workspace = get().workspace;
    if (!workspace) {
      return;
    }
    const existingClip = workspace.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.id === id);
    if (!existingClip) {
      return;
    }
    const before = valuesBeforePatch(existingClip, patch);
    const nextClip = { ...existingClip, ...patch };
    const undoStack = get().undoStack;
    const redoStack = get().redoStack;
    set({
      workspace: {
        ...workspace,
        tracks: workspace.tracks.map((track) => ({
          ...track,
          clips: [
            ...track.clips.filter((clip) => clip.id !== id),
            ...(track.id === nextClip.trackId ? [nextClip] : []),
          ],
        })),
      },
      undoStack: appendHistory(get().undoStack, {
        kind: "clip",
        id,
        before,
        after: patch,
      }),
      redoStack: [],
      saveState: "saving",
    });
    try {
      const clip = await apiRequest<TimelineClip>(`/clips/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const latest = get().workspace;
      if (latest) {
        set({
          workspace: {
            ...latest,
            tracks: latest.tracks.map((track) => ({
              ...track,
              clips: [
                ...track.clips.filter((item) => item.id !== id),
                ...(track.id === clip.trackId ? [clip] : []),
              ],
            })),
          },
          saveState: "saved",
        });
      }
    } catch {
      const latest = get().workspace;
      set({
        workspace: latest
          ? {
              ...latest,
              tracks: latest.tracks.map((track) => ({
                ...track,
                clips: [
                  ...track.clips.filter((item) => item.id !== id),
                  ...(track.id === existingClip.trackId ? [existingClip] : []),
                ],
              })),
            }
          : latest,
        undoStack,
        redoStack,
        saveState: "error",
      });
    }
  },
  removeClip: async (id) => {
    await apiRequest<void>(`/clips/${id}`, { method: "DELETE" });
    const workspace = get().workspace;
    if (workspace) {
      set({
        workspace: {
          ...workspace,
          tracks: workspace.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((clip) => clip.id !== id),
          })),
        },
        selectedClipId: null,
      });
    }
  },
  addMedia: (media) => {
    const workspace = get().workspace;
    if (workspace) {
      set({ workspace: { ...workspace, media: [...workspace.media, media] } });
    }
  },
  patchMedia: async (id, patch) => {
    const workspace = get().workspace;
    const existingMedia = workspace?.media.find((item) => item.id === id);
    if (!workspace || !existingMedia) {
      return;
    }
    const before = valuesBeforePatch(existingMedia, patch);
    set({
      workspace: {
        ...workspace,
        media: workspace.media.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      },
      undoStack: appendHistory(get().undoStack, {
        kind: "media",
        id,
        before,
        after: patch,
      }),
      redoStack: [],
      saveState: "saving",
    });
    try {
      const media = await apiRequest<MediaAsset>(`/media/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: patch.name,
          generatorConfig: patch.generatorConfig,
        }),
      });
      const latest = get().workspace;
      if (latest) {
        set({
          workspace: {
            ...latest,
            media: latest.media.map((item) =>
              item.id === id ? media : item,
            ),
          },
          saveState: "saved",
        });
      }
    } catch {
      set({ saveState: "error" });
    }
  },
  addModel: (model) => {
    const workspace = get().workspace;
    if (workspace) {
      set({ workspace: { ...workspace, models: [...workspace.models, model] } });
    }
  },
}));
