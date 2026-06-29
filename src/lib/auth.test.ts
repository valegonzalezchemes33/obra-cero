import { describe, it, expect, beforeEach, vi } from "vitest";
import { isAuthEnabled } from "./auth";

describe("isAuthEnabled", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when ADMIN_USER and ADMIN_PASSWORD are set", () => {
    vi.stubEnv("ADMIN_USER", "admin");
    vi.stubEnv("ADMIN_PASSWORD", "secret");
    expect(isAuthEnabled()).toBe(true);
  });

  it("returns false when credentials are missing", () => {
    expect(isAuthEnabled()).toBe(false);
  });

  it("returns false when AUTH_DISABLED=1 in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DISABLED", "1");
    expect(isAuthEnabled()).toBe(false);
  });

  it("returns false when AUTH_DISABLED=1 outside production but no credentials", () => {
    vi.stubEnv("AUTH_DISABLED", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(isAuthEnabled()).toBe(false);
  });
});
