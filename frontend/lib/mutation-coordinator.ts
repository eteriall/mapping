import type { SaveState } from "@/lib/types";

export type MutationToken = {
  generation: number;
  version: number;
};

export class MutationCoordinator {
  private failed = false;
  private generation = 0;
  private pending = 0;
  private readonly versions = new Map<string, number>();

  begin(key: string): MutationToken {
    if (this.pending === 0) {
      this.failed = false;
    }
    const version = (this.versions.get(key) ?? 0) + 1;
    this.versions.set(key, version);
    this.pending += 1;
    return { generation: this.generation, version };
  }

  finish(
    key: string,
    token: MutationToken,
    succeeded: boolean,
  ): SaveState | null {
    if (token.generation !== this.generation) {
      return null;
    }
    this.pending = Math.max(0, this.pending - 1);
    if (!succeeded && this.isCurrent(key, token)) {
      this.failed = true;
    }
    if (this.failed) {
      return "error";
    }
    return this.pending > 0 ? "saving" : "saved";
  }

  isCurrent(key: string, token: MutationToken): boolean {
    return (
      token.generation === this.generation &&
      this.versions.get(key) === token.version
    );
  }

  reset(): void {
    this.generation += 1;
    this.versions.clear();
    this.pending = 0;
    this.failed = false;
  }
}
