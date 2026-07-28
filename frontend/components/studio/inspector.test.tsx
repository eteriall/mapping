import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { Inspector } from "@/components/studio/inspector";
import { useStudioStore } from "@/lib/studio-store";
import type { Workspace } from "@/lib/types";

vi.mock("@/components/studio/media-scrub-preview", () => ({
  MediaScrubPreview: () => <div>Live generator preview</div>,
}));

const workspace: Workspace = {
  project: {
    id: "project",
    name: "Project",
    duration: 60,
    frameRate: 30,
    stageWidth: 12,
    stageDepth: 8,
    stageHeight: 6,
    ambientColor: "#ffffff",
    ambientIntensity: 1,
    freeCameraPosition: { x: 0, y: 0, z: 10 },
    freeCameraTarget: { x: 0, y: 0, z: 0 },
    createdAt: "",
    updatedAt: "",
  },
  media: [
    {
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
      generatorConfig: {
        colors: ["#112233", "#445566", "#778899"],
        speed: 0.8,
        scale: 1.2,
        intensity: 0.9,
        seed: 42,
      },
    },
  ],
  models: [],
  equipment: [],
  sceneObjects: [],
  tracks: [
    {
      id: 2,
      projectId: "project",
      projectorId: 3,
      name: "Layer 1",
      order: 0,
      opacity: 1,
      blendMode: "normal",
      clips: [
        {
          id: 4,
          trackId: 2,
          mediaAssetId: 1,
          start: 0,
          duration: 20,
          inPoint: 0,
          playbackRate: 1,
          loop: true,
          opacity: 1,
          fadeIn: 0,
          fadeOut: 0,
        },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
});

it.each(["projector", "light"] as const)(
  "hides scale controls for selected %s equipment",
  (category) => {
    useStudioStore.getState().setWorkspace({
      ...workspace,
      equipment: [
        {
          id: 10,
          name: category,
          slug: category,
          category,
          specs:
            category === "projector"
              ? {
                  lumens: 10_000,
                  resolution: [1920, 1080],
                  throwRatio: 1,
                  throwRatioMin: 0.5,
                  throwRatioMax: 2,
                }
              : {},
          isSeeded: false,
        },
      ],
      sceneObjects: [
        {
          id: 20,
          projectId: "project",
          name: category,
          objectType: "equipment",
          modelAssetId: null,
          equipmentTemplateId: 10,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          properties: {},
          visible: true,
        },
      ],
    });
    useStudioStore.getState().selectObject(20);

    render(<Inspector />);

    expect(screen.queryByText("Scale")).toBeNull();
    expect(screen.getByText("Position")).toBeTruthy();
    expect(screen.getByText("Rotation")).toBeTruthy();
    if (category === "projector") {
      expect(screen.getByLabelText("Volume brightness")).toBeTruthy();
      expect(screen.getByLabelText("Volume falloff")).toBeTruthy();
    }
  },
);

it("shows generator preview and settings for a selected generator clip", () => {
  useStudioStore.getState().setWorkspace(workspace);
  useStudioStore.getState().selectClip(4);

  render(<Inspector />);

  expect(screen.getByText("Live generator preview")).toBeTruthy();
  expect(screen.getByLabelText("Color A")).toBeTruthy();
  expect(screen.getByLabelText("Color B")).toBeTruthy();
  expect(screen.getByLabelText("Color C")).toBeTruthy();
  expect(screen.getByLabelText("Generator speed")).toBeTruthy();
  expect(screen.getByLabelText("Generator scale")).toBeTruthy();
  expect(screen.getByLabelText("Generator intensity")).toBeTruthy();
  expect(screen.getByLabelText("Generator seed")).toBeTruthy();
});
