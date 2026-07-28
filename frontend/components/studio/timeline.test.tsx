import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ProjectorTimeline } from "@/components/studio/timeline";
import { useStudioStore } from "@/lib/studio-store";
import type { Workspace } from "@/lib/types";

vi.mock("@/components/studio/generator-preview", () => ({
  GeneratorPreview: () => <span>Generator shader preview</span>,
}));

const workspace: Workspace = {
  project: {
    id: "project",
    name: "Blackout test",
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
  sceneObjects: [],
  tracks: [],
};

afterEach(() => {
  cleanup();
});

it("toggles blackout immediately after the play button", () => {
  useStudioStore.getState().setWorkspace(workspace);
  render(<ProjectorTimeline />);

  const playButton = screen.getByRole("button", { name: "Play timeline" });
  const blackoutButton = screen.getByRole("button", { name: "Blackout" });
  expect(playButton.nextElementSibling).toBe(blackoutButton);

  fireEvent.click(blackoutButton);

  expect(useStudioStore.getState().isBlackout).toBe(true);
  expect(
    useStudioStore.getState().workspace?.project.ambientIntensity,
  ).toBe(0.12);
  expect(
    screen.getByRole("button", { name: "End blackout" }).getAttribute(
      "aria-pressed",
    ),
  ).toBe("true");
});

it("scrubs the timeline continuously while the pointer moves", () => {
  useStudioStore.getState().setWorkspace(workspace);
  useStudioStore.getState().setPlaying(true);
  render(<ProjectorTimeline />);
  const ruler = screen.getByRole("button", { name: /Timeline ruler/ });
  vi.spyOn(ruler, "getBoundingClientRect").mockReturnValue({
    bottom: 27,
    height: 27,
    left: 100,
    right: 1180,
    top: 0,
    width: 1080,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  });

  fireEvent.pointerDown(ruler, { clientX: 190 });
  expect(useStudioStore.getState().currentTime).toBe(5);
  expect(useStudioStore.getState().isPlaying).toBe(false);

  fireEvent.pointerMove(window, { clientX: 280 });
  expect(useStudioStore.getState().currentTime).toBe(10);

  fireEvent.pointerUp(window);
});

it("opens a media picker from empty timeline space", () => {
  useStudioStore.getState().setWorkspace({
    ...workspace,
    media: [
      {
        id: 11,
        projectId: "project",
        name: "Facade Loop",
        kind: "generator",
        url: null,
        mimeType: "",
        duration: 60,
        width: 1920,
        height: 1080,
        generatorType: "plasma",
        generatorConfig: {},
      },
    ],
    equipment: [
      {
        id: 21,
        name: "Projector",
        slug: "projector",
        category: "projector",
        specs: {},
        isSeeded: true,
      },
    ],
    sceneObjects: [
      {
        id: 31,
        projectId: "project",
        name: "Center Projector",
        objectType: "equipment",
        modelAssetId: null,
        equipmentTemplateId: 21,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        properties: {},
        visible: true,
      },
    ],
    tracks: [
      {
        id: 41,
        projectId: "project",
        projectorId: 31,
        name: "Layer 1",
        order: 0,
        opacity: 1,
        blendMode: "normal",
        clips: [],
      },
    ],
  });
  render(<ProjectorTimeline />);

  expect(screen.getByRole("combobox", { name: "Playback speed" })).toBeTruthy();
  expect(screen.queryByText("30 fps")).toBeNull();
  fireEvent.mouseMove(screen.getByLabelText("Layer 1 timeline"), {
    clientX: 90,
  });
  fireEvent.click(
    screen.getByRole("button", { name: /Add media to Layer 1 at/ }),
  );

  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Facade Loop/ })).toBeTruthy();
  expect(screen.getByTestId("media-picker-preview-11")).toBeTruthy();
});
