export type HistoryDirection = "undo" | "redo";

export type HistoryShortcut = {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
};

export function historyDirection(
  shortcut: HistoryShortcut,
): HistoryDirection | null {
  if (shortcut.altKey || (!shortcut.metaKey && !shortcut.ctrlKey)) {
    return null;
  }
  const key = shortcut.key.toLowerCase();
  if (key === "y" || (key === "z" && shortcut.shiftKey)) {
    return "redo";
  }
  return key === "z" ? "undo" : null;
}

export function valuesBeforePatch<T extends object>(
  source: T,
  patch: Partial<T>,
): Partial<T> {
  return Object.fromEntries(
    (Object.keys(patch) as Array<keyof T>).map((key) => [key, source[key]]),
  ) as Partial<T>;
}
