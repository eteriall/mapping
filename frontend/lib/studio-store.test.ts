import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "@/lib/api";
import { useStudioStore } from "@/lib/studio-store";
import type { SceneObject, Workspace } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const sceneObject: SceneObject = {
  id: 7,
  projectId: "project",
  name: "Cube",
  objectType: "model",
  modelAssetId: null,
  equipmentTemplateId: null,
  position: { x: 0, y: 1, z: 2 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  properties: {},
  visible: true,
};

const workspace: Workspace = {
  project: {
    id: "project",
    name: "History",
    duration: 60,
    frameRate: 30,
    stageWidth: 12,
    stageDepth: 8,
    stageHeight: 6,
    ambientColor: "#ffffff",
    ambientIntensity: 0.12,
    freeCameraPosition: { x: 9, y: 7, z: 12 },
    freeCameraTarget: { x: 0, y: 1.5, z: 0 },
    createdAt: "",
    updatedAt: "",
  },
  media: [],
  models: [],
  equipment: [],
  sceneObjects: [sceneObject],
  tracks: [],
};

describe("studio store history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStudioStore.getState().setWorkspace(workspace);
    vi.mocked(apiRequest).mockImplementation(async (_path, options) => {
      const patch = JSON.parse(String(options?.body)) as Partial<SceneObject>;
      return { ...sceneObject, ...patch };
    });
  });

  it("persists undo and redo for scene object edits", async () => {
    const movedPosition = { x: 4, y: 3, z: -1 };
    await useStudioStore
      .getState()
      .patchSceneObject(sceneObject.id, { position: movedPosition });

    expect(
      useStudioStore.getState().workspace?.sceneObjects[0].position,
    ).toEqual(movedPosition);

    await useStudioStore.getState().undo();
    expect(
      useStudioStore.getState().workspace?.sceneObjects[0].position,
    ).toEqual(sceneObject.position);

    await useStudioStore.getState().redo();
    expect(
      useStudioStore.getState().workspace?.sceneObjects[0].position,
    ).toEqual(movedPosition);
    expect(apiRequest).toHaveBeenCalledTimes(3);
  });

  it("updates playback speed and resets it for a loaded workspace", () => {
    useStudioStore.getState().setPlaybackSpeed(2.5);
    expect(useStudioStore.getState().playbackSpeed).toBe(2.5);

    useStudioStore.getState().setWorkspace(workspace);

    expect(useStudioStore.getState().playbackSpeed).toBe(1);
  });

  it("ignores a stale scene-object response that finishes last", async () => {
    const responses: Array<(value: SceneObject) => void> = [];
    vi.mocked(apiRequest).mockImplementation(
      () =>
        new Promise((resolve) => {
          responses.push(resolve as (value: SceneObject) => void);
        }),
    );

    const firstPosition = { x: 1, y: 2, z: 3 };
    const latestPosition = { x: 4, y: 5, z: 6 };
    const firstRequest = useStudioStore
      .getState()
      .patchSceneObject(sceneObject.id, { position: firstPosition });
    const latestRequest = useStudioStore
      .getState()
      .patchSceneObject(sceneObject.id, { position: latestPosition });

    responses[1]({ ...sceneObject, position: latestPosition });
    await latestRequest;
    expect(useStudioStore.getState().saveState).toBe("saving");

    responses[0]({ ...sceneObject, position: firstPosition });
    await firstRequest;

    expect(
      useStudioStore.getState().workspace?.sceneObjects[0].position,
    ).toEqual(latestPosition);
    expect(useStudioStore.getState().saveState).toBe("saved");
  });

  it("rolls back the latest failed optimistic scene-object edit", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("offline"));

    await useStudioStore
      .getState()
      .patchSceneObject(sceneObject.id, {
        position: { x: 9, y: 9, z: 9 },
      });

    expect(
      useStudioStore.getState().workspace?.sceneObjects[0].position,
    ).toEqual(sceneObject.position);
    expect(useStudioStore.getState().saveState).toBe("error");
  });

  it("does not let an old workspace mutation change newly loaded state", async () => {
    let finishRequest: ((value: SceneObject) => void) | undefined;
    vi.mocked(apiRequest).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve as (value: SceneObject) => void;
        }),
    );
    const request = useStudioStore
      .getState()
      .patchSceneObject(sceneObject.id, {
        position: { x: 8, y: 8, z: 8 },
      });
    const replacement = {
      ...workspace,
      project: { ...workspace.project, id: "replacement" },
      sceneObjects: [],
    };

    useStudioStore.getState().setWorkspace(replacement);
    finishRequest?.(sceneObject);
    await request;

    expect(useStudioStore.getState().workspace).toEqual(replacement);
    expect(useStudioStore.getState().saveState).toBe("saved");
  });
});
