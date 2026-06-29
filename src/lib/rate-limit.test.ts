import { describe, it, expect } from "vitest";
import { webhookRateLimiter, agentRateLimiter } from "./rate-limit";

describe("webhookRateLimiter", () => {
  it("allows first request", () => {
    const result = webhookRateLimiter("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it("decrements remaining on each hit", () => {
    const ip = "5.6.7.8";
    const r1 = webhookRateLimiter(ip);
    const r2 = webhookRateLimiter(ip);
    expect(r2.remaining).toBe(r1.remaining - 1);
  });

  it("blocks after 60 requests", () => {
    const ip = "9.9.9.9";
    for (let i = 0; i < 60; i++) {
      webhookRateLimiter(ip);
    }
    const result = webhookRateLimiter(ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("treats different IPs independently", () => {
    const r1 = webhookRateLimiter("10.0.0.1");
    const r2 = webhookRateLimiter("10.0.0.2");
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r1.remaining).toBe(59);
    expect(r2.remaining).toBe(59);
  });
});

describe("agentRateLimiter", () => {
  it("allows first request per session", () => {
    const r = agentRateLimiter("session-a");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(29);
  });

  it("blocks after 30 requests", () => {
    const sid = "session-ratelimit-test";
    for (let i = 0; i < 30; i++) {
      agentRateLimiter(sid);
    }
    const result = agentRateLimiter(sid);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
