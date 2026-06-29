import { describe, it, expect } from "vitest";
import { AuthRequiredError, authRequiredResponse } from "./api-utils";

describe("AuthRequiredError", () => {
  it("is an instance of Error", () => {
    const err = new AuthRequiredError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AuthRequiredError");
    expect(err.message).toBe("Sesión requerida");
  });
});

describe("authRequiredResponse", () => {
  it("returns 401 JSON response", async () => {
    const res = authRequiredResponse();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Sesión requerida.");
  });
});
