import { describe, it, expect } from "vitest";
import { sanitizeForGroq } from "./audit";

describe("sanitizeForGroq", () => {
  it("redacts DNI patterns", () => {
    const result = sanitizeForGroq("Mi DNI es 12.345.678");
    expect(result).not.toContain("12.345.678");
    expect(result).toContain("[DNI]");
  });

  it("redacts credit card numbers", () => {
    const result = sanitizeForGroq("tarjeta: 1234-5678-9012-3456");
    expect(result).not.toContain("1234-5678-9012-3456");
    expect(result).toContain("[TARJETA]");
  });

  it("redacts password fields", () => {
    const result = sanitizeForGroq("password=supersecret");
    expect(result).not.toContain("supersecret");
    expect(result).toContain("password=[REDACTED]");
  });

  it("redacts Bearer tokens", () => {
    const result = sanitizeForGroq("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.dGVzdA");
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(result).toContain("Bearer [REDACTED]");
  });

  it("redacts api_key patterns", () => {
    const result = sanitizeForGroq("api_key=sk-1234567890abcdef");
    expect(result).not.toContain("sk-1234567890abcdef");
    expect(result).toContain("api_key=[REDACTED]");
  });

  it("truncates long input to 4000 chars", () => {
    const long = "x".repeat(5000);
    const result = sanitizeForGroq(long);
    expect(result.length).toBeLessThanOrEqual(4000);
  });

  it("returns safe text unchanged", () => {
    const text = "consulta sobre el proyecto OB-001";
    expect(sanitizeForGroq(text)).toBe(text);
  });
});
