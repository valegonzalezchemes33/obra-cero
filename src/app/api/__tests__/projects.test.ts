import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  default: () => null,
  getServerSession: vi.fn(() =>
    Promise.resolve({ user: { id: "test", name: "test" } })
  ),
}));

vi.mock("@/lib/logger", () => ({
  apiLogger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  db: {
    project: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "1", name: "Test Project" }),
      update: vi.fn().mockResolvedValue({ id: "1", name: "Updated" }),
      delete: vi.fn().mockResolvedValue({ id: "1" }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ maxNum: 5 }]),
  },
}));

describe("Projects API", () => {
  it("GET returns 200 with projects list", async () => {
    const { GET } = await import("@/app/api/projects/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("POST returns 201 with created project", async () => {
    const { POST } = await import("@/app/api/projects/route");
    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Project" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(201);
  });

  it("POST returns 400 with invalid body", async () => {
    const { POST } = await import("@/app/api/projects/route");
    const req = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
