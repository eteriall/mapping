import { expect, it, vi } from "vitest";

it("proxies API and uploaded media paths to Django", async () => {
  vi.stubEnv("BACKEND_ORIGIN", "http://backend:8000");
  vi.resetModules();
  const { default: config } = await import("./next.config");
  const rewrites =
    typeof config.rewrites === "function" ? await config.rewrites() : [];

  expect(rewrites).toContainEqual({
    source: "/api/:path*",
    destination: "http://backend:8000/api/:path*",
  });
  expect(rewrites).toContainEqual({
    source: "/media/:path*",
    destination: "http://backend:8000/media/:path*",
  });
  vi.unstubAllEnvs();
});
