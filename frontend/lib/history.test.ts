import { describe, expect, it } from "vitest";

import { historyDirection, valuesBeforePatch } from "@/lib/history";

describe("editor history", () => {
  it("maps command and control shortcuts to undo and redo", () => {
    expect(
      historyDirection({
        altKey: false,
        ctrlKey: false,
        key: "z",
        metaKey: true,
        shiftKey: false,
      }),
    ).toBe("undo");
    expect(
      historyDirection({
        altKey: false,
        ctrlKey: false,
        key: "y",
        metaKey: true,
        shiftKey: false,
      }),
    ).toBe("redo");
    expect(
      historyDirection({
        altKey: false,
        ctrlKey: true,
        key: "z",
        metaKey: false,
        shiftKey: true,
      }),
    ).toBe("redo");
  });

  it("captures only values changed by a patch", () => {
    expect(
      valuesBeforePatch(
        { name: "Before", opacity: 0.5, visible: true },
        { name: "After", visible: false },
      ),
    ).toEqual({ name: "Before", visible: true });
  });
});
