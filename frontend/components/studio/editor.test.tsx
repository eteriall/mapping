import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { StudioEditor } from "@/components/studio/editor";
import { loadWorkspace } from "@/lib/api";
import { useStudioStore } from "@/lib/studio-store";
import type { Workspace } from "@/lib/types";

vi.mock("next/dynamic", () => ({
  default:
    () =>
    (props: {
      onFpsChange: (fps: number) => void;
      showGrid: boolean;
      showLightBounds: boolean;
      showProjectionContour: boolean;
      showProjectorBounds: boolean;
      showProjectedSurfaces: boolean;
      showVolumetricLight: boolean;
    }) => (
      <div
        data-grid={String(props.showGrid)}
        data-light-bounds={String(props.showLightBounds)}
        data-projection-contour={String(props.showProjectionContour)}
        data-projector-bounds={String(props.showProjectorBounds)}
        data-projected-surfaces={String(props.showProjectedSurfaces)}
        data-volumetric-light={String(props.showVolumetricLight)}
        data-testid="stage-canvas"
      >
        Stage canvas
      </div>
    ),
}));

vi.mock("@/components/studio/library-tabs", () => ({
  EquipmentLibrary: () => <div>Equipment library</div>,
  MediaLibrary: () => <div>Media library</div>,
  ModelLibrary: () => <div>Model library</div>,
  ProjectSettings: () => <div>Project settings</div>,
  SceneHierarchy: () => <div>Scene hierarchy</div>,
}));

vi.mock("@/components/studio/inspector", () => ({
  Inspector: () => <div>Inspector</div>,
}));

vi.mock("@/components/studio/timeline", () => ({
  ProjectorTimeline: () => <div>Timeline</div>,
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({
    children,
    orientation,
  }: {
    children: React.ReactNode;
    orientation: string;
  }) => (
    <div data-orientation={orientation} data-testid="resizable-group">
      {children}
    </div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="resizable-panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="resizable-handle" />,
}));

vi.mock("@/lib/api", () => ({
  loadWorkspace: vi.fn(),
}));

const workspace: Workspace = {
  project: {
    id: "project",
    name: "Demo stage",
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

it("shows centered studio navigation without instructional branding", async () => {
  vi.mocked(loadWorkspace).mockResolvedValue(workspace);

  const { container } = render(<StudioEditor projectId="project" />);

  await screen.findByText("Demo stage");

  expect(screen.queryByText("Projection mapping studio")).toBeNull();
  expect(screen.queryByText(/Select an object to move or rotate/)).toBeNull();
  expect(
    screen.getByLabelText("Viewport frame rate: 0 FPS"),
  ).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Stage" })).toBeTruthy();
  expect(screen.getAllByTestId("resizable-group")).toHaveLength(2);
  expect(screen.getAllByTestId("resizable-handle")).toHaveLength(3);

  await waitFor(() => {
    expect(
      container.querySelector(
        "header.grid.grid-cols-\\[1fr_auto_1fr\\]",
      ),
    ).toBeTruthy();
  });
});

it("collapses and expands both stage sidebars", async () => {
  vi.mocked(loadWorkspace).mockResolvedValue(workspace);

  render(<StudioEditor projectId="project" />);

  await screen.findByText("Scene hierarchy");
  expect(screen.getByText("Inspector")).toBeTruthy();

  fireEvent.click(
    screen.getByRole("button", { name: "Collapse scene sidebar" }),
  );
  expect(screen.queryByText("Scene hierarchy")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Expand scene sidebar" }),
  ).toBeTruthy();

  fireEvent.click(
    screen.getByRole("button", { name: "Collapse inspector sidebar" }),
  );
  expect(screen.queryByText("Inspector")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Expand inspector sidebar" }),
  ).toBeTruthy();

  fireEvent.click(
    screen.getByRole("button", { name: "Expand scene sidebar" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Expand inspector sidebar" }),
  );
  expect(screen.getByText("Scene hierarchy")).toBeTruthy();
  expect(screen.getByText("Inspector")).toBeTruthy();
});

it("toggles projector bounds, projected surfaces, and light bounds independently", async () => {
  vi.mocked(loadWorkspace).mockResolvedValue(workspace);

  render(<StudioEditor projectId="project" />);

  const stageCanvas = await screen.findByTestId("stage-canvas");
  expect(stageCanvas.getAttribute("data-projector-bounds")).toBe("false");
  expect(stageCanvas.getAttribute("data-grid")).toBe("true");
  expect(stageCanvas.getAttribute("data-light-bounds")).toBe("false");
  expect(stageCanvas.getAttribute("data-projection-contour")).toBe("false");
  expect(stageCanvas.getAttribute("data-projected-surfaces")).toBe("false");
  expect(stageCanvas.getAttribute("data-volumetric-light")).toBe("true");

  fireEvent.click(
    screen.getByRole("switch", { name: "Projector bounds" }),
  );
  expect(stageCanvas.getAttribute("data-projector-bounds")).toBe("true");
  expect(stageCanvas.getAttribute("data-light-bounds")).toBe("false");
  expect(stageCanvas.getAttribute("data-projected-surfaces")).toBe("false");

  fireEvent.click(
    screen.getByRole("switch", { name: "Projected surfaces" }),
  );
  expect(stageCanvas.getAttribute("data-projector-bounds")).toBe("true");
  expect(stageCanvas.getAttribute("data-projected-surfaces")).toBe("true");
  expect(stageCanvas.getAttribute("data-light-bounds")).toBe("false");

  fireEvent.click(
    screen.getByRole("switch", { name: "Projection contour" }),
  );
  expect(stageCanvas.getAttribute("data-projection-contour")).toBe("true");

  fireEvent.click(screen.getByRole("switch", { name: "Grid" }));
  expect(stageCanvas.getAttribute("data-grid")).toBe("false");

  fireEvent.click(
    screen.getByRole("switch", { name: "Volumetric light" }),
  );
  expect(stageCanvas.getAttribute("data-volumetric-light")).toBe("false");

  fireEvent.click(screen.getByRole("switch", { name: "Light bounds" }));
  expect(stageCanvas.getAttribute("data-projector-bounds")).toBe("true");
  expect(stageCanvas.getAttribute("data-light-bounds")).toBe("true");
  expect(stageCanvas.getAttribute("data-projected-surfaces")).toBe("true");
});

it("toggles playback with the spacebar outside text inputs", async () => {
  vi.mocked(loadWorkspace).mockResolvedValue(workspace);

  render(<StudioEditor projectId="project" />);

  await screen.findByText("Demo stage");

  expect(useStudioStore.getState().isPlaying).toBe(false);
  fireEvent.keyDown(window, { code: "Space", key: " " });
  expect(useStudioStore.getState().isPlaying).toBe(true);
  fireEvent.keyDown(window, { code: "Space", key: " " });
  expect(useStudioStore.getState().isPlaying).toBe(false);
});

it("ignores the spacebar while typing into an input", async () => {
  vi.mocked(loadWorkspace).mockResolvedValue(workspace);

  render(
    <>
      <StudioEditor projectId="project" />
      <input aria-label="Notes" />
    </>,
  );

  await screen.findByText("Demo stage");

  const input = screen.getByLabelText("Notes");
  input.focus();
  fireEvent.keyDown(input, { code: "Space", key: " " });

  expect(useStudioStore.getState().isPlaying).toBe(false);
});
