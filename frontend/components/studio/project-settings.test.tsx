import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ProjectSettings } from "@/components/studio/library-tabs";
import { apiRequest } from "@/lib/api";
import { useStudioStore } from "@/lib/studio-store";
import type { Workspace } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const workspace: Workspace = {
  project: {
    id: "project",
    name: "Color test",
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
  vi.clearAllMocks();
});

it("changes ambient color from project settings", async () => {
  useStudioStore.getState().setWorkspace(workspace);
  vi.mocked(apiRequest).mockResolvedValue({
    ...workspace.project,
    ambientColor: "#ff0000",
  });
  render(<ProjectSettings />);

  fireEvent.change(screen.getByLabelText("Ambient color"), {
    target: { value: "#ff0000" },
  });

  await waitFor(() => {
    expect(apiRequest).toHaveBeenCalledWith(
      "/projects/project",
      expect.objectContaining({
        body: JSON.stringify({ ambient_color: "#ff0000" }),
        method: "PATCH",
      }),
    );
  });
});
