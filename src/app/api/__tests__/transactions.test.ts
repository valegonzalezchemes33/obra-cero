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

vi.mock("@/lib/cache", () => ({
  getCached: vi.fn((_key, fn) => fn()),
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "1", type: "income", amount: 1000 }),
      update: vi.fn().mockResolvedValue({ id: "1", type: "income", amount: 1500 }),
      delete: vi.fn().mockResolvedValue({ id: "1" }),
    },
  },
}));

describe("Transactions API", () => {
  it("GET returns 200 with transactions list", async () => {
    const { GET } = await import("@/app/api/transactions/route");
    const req = new Request("http://localhost/api/transactions");
    const response = await GET(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("POST returns 201 with created transaction", async () => {
    const { POST } = await import("@/app/api/transactions/route");
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "income", category: "venta", amount: 5000 }),
    });
    const response = await POST(req);
    expect(response.status).toBe(201);
  });

  it("POST returns 400 with invalid body", async () => {
    const { POST } = await import("@/app/api/transactions/route");
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "invalid" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
