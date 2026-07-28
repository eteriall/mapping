export function inactiveResourceIds(
  resourceIds: Iterable<number>,
  activeIds: Set<number>,
): number[] {
  return [...resourceIds].filter((clipId) => !activeIds.has(clipId));
}

export function expiredInactiveResourceIds(
  resourceIds: Iterable<number>,
  activeIds: Set<number>,
  inactiveSince: Map<number, number>,
  now: number,
  retentionSeconds: number,
): number[] {
  return inactiveResourceIds(resourceIds, activeIds).filter((clipId) => {
    const inactiveAt = inactiveSince.get(clipId);
    return inactiveAt !== undefined && now - inactiveAt >= retentionSeconds;
  });
}

export function releaseVideoElement(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.remove();
}
