import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { MediaScrubPreview } from "@/components/studio/media-scrub-preview";
import type { MediaAsset } from "@/lib/types";

vi.mock("@/components/studio/generator-preview", () => ({
  GeneratorPreview: ({ hovered, progress }: { hovered: boolean; progress: number }) => (
    <span>{`${hovered}:${progress}`}</span>
  ),
}));

const asset = {
  id: 1,
  projectId: "project",
  name: "Generator",
  kind: "generator",
  url: null,
  mimeType: "",
  duration: 60,
  width: 1920,
  height: 1080,
  generatorType: "plasma",
  generatorConfig: {},
} satisfies MediaAsset;

it("scrubs a real generator preview from cursor position only while hovered", () => {
  render(<MediaScrubPreview asset={asset} testId="preview" />);
  const preview = screen.getByTestId("preview");
  vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({
    bottom: 100,
    height: 100,
    left: 100,
    right: 300,
    top: 0,
    width: 200,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  });

  fireEvent.mouseEnter(preview, { clientX: 150 });
  expect(screen.getByText("true:0.25")).toBeTruthy();
  fireEvent.mouseMove(preview, { clientX: 250 });
  expect(screen.getByText("true:0.75")).toBeTruthy();
  fireEvent.mouseLeave(preview);
  expect(screen.getByText("false:0.75")).toBeTruthy();
});
