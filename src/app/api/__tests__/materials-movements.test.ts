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

const mockMovement = { id: "m1", type: "incoming", quantity: 10, materialId: "1" };
const mockMaterial = { id: "1", name: "Cemento", stock: 50, unitCost: 100, unit: "bolsa" };

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb({
        material: {
          findUnique: vi.fn().mockResolvedValue(mockMaterial),
          update: vi.fn().mockResolvedValue({ ...mockMaterial, stock: 60 }),
        },
        stockMovement: {
          create: vi.fn().mockResolvedValue(mockMovement),
        },
        transaction: {
          create: vi.fn().mockResolvedValue({ id: "tx1" }),
        },
      });
    }),
  },
}));

describe("Materials Movements API", () => {
  it("POST returns 201 with created movement", async () => {
    const { POST } = await import("@/app/api/materials/[id]/movements/route");
    const req = new Request("http://localhost/api/materials/1/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "incoming", quantity: 10, unitCost: 120, supplierId: "s1" }),
    });
    const response = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.movement).toBeDefined();
    expect(data.material).toBeDefined();
  });

  it("POST returns 400 with invalid body", async () => {
    const { POST } = await import("@/app/api/materials/[id]/movements/route");
    const req = new Request("http://localhost/api/materials/1/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "incoming" }),
    });
    const response = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(400);
  });
});
