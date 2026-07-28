import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import ProjectDashboard from "@/app/page";
import type { Project } from "@/lib/types";

const bolshoi: Project = {
  id: "bolshoi-id",
  name: "Bolshoi Theatre",
  duration: 60,
  frameRate: 30,
  stageWidth: 30,
  stageDepth: 22,
  stageHeight: 14,
  ambientColor: "#ffffff",
  ambientIntensity: 0.06,
  freeCameraPosition: { x: 0, y: 9.2, z: 21.5 },
  freeCameraTarget: { x: 0, y: 3.6, z: -7.2 },
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("restores the Bolshoi demo from the project dashboard", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify(bolshoi), {
        headers: { "Content-Type": "application/json" },
        status: 201,
      }),
    );

  render(<ProjectDashboard />);
  await screen.findByText("0 projects");
  expect(screen.queryByText("Projection mapping studio")).toBeNull();
  expect(screen.queryByText("Timeline media")).toBeNull();

  fireEvent.click(
    screen.getByRole("button", { name: "Seed / restore Bolshoi" }),
  );

  await screen.findByText("Bolshoi Theatre");
  await waitFor(() => {
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/projects/seeds/bolshoi-theatre",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
